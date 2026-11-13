import json
from pathlib import Path

from harness.compare import trace_diff


def signature(comparison):
    fields = sorted(d.field for d in comparison.diffs if d.field != "trace")
    flipped = []
    t = trace_diff(comparison)
    if t["oracle"] and t["twin"] and len(t["oracle"]) == len(t["twin"]):
        flipped = [str(i + 1) for i, (a, b) in enumerate(zip(t["oracle"], t["twin"])) if a != b]
    return "+".join(fields) + ("|t" + ".".join(flipped) if flipped else "")


def class_slug(sig):
    return sig.replace("+", "-").replace("|", "-").replace(".", "_")


def to_payload(cx_id, seed, comparison, cls, decision=None):
    return {
        "id": cx_id,
        "seed": seed,
        "input_record": comparison.record,
        "oracle_output": comparison.oracle_output,
        "twin_output": comparison.twin_output,
        "diff": [{"field": d.field, "oracle": d.oracle, "twin": d.twin} for d in comparison.diffs],
        "trace_diff": trace_diff(comparison),
        "class": cls,
        "decision": decision,
    }


def save(directory, payload):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / (payload["id"] + ".json")
    path.write_text(json.dumps(payload, indent=2) + "\n")
    return path


def load_all(directory):
    directory = Path(directory)
    if not directory.exists():
        return []
    return [json.loads(p.read_text()) for p in sorted(directory.glob("cx_*.json"))]
