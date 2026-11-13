import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from backend import store
from harness import decisions as decision_store
from harness import engine

CHANNELS = {}
LOCK = threading.Lock()


class Channel:
    def __init__(self):
        self.events = []
        self.done = False
        self.lock = threading.Lock()

    def push(self, event, final=False):
        with self.lock:
            self.events.append(dict(event, seq=len(self.events)))
            if final:
                self.done = True

    def since(self, index):
        with self.lock:
            return self.events[index:], self.done


def new_run_id():
    return "run_" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S") + "_" + uuid.uuid4().hex[:6]


def channel(run_id):
    with LOCK:
        return CHANNELS.get(run_id)


def run_dir(run_id):
    return engine.EVIDENCE / "runs" / run_id


def execute(run_id, profile, seed, mutation, chan):
    def on_event(event):
        chan.push(event, final=event.get("type") == "verdict")

    try:
        known = decision_store.load(decision_store.DECISIONS_DIR)
        report = engine.run_verification(
            profile, seed, mutation, on_event, run_dir=run_dir(run_id), decisions=known
        )
        report["run_id"] = run_id
        (run_dir(run_id) / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        store.finish_run(run_id, "done", report.get("verdict"), report)
    except Exception as exc:
        report = {
            "run_id": run_id,
            "profile": profile,
            "seed": seed,
            "mutation": mutation,
            "verdict": "RUNTIME ERROR",
            "error": {"code": "RUNTIME_ERROR", "message": str(exc), "detail": {"type": type(exc).__name__}},
        }
        store.finish_run(run_id, "error", "RUNTIME ERROR", report)
        if not chan.done:
            chan.push({"type": "verdict", "verdict": "RUNTIME ERROR"}, final=True)


def start(profile, seed, mutation):
    run_id = new_run_id()
    store.create_run(run_id, profile, seed, mutation)
    chan = Channel()
    with LOCK:
        CHANNELS[run_id] = chan
    thread = threading.Thread(target=execute, args=(run_id, profile, seed, mutation, chan), daemon=True)
    thread.start()
    return run_id


def counterexamples(run_id):
    directory = run_dir(run_id) / "counterexamples"
    if not directory.exists():
        return []
    out = []
    for path in sorted(directory.glob("cx_*.json")):
        out.append(json.loads(Path(path).read_text()))
    return out
