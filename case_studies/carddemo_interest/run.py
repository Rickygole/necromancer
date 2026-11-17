import argparse
import hashlib
import json
import random
import sys
from pathlib import Path

from hypothesis import HealthCheck, find, settings, strategies as st
from hypothesis.errors import NoSuchExample

from case_studies.carddemo_interest import analysis, build, gen, twin
from case_studies.carddemo_interest.compare import compare_batch, compare_one
from case_studies.carddemo_interest.layout import AMOUNT_DIGITS, Case, RATE_DIGITS, decode, encode
from harness import provider
from oracle import runner

CASE_DIR = Path(__file__).resolve().parent
EVIDENCE = CASE_DIR / "evidence"
RANDOM_CASES = 50000
SHRINK_EXAMPLES = 4000
CASE_STUDY_ID = "carddemo_interest"

LIMITATIONS = [
    "Evidence is over the generated and curated cases counted in this report, not a proof of equivalence.",
    "Only the pinned GnuCOBOL compiler version recorded here was exercised.",
    "The oracle is the verbatim paragraph 1300-COMPUTE-INTEREST inside a small harness wrapper, not the whole CBACT04C batch program.",
    "The wrapper supplies the value of WS-TOTAL-INT before the paragraph runs, so the accumulator and its ADD are covered but account breaks and file handling are not.",
    "A run that finds no mismatch means none were found, not that none exist.",
]


def sha256_of(*paths):
    digest = hashlib.sha256()
    for path in paths:
        digest.update(Path(path).name.encode())
        digest.update(Path(path).read_bytes())
    return digest.hexdigest()


def chunks(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def run_oracle(records, binary):
    lines = []
    for part in chunks(records, runner.BATCH_LIMIT):
        lines.extend(runner.run_batch(part, binary))
    return lines


def case_strategy():
    amount = st.integers(min_value=0, max_value=10**AMOUNT_DIGITS - 1)
    rate = st.integers(min_value=0, max_value=10**RATE_DIGITS - 1)
    sign = st.sampled_from([1, -1])
    return st.builds(
        lambda t, ts, b, bs, r, rs: Case(ts * t, bs * b, rs * r),
        amount, sign, amount, sign, rate, sign,
    )


FIELDS = ("total", "balance", "rate")


def reductions(value):
    out = [0]
    magnitude = abs(value)
    step = magnitude // 2
    while step > 0:
        out.append(magnitude - step)
        step //= 2
    if magnitude > 1:
        out.append(magnitude - 1)
    return out


def local_minimum(case, holds):
    changed = True
    while changed:
        changed = False
        for name in FIELDS:
            current = getattr(case, name)
            options = []
            if current < 0:
                options.append(abs(current))
            options.extend(reductions(current))
            for value in options:
                candidate = Case(**{**case.__dict__, name: value})
                if candidate != case and abs(value) <= abs(current) and holds(candidate):
                    case = candidate
                    changed = True
                    break
    return case


def shrink(sig, comparison, binary, seed, seen):
    def line_for(record):
        line = seen.get(record)
        if line is None:
            line = runner.run_batch([record], binary)[0]
            seen[record] = line
        return line

    def predicate(case):
        record = encode(case)
        try:
            line = line_for(record)
        except runner.OracleError:
            return False
        one = compare_one(record, line, twin.calc(record))
        return (not one.matches) and analysis.classify(one) == sig

    try:
        case = find(
            case_strategy(),
            predicate,
            settings=settings(
                max_examples=SHRINK_EXAMPLES,
                database=None,
                deadline=None,
                backend=provider.BACKEND,
                suppress_health_check=list(HealthCheck),
            ),
            random=random.Random(seed),
        )
        shrunk = True
    except NoSuchExample:
        case = decode(comparison.record)
        shrunk = False
    case = local_minimum(case, predicate)
    record = encode(case)
    return compare_one(record, line_for(record), twin.calc(record)), shrunk


def payload(index, seed, comparison, sig, shrunk, count):
    case = decode(comparison.record)
    return {
        "id": "cs_%02d" % index,
        "class": sig,
        "seed": seed,
        "cases_in_class": count,
        "shrunk": shrunk,
        "input_record": comparison.record,
        "input_values": {
            "initial_total_cents": case.total,
            "balance_cents": case.balance,
            "annual_rate_hundredths_of_percent": case.rate,
        },
        "oracle_output": comparison.oracle_output,
        "twin_output": comparison.twin_output,
        "diff": [{"field": d.field, "oracle": d.oracle, "twin": d.twin} for d in comparison.diffs],
    }


def run(seed=gen.DEFAULT_SEED, random_cases=RANDOM_CASES, out_dir=None, binary=None):
    built = build.build()
    binary = binary or built.binary
    families = gen.all_cases(random_cases, seed)
    flat = [record for _, records in families for record in records]
    oracle_lines = run_oracle(flat, binary)
    seen = dict(zip(flat, oracle_lines))
    twin_lines = twin.calc_batch(flat)
    comparisons = compare_batch(flat, oracle_lines, twin_lines)
    family_stats = {}
    cursor = 0
    for name, records in families:
        part = comparisons[cursor:cursor + len(records)]
        cursor += len(records)
        family_stats[name] = {"cases": len(records), "mismatches": sum(1 for c in part if not c.matches)}
    classes = {}
    for comparison in comparisons:
        sig = analysis.classify(comparison)
        if sig:
            entry = classes.setdefault(sig, {"count": 0, "first": comparison})
            entry["count"] += 1
    model_disagreements = sum(
        1 for record, line in zip(flat, oracle_lines) if analysis.model_line(record) != line
    )
    counterexamples = []
    for index, sig in enumerate(sorted(classes), 1):
        minimal, shrunk = shrink(sig, classes[sig]["first"], binary, seed, seen)
        counterexamples.append(payload(index, seed, minimal, sig, shrunk, classes[sig]["count"]))
    mismatched = sum(1 for c in comparisons if not c.matches)
    report = {
        "case_study": CASE_STUDY_ID,
        "seed": seed,
        "compiler": built.compiler_version,
        "wrapper_sha256": built.source_hash,
        "vendored_program_sha256": sha256_of(build.PROGRAM),
        "twin_sha256": sha256_of(CASE_DIR / "twin.py", CASE_DIR / "layout.py"),
        "cases": len(flat),
        "matched": len(flat) - mismatched,
        "mismatched": mismatched,
        "families": family_stats,
        "classes": {sig: classes[sig]["count"] for sig in sorted(classes)},
        "unexplained": classes.get("unexplained", {}).get("count", 0),
        "cause_model_disagreements_with_oracle": model_disagreements,
        "counterexamples": counterexamples,
        "limitations": LIMITATIONS,
    }
    target = Path(out_dir) if out_dir else EVIDENCE
    target.mkdir(parents=True, exist_ok=True)
    (target / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    return report


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=gen.DEFAULT_SEED)
    parser.add_argument("--random-cases", type=int, default=RANDOM_CASES)
    parser.add_argument("--out", default=None)
    args = parser.parse_args(argv)
    report = run(args.seed, args.random_cases, args.out)
    print(json.dumps({k: v for k, v in report.items() if k not in ("counterexamples", "limitations")}, indent=2))
    for cx in report["counterexamples"]:
        print(cx["id"], cx["class"], cx["input_values"], cx["oracle_output"][:24], cx["twin_output"][:24])
    return 0


if __name__ == "__main__":
    sys.exit(main())
