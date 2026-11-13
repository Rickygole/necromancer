import json
from pathlib import Path

from oracle.runner import ROOT

DECISIONS_DIR = ROOT / "decisions"


def load(directory=DECISIONS_DIR):
    directory = Path(directory)
    out = []
    if directory.exists():
        for path in sorted(directory.glob("dec_*.json")):
            out.append(json.loads(path.read_text()))
    return out


def decided_classes(decisions):
    return {d["class"] for d in decisions}


def uncovered(observed_classes, decisions):
    return sorted(set(observed_classes) - decided_classes(decisions))
