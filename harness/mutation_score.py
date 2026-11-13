import json
import random

from harness import corpus
from harness.compare import compare_batch, mismatches
from modern import calculator
from modern.mutations import HIDDEN_MUTANTS, MUTATIONS
from oracle import runner

LEGACY = frozenset({"narrow_quotient", "unsigned_net", "offset_wrap"})


def cases(seed, batches, size):
    rng = random.Random(seed)
    records = corpus.golden() + corpus.boundary() + corpus.invalid_fixed()
    for _ in range(batches):
        records += corpus.random_valid_batch(rng, size)
    return records


def mismatch_count(records, mutation, binary):
    bad = 0
    for start in range(0, len(records), runner.BATCH_LIMIT):
        part = records[start:start + runner.BATCH_LIMIT]
        lines = runner.run_batch(part, binary)
        twin = calculator.calc_batch(part, mutation, LEGACY)
        bad += len(mismatches(compare_batch(part, lines, twin)))
    return bad


def score(seed=731942, batches=20, size=200, binary=None):
    binary = binary or runner.build().binary
    records = cases(seed, batches, size)
    baseline = mismatch_count(records, None, binary)
    caught = {}
    for mutation in MUTATIONS:
        caught[mutation] = mismatch_count(records, mutation, binary)
    hidden = {}
    for mutation in HIDDEN_MUTANTS:
        hidden[mutation] = mismatch_count(records, mutation, binary)
    return {
        "seed": seed,
        "cases": len(records),
        "baseline_mismatches": baseline,
        "named": caught,
        "named_caught": sum(1 for v in caught.values() if v > 0),
        "named_total": len(MUTATIONS),
        "hidden": hidden,
        "hidden_caught": sum(1 for v in hidden.values() if v > 0),
        "hidden_total": len(HIDDEN_MUTANTS),
    }


if __name__ == "__main__":
    print(json.dumps(score(), indent=2))
