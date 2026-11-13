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
    cxs = [json.loads(p.read_text()) for p in sorted(cx_dir.glob("*x_*.json"))] if cx_dir.exists() else []
    return report, events, cxs


def packed(report, events, cxs):
    out = dict(report)
    out["events"] = events
    out["counterexamples"] = cxs
    return out


def build(profile="demo", seed=DEFAULT_SEED):
    scratch = EVIDENCE / "snapshot_runs"
    baseline = packed(*captured(profile, None, seed, scratch / "baseline"))
    injected = packed(*captured(profile, STORY_MUTATION, seed, scratch / "injected"))
    fixed = packed(*captured("full", None, seed, scratch / "fixed"))
    snapshot = dict(injected)
    snapshot["mutation_label"] = MUTATIONS[STORY_MUTATION]["label"]
    snapshot["runs"] = {"baseline": baseline, "injected": injected, "after_patch": fixed}
    snapshot["story"] = {
        key: {k: run.get(k) for k in ("run_id", "profile", "verdict", "cases", "matched", "mismatched", "seed", "mutation")}
        for key, run in snapshot["runs"].items()
    }
    return snapshot


if __name__ == "__main__":
    out = EVIDENCE / "snapshot.json"
    out.write_text(json.dumps(build(), indent=2) + "\n")
    print(out)
