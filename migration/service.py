import hashlib
import json
import threading
from pathlib import Path

from case_studies.carddemo_interest import build
from migration import verify
from oracle import runner

ROOT = Path(__file__).resolve().parent
CANDIDATES = ROOT / "candidates"
MANIFEST = CANDIDATES / "manifest.json"
TASK = ROOT / "TASK.md"
PREBUILT = runner.ROOT / "bin" / "intwrap"
PREBUILT_VERSION = runner.ROOT / "bin" / "INTWRAP_VERSION"
RANDOM_CASES = 2000
LOCK = threading.Lock()
CACHE = {}


class MigrationError(Exception):
    def __init__(self, code, message, detail=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail or {}


def load_manifest():
    if not MANIFEST.exists():
        raise MigrationError("NOT_FOUND", "no candidate translations have been recorded")
    return json.loads(MANIFEST.read_text())["candidates"]


def read_candidate(entry):
    path = CANDIDATES / entry["file"]
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != entry["sha256"]:
        raise MigrationError("RUNTIME_ERROR", "a candidate file does not match its recorded hash", {"id": entry["id"]})
    return path, data.decode()


def listing():
    items = []
    for entry in load_manifest():
        _, source = read_candidate(entry)
        items.append({**entry, "source": source})
    return {"task": TASK.read_text(), "candidates": items}


def oracle_binary():
    if PREBUILT.exists() and PREBUILT_VERSION.exists():
        return PREBUILT, PREBUILT_VERSION.read_text().strip()
    try:
        built = build.build()
    except runner.BuildFailed as exc:
        raise MigrationError("ORACLE_UNAVAILABLE", "the CardDemo oracle is not available on this host", {"reason": str(exc)})
    return built.binary, built.compiler_version


def run(candidate_id):
    entries = {entry["id"]: entry for entry in load_manifest()}
    if candidate_id not in entries:
        raise MigrationError("BAD_REQUEST", "unknown candidate", {"candidate": candidate_id, "known": sorted(entries)})
    path, source = read_candidate(entries[candidate_id])
    binary, compiler = oracle_binary()
    key = (candidate_id, hashlib.sha256(source.encode()).hexdigest(), RANDOM_CASES, compiler)
    if key in CACHE:
        return dict(CACHE[key])
    if not LOCK.acquire(blocking=False):
        raise MigrationError("BUSY", "a verification is already running, try again in a moment")
    try:
        report = verify.verify(path, random_cases=RANDOM_CASES, binary=binary, search=False)
    finally:
        LOCK.release()
    report["compiler"] = compiler
    report["candidate"] = candidate_id
    CACHE[key] = dict(report)
    return report
