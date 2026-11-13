import hashlib
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from hypothesis import HealthCheck, Phase, find, given, seed as hyp_seed, settings
from hypothesis.errors import NoSuchExample

from harness import corpus, counterexamples, decisions as decision_store
from harness.compare import compare_batch, compare_one, mismatches
from harness.profiles import CORPUS_VERSION, DEFAULT_SEED, PROFILES
from modern import calculator
from oracle import runner

ROOT = runner.ROOT
EVIDENCE = ROOT / "evidence"
GLOBAL_CX = EVIDENCE / "counterexamples"

LIMITATIONS = [
    "Evidence is over the generated and curated cases counted in this report, not a proof of equivalence.",
    "Only the pinned GnuCOBOL compiler version recorded here was exercised.",
    "Input was ASCII with 80 byte lines. Tabs, CRLF and a missing final newline were not exercised.",
    "A run that finds no mismatch means none were found, not that none exist.",
]


def twin_hash():
    digest = hashlib.sha256()
    for path in sorted((ROOT / "modern").glob("*.py")):
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def noop(event):
    return None


def chunks(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def next_cx_number(directory):
    existing = [int(p.stem.split("_")[1]) for p in Path(directory).glob("cx_*.json")] if Path(directory).exists() else []
    return (max(existing) + 1) if existing else 1


def run_verification(profile="demo", seed=DEFAULT_SEED, mutation=None, on_event=noop, run_dir=None, binary=None, decisions=None):
    if profile not in PROFILES:
        raise ValueError("unknown profile")
    cfg = PROFILES[profile]
    run_id = "run_" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S") + "_" + uuid.uuid4().hex[:6]
    run_dir = Path(run_dir) if run_dir else EVIDENCE / "runs" / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    started = time.time()
    report = {
        "run_id": run_id,
        "profile": profile,
        "seed": seed,
        "mutation": mutation,
        "corpus_version": CORPUS_VERSION,
        "verdict": "NOT RUN",
        "limitations": LIMITATIONS,
    }

    on_event({"type": "build", "message": "building legacy program"})
    try:
        built = runner.build()
    except runner.OracleError as exc:
        report.update(verdict="BUILD FAILED", error={"code": exc.code, "message": str(exc), "detail": exc.detail})
        on_event({"type": "verdict", "verdict": "BUILD FAILED"})
        write_report(run_dir, report)
        return report
    binary = binary or built.binary
    report.update(
        compiler=built.compiler_version,
        source_hash=built.source_hash,
        twin_hash=twin_hash(),
        build_log=built.log,
    )
    on_event({"type": "built", "compiler": built.compiler_version, "source_hash": built.source_hash})

    regression = [cx["input_record"] for cx in counterexamples.load_all(GLOBAL_CX) if not cx.get("mutation")]
    fixed_families = [
        ("golden", corpus.golden()),
        ("boundary", corpus.boundary()),
        ("invalid", corpus.invalid_fixed()),
        ("regression", regression),
    ]
    planned_fixed = sum(len(r) for _, r in fixed_families)
    batches_total = cfg["random_batches"]
    state = {"cases": 0, "matched": 0, "seen": {}, "families": {}, "batches_done": 0}

    generated = []

    def collect(batch):
        generated.append(batch)

    collector = given(corpus.record_batches(cfg["batch_size"]))(collect)
    collector = hyp_seed(seed)(collector)
    collector = settings(
        max_examples=batches_total,
        database=None,
        deadline=None,
        phases=[Phase.generate],
        suppress_health_check=list(HealthCheck),
    )(collector)
    collector()
    planned_cases = planned_fixed + sum(len(b) for b in generated)
    on_event({"type": "planned", "planned": planned_cases})

    def process(family, records):
        oracle_lines = runner.run_batch(records, binary)
        twin_lines = calculator.calc_batch(records, mutation)
        comps = compare_batch(records, oracle_lines, twin_lines)
        bad = mismatches(comps)
        fam = state["families"].setdefault(family, {"cases": 0, "mismatches": 0})
        fam["cases"] += len(records)
        fam["mismatches"] += len(bad)
        state["cases"] += len(records)
        state["matched"] += len(records) - len(bad)
        for comp in bad:
            sig = counterexamples.signature(comp)
            if sig not in state["seen"]:
                state["seen"][sig] = (family, comp)
                on_event({"type": "mismatch", "class": sig, "family": family, "record": comp.record})
        return len(bad)

    try:
        for family, records in fixed_families:
            for part in chunks(records, runner.BATCH_LIMIT):
                process(family, part)
            on_event(progress(state, planned_cases, family))
        for index, batch in enumerate(generated, 1):
            state["batches_done"] = index
            process("property", batch)
            if index % 5 == 0 or index == len(generated):
                on_event(progress(state, planned_cases, "property"))
    except runner.OracleError as exc:
        report.update(verdict="RUNTIME ERROR", error={"code": exc.code, "message": str(exc), "detail": exc.detail})
        on_event({"type": "verdict", "verdict": "RUNTIME ERROR"})
        write_report(run_dir, report)
        return report

    cx_dir_local = run_dir / "counterexamples"
    known = {}
    if not mutation:
        known = {cx["class"]: cx["id"] for cx in counterexamples.load_all(GLOBAL_CX) if not cx.get("mutation")}
    next_number = next_cx_number(GLOBAL_CX) if not mutation else 1
    saved = []
    for sig, (family, comp) in sorted(state["seen"].items()):
        on_event({"type": "shrinking", "class": sig})
        minimal = shrink(sig, comp, cfg["shrink_examples"], seed, mutation, binary)
        if sig in known:
            cx_id = known[sig]
        else:
            cx_id = ("mx_%04d" if mutation else "cx_%04d") % next_number
            next_number += 1
        payload = counterexamples.to_payload(cx_id, seed, minimal, sig)
        payload["family"] = family
        payload["mutation"] = mutation
        counterexamples.save(cx_dir_local, payload)
        if not mutation:
            try:
                counterexamples.save(GLOBAL_CX, payload)
            except OSError:
                pass
        saved.append(payload)
        on_event({"type": "counterexample", "counterexample": payload})

    all_decisions = decisions if decisions is not None else decision_store.load()
    observed = sorted(state["seen"])
    missing = decision_store.uncovered(observed, all_decisions)
    mismatch_total = state["cases"] - state["matched"]
    if mismatch_total:
        verdict = "MISMATCH"
    elif profile == "full":
        verdict = "APPROVAL REQUIRED"
    else:
        verdict = "MATCH"
    report.update(
        verdict=verdict,
        cases=state["cases"],
        planned=planned_cases,
        matched=state["matched"],
        mismatched=mismatch_total,
        families=state["families"],
        classes=observed,
        counterexample_ids=[c["id"] for c in saved],
        decision_coverage={"observed": observed, "undecided": missing},
        seconds=round(time.time() - started, 2),
    )
    write_report(run_dir, report)
    on_event({"type": "verdict", "verdict": verdict, "cases": state["cases"], "matched": state["matched"]})
    return report


def progress(state, planned, family):
    return {
        "type": "progress",
        "family": family,
        "cases": state["cases"],
        "matched": state["matched"],
        "planned": planned,
        "mismatched": state["cases"] - state["matched"],
    }


def shrink(sig, comp, examples, seed, mutation, binary):
    import random

    def predicate(record):
        try:
            lines = runner.run_batch([record], binary)
        except runner.OracleError:
            return False
        twin = calculator.calc_batch([record], mutation)
        one = compare_one(record, lines[0], twin[0])
        return (not one.matches) and counterexamples.signature(one) == sig

    try:
        record = find(
            corpus.mixed_records(),
            predicate,
            settings=settings(
                max_examples=examples,
                database=None,
                deadline=None,
                suppress_health_check=list(HealthCheck),
            ),
            random=random.Random(seed),
        )
    except NoSuchExample:
        return comp
    lines = runner.run_batch([record], binary)
    twin = calculator.calc_batch([record], mutation)
    return compare_one(record, lines[0], twin[0])


def write_report(run_dir, report):
    (Path(run_dir) / "report.json").write_text(json.dumps(report, indent=2) + "\n")
