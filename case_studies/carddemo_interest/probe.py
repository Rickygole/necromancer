import json
import subprocess
import sys
from pathlib import Path

from case_studies.carddemo_interest import build, gen, twin
from case_studies.carddemo_interest.compare import compare_batch
from case_studies.carddemo_interest.run import CASE_DIR, EVIDENCE, run_oracle
from oracle import runner

PROBES = ["PRB1", "PRB2", "PRB3"]
TARGET = "COMPUTE WS-MONTHLY-INT"


def add_rounded(paragraph):
    if paragraph.count(TARGET) != 1:
        raise runner.BuildFailed("expected exactly one COMPUTE of WS-MONTHLY-INT")
    return paragraph.replace(TARGET, TARGET + " ROUNDED")


def run_probe(name, work):
    work.mkdir(parents=True, exist_ok=True)
    binary = work / name.lower()
    proc = subprocess.run(
        [runner.cobc_command(), "-x", "-o", str(binary), str(CASE_DIR / "probes" / (name + ".cbl"))],
        capture_output=True,
        text=True,
        timeout=120,
        env=runner.oracle_env(),
    )
    if proc.returncode != 0:
        raise runner.BuildFailed("probe compile failed", {"log": proc.stdout + proc.stderr})
    out = subprocess.run([str(binary)], capture_output=True, text=True, timeout=30, env=runner.oracle_env())
    return out.stdout.splitlines()


def rounded_counterfactual(seed, random_cases):
    built = build.build(CASE_DIR / "build_rounded", add_rounded)
    families = gen.all_cases(random_cases, seed)
    flat = [record for _, records in families for record in records]
    oracle_lines = run_oracle(flat, built.binary)
    comparisons = compare_batch(flat, oracle_lines, twin.calc_batch(flat))
    still = [c for c in comparisons if not c.matches]
    size_error = sum(
        1
        for c in still
        if twin.SIZE_ERROR in (c.twin_output[:12], c.twin_output[12:24])
    )
    return {
        "cases": len(flat),
        "mismatches_with_rounded_added": len(still),
        "of_which_twin_reports_size_error": size_error,
        "of_which_without_size_error": len(still) - size_error,
    }


def main(seed=gen.DEFAULT_SEED, random_cases=50000):
    work = CASE_DIR / "build_probes"
    results = {name: run_probe(name, work) for name in PROBES}
    results["rounded_counterfactual"] = rounded_counterfactual(seed, random_cases)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "probes.json").write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
