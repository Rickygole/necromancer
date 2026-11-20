import argparse
import hashlib
import importlib.util
import json
import random
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

from hypothesis import HealthCheck, find, settings, strategies as st
from hypothesis.errors import NoSuchExample

from case_studies.carddemo_interest import analysis, build, gen, twin
from case_studies.carddemo_interest.compare import compare_batch, compare_one
from case_studies.carddemo_interest.layout import Case, RESULT_LEN, decode, encode, signed_text, split_result
from case_studies.carddemo_interest.run import case_strategy, local_minimum, run_oracle
from harness import provider
from oracle import runner

ROOT = Path(__file__).resolve().parent
CANDIDATE = ROOT / "interest.py"
CENT = Decimal("0.01")
LIMIT = 10**11
RAISED = "RAISED      "
NOT_CENTS = "NOT CENTS   "
OUT_OF_RANGE = "OUT OF RANGE"
NOT_NUMBER = "NOT A NUMBER"

EXPLANATIONS = {
    "rounds_instead_of_truncating": "The COBOL has no ROUNDED phrase, so it drops the digits past the cent. The candidate rounds.",
    "monthly_overflow": "The monthly interest does not fit PIC S9(09)V99. The COBOL has no ON SIZE ERROR, so it keeps the low order digits.",
    "total_overflow": "The running total does not fit PIC S9(09)V99. The COBOL keeps the low order digits.",
    "raised": "The candidate raised an exception where the COBOL produced a value.",
    "not_in_cents": "The candidate returned a value with more than two decimal places.",
    "other": "A difference that none of the named causes explains.",
}


def sha256_of(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_candidate(path=CANDIDATE):
    path = Path(path)
    spec = importlib.util.spec_from_file_location("migration_candidate", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.compute_interest


def render(value):
    if not isinstance(value, Decimal):
        return NOT_NUMBER
    try:
        scaled = value / CENT
        whole = scaled.to_integral_value()
    except InvalidOperation:
        return NOT_NUMBER
    if scaled != whole:
        return NOT_CENTS
    number = int(whole)
    if abs(number) >= LIMIT:
        return OUT_OF_RANGE
    if number == 0 and value.is_signed():
        return "-" + "0" * 11
    return signed_text(number, 11)


def candidate_line(fn, record):
    case = decode(record)
    args = (Decimal(case.balance) * CENT, Decimal(case.rate) * CENT, Decimal(case.total) * CENT)
    try:
        monthly, total = fn(*args)
    except Exception:
        return (RAISED + RAISED).ljust(RESULT_LEN, ".")
    return (render(monthly) + render(total)).ljust(RESULT_LEN, ".")


def candidate_batch(fn, records):
    return [candidate_line(fn, r) for r in records]


def causes(comparison):
    case = decode(comparison.record)
    got = split_result(comparison.twin_output)
    want = split_result(comparison.oracle_output)
    exact = abs(case.balance) * abs(case.rate)
    monthly_raw = analysis.truncated_monthly(case)
    total_raw = case.total + analysis.stored_value(monthly_raw)
    flags = []
    if RAISED in (got["monthly"], got["total"]):
        return ["raised"]
    if NOT_CENTS in (got["monthly"], got["total"]):
        return ["not_in_cents"]
    if abs(monthly_raw) >= analysis.WRAP:
        flags.append("monthly_overflow")
    elif got["monthly"] != want["monthly"]:
        rounded = (exact + 60000) // analysis.UNITS_PER_CENT
        sign = analysis.sign_of(case.balance) * analysis.sign_of(case.rate)
        if got["monthly"] == signed_text(sign * rounded, 11) and want["monthly"] == signed_text(monthly_raw, 11):
            flags.append("rounds_instead_of_truncating")
    if abs(total_raw) >= analysis.WRAP:
        flags.append("total_overflow")
    return flags or ["other"]


def classify(comparison):
    if comparison.matches:
        return ""
    return "+".join(causes(comparison))


def shrink(sig, first, fn, binary, seed, seen):
    def line_for(record):
        line = seen.get(record)
        if line is None:
            line = runner.run_batch([record], binary)[0]
            seen[record] = line
        return line

    def compared(record):
        return compare_one(record, line_for(record), candidate_line(fn, record))

    def predicate(case):
        record = encode(case)
        try:
            one = compared(record)
        except runner.OracleError:
            return False
        return (not one.matches) and classify(one) == sig

    try:
        case = find(
            case_strategy(),
            predicate,
            settings=settings(
                max_examples=2000,
                database=None,
                deadline=None,
                backend=provider.BACKEND,
                suppress_health_check=list(HealthCheck),
            ),
            random=random.Random(seed),
        )
        shrunk = True
    except NoSuchExample:
        case = decode(first.record)
        shrunk = False
    case = local_minimum(case, predicate)
    return compared(encode(case)), shrunk


def counterexample(index, seed, comparison, sig, shrunk, count):
    case = decode(comparison.record)
    cents = Decimal(1) * CENT
    return {
        "id": "mg_%02d" % index,
        "class": sig,
        "explanation": " ".join(EXPLANATIONS.get(tag, tag) for tag in sig.split("+")),
        "seed": seed,
        "cases_in_class": count,
        "shrunk": shrunk,
        "input": {
            "balance": str(Decimal(case.balance) * cents),
            "annual_rate_percent": str(Decimal(case.rate) * cents),
            "total_interest": str(Decimal(case.total) * cents),
        },
        "input_record": comparison.record,
        "oracle_output": comparison.oracle_output,
        "candidate_output": comparison.twin_output,
        "diff": [{"field": d.field, "oracle": d.oracle, "candidate": d.twin} for d in comparison.diffs],
    }


def verify(candidate=CANDIDATE, seed=gen.DEFAULT_SEED, random_cases=2000, binary=None, shrink_classes=True):
    fn = load_candidate(candidate)
    compiler = None
    if binary is None:
        built = build.build()
        binary, compiler = built.binary, built.compiler_version
    families = gen.all_cases(random_cases, seed)
    flat = [record for _, records in families for record in records]
    oracle_lines = run_oracle(flat, binary)
    seen = dict(zip(flat, oracle_lines))
    comparisons = compare_batch(flat, oracle_lines, candidate_batch(fn, flat))
    classes = {}
    for comparison in comparisons:
        sig = classify(comparison)
        if sig:
            entry = classes.setdefault(sig, {"count": 0, "first": comparison})
            entry["count"] += 1
    found = []
    for index, sig in enumerate(sorted(classes), 1):
        first = classes[sig]["first"]
        if shrink_classes:
            minimal, shrunk = shrink(sig, first, fn, binary, seed, seen)
        else:
            minimal, shrunk = first, False
        found.append(counterexample(index, seed, minimal, sig, shrunk, classes[sig]["count"]))
    mismatched = sum(1 for c in comparisons if not c.matches)
    return {
        "candidate_sha256": sha256_of(candidate),
        "seed": seed,
        "cases": len(flat),
        "matched": len(flat) - mismatched,
        "mismatched": mismatched,
        "classes": {sig: classes[sig]["count"] for sig in sorted(classes)},
        "counterexamples": found,
        "compiler": compiler,
    }


def feedback(report):
    if report["mismatched"] == 0:
        return "A differential check against the compiled COBOL found no mismatch in %d cases. That is not a proof of equivalence." % report["cases"]
    lines = [
        "A differential check against the compiled COBOL found %d mismatches in %d cases." % (report["mismatched"], report["cases"]),
        "",
    ]
    for cx in report["counterexamples"]:
        lines.append("Class %s (%d cases). %s" % (cx["class"], cx["cases_in_class"], cx["explanation"]))
        lines.append("  input: %s" % json.dumps(cx["input"]))
        lines.append("  COBOL output:     %s" % cx["oracle_output"])
        lines.append("  your output:      %s" % cx["candidate_output"])
        lines.append("")
    lines.append("Update the design and the implementation so the function matches the COBOL on these, then say what you changed.")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", default=str(CANDIDATE))
    parser.add_argument("--random", type=int, default=2000)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    report = verify(Path(args.candidate), random_cases=args.random)
    report.pop("compiler", None)
    print(json.dumps(report, indent=2) if args.json else feedback(report))
    return 0 if report["mismatched"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
