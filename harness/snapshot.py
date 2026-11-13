import json
from pathlib import Path

from harness.engine import EVIDENCE, run_verification
from harness.profiles import DEFAULT_SEED
from modern.mutations import MUTATIONS

STORY_MUTATION = "M4"


def captured(profile, mutation, seed, run_dir):
    events = []
    report = run_verification(profile, seed, mutation, events.append, run_dir)
    cx_dir = Path(run_dir) / "counterexamples"
    cxs = [json.loads(p.read_text()) for p in sorted(cx_dir.glob("cx_*.json"))] if cx_dir.exists() else []
    return report, events, cxs


def build(profile="demo", seed=DEFAULT_SEED):
    scratch = EVIDENCE / "snapshot_runs"
    baseline, _, _ = captured(profile, None, seed, scratch / "baseline")
    injected, events, cxs = captured(profile, STORY_MUTATION, seed, scratch / "injected")
    fixed, _, _ = captured(profile, None, seed, scratch / "fixed")
    snapshot = dict(injected)
    snapshot["events"] = events
    snapshot["counterexamples"] = cxs
    snapshot["mutation_label"] = MUTATIONS[STORY_MUTATION]["label"]
    snapshot["story"] = {
        "baseline": {k: baseline.get(k) for k in ("run_id", "verdict", "cases", "matched", "mismatched", "seed")},
        "injected": {k: injected.get(k) for k in ("run_id", "verdict", "cases", "matched", "mismatched", "mutation")},
        "after_patch": {k: fixed.get(k) for k in ("run_id", "verdict", "cases", "matched", "mismatched", "seed")},
    }
    return snapshot


if __name__ == "__main__":
    out = EVIDENCE / "snapshot.json"
    out.write_text(json.dumps(build(), indent=2) + "\n")
    print(out)
