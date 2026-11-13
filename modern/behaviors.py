import json
from pathlib import Path

DECISIONS_DIR = Path(__file__).resolve().parent.parent / "decisions"

CLASS_BEHAVIORS = {
    "base+net|t6.8": "narrow_quotient",
    "net": "unsigned_net",
    "net+offset": "offset_wrap",
}


def preserved(directory=None):
    directory = Path(directory) if directory else DECISIONS_DIR
    chosen = set()
    if not directory.exists():
        return frozenset()
    for path in sorted(directory.glob("dec_*.json")):
        record = json.loads(path.read_text())
        behavior = CLASS_BEHAVIORS.get(record.get("class"))
        if behavior and record.get("choice") == "preserve":
            chosen.add(behavior)
    return frozenset(chosen)
