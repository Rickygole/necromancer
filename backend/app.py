import asyncio
import json
import os
import re
import shutil
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from backend import errors, patches, runs, store
from harness import decisions as decision_store
from harness.profiles import DEFAULT_SEED, PROFILES
from modern.mutations import MUTATIONS
from oracle import runner

VERSION = "0.1.0"
ROOT = runner.ROOT
APPROVABLE = "APPROVAL REQUIRED"

app = FastAPI(title="Necromancer", version=VERSION)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
errors.install(app)


class RunRequest(BaseModel):
    profile: str
    seed: Optional[int] = None
    mutation: Optional[str] = None
    use_demo_config: bool = False


class DecisionRequest(BaseModel):
    class_: str
    field: str
    counterexample_ids: List[str]
    options_considered: List[str]
    choice: Literal["preserve", "correct"]
    reviewer: str
    note: str = ""


class ApprovalRequest(BaseModel):
    approved: bool
    reviewer: str
    note: str = ""


class InjectRequest(BaseModel):
    mutation: Optional[str] = None


def hosted():
    return os.environ.get("NECRO_HOSTED") == "1"


def oracle_available():
    command = runner.cobc_command()
    return bool(Path(command).exists() or shutil.which(command))


def bad(message, detail=None):
    return errors.ApiError("BAD_REQUEST", message, detail)


def check_mutation(mutation):
    if mutation is not None and mutation not in MUTATIONS:
        raise bad("unknown mutation", {"mutation": mutation, "known": sorted(MUTATIONS)})


def require_run(run_id):
    row = store.get_run(run_id)
    if row is None:
        raise errors.ApiError("NOT_FOUND", "no such run", {"run_id": run_id})
    return row


def start_run(profile, seed, mutation):
    if profile not in PROFILES:
        raise bad("unknown profile", {"profile": profile, "known": sorted(PROFILES)})
    check_mutation(mutation)
    if hosted() and not oracle_available():
        raise errors.ApiError(
            "RUNTIME_ERROR",
            "the legacy compiler is not available on this host, see /api/snapshot for the pre-rendered result",
            {"snapshot": "/api/snapshot"},
        )
    return runs.start(profile, DEFAULT_SEED if seed is None else seed, mutation)


def summary(row):
    report = row.get("report") or {}
    return {
        "run_id": row["id"],
        "profile": row["profile"],
        "seed": row["seed"],
        "mutation": row["mutation"],
        "status": row["status"],
        "verdict": row["verdict"],
        "cases": report.get("cases"),
        "mismatched": report.get("mismatched"),
        "created_at": row["created_at"],
    }


@app.get("/api/health")
def health():
    version = None
    if oracle_available():
        try:
            version = runner.compiler_version()
        except runner.OracleError:
            version = None
    return {
        "app_version": VERSION,
        "compiler_version": version,
        "oracle_available": version is not None,
        "hosted": hosted(),
    }


@app.get("/api/mutations")
def list_mutations():
    return [{"id": key, **value} for key, value in sorted(MUTATIONS.items())]


@app.post("/api/runs")
def create_run(req: RunRequest):
    mutation = req.mutation
    if mutation is None and req.use_demo_config:
        mutation = patches.read_config().get("mutation")
    return {"run_id": start_run(req.profile, req.seed, mutation)}


@app.get("/api/runs")
def recent_runs():
    return [summary(r) for r in store.list_runs()]


@app.get("/api/runs/{run_id}/events")
async def run_events(run_id: str):
    row = require_run(run_id)
    chan = runs.channel(run_id)

    async def stream():
        if chan is None:
            report = row.get("report") or {}
            yield {"event": "verdict", "data": json.dumps({"type": "verdict", "verdict": row["verdict"] or "NOT RUN", "cases": report.get("cases"), "matched": report.get("matched")})}
            return
        index = 0
        while True:
            batch, done = chan.since(index)
            for event in batch:
                yield {"event": event["type"], "data": json.dumps(event)}
            index += len(batch)
            if done and not batch:
                return
            if not batch:
                await asyncio.sleep(0.05)

    return EventSourceResponse(stream())


@app.get("/api/runs/{run_id}/counterexamples")
def run_counterexamples(run_id: str):
    require_run(run_id)
    items = runs.counterexamples(run_id)
    return {"counterexamples": items, "classes": sorted({c["class"] for c in items})}


@app.post("/api/runs/{run_id}/approval")
def approve(run_id: str, req: ApprovalRequest):
    row = require_run(run_id)
    allowed = row["verdict"] == APPROVABLE or (row["verdict"] == "MATCH" and row["profile"] == "full")
    if not allowed:
        raise bad("run is not awaiting approval", {"verdict": row["verdict"], "profile": row["profile"]})
    if not req.reviewer.strip():
        raise bad("reviewer is required")
    return store.add_approval(run_id, req.approved, req.reviewer, req.note, hosted())


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    row = require_run(run_id)
    report = row.get("report") or {}
    out = {
        "run_id": row["id"],
        "status": row["status"],
        "verdict": row["verdict"],
        "created_at": row["created_at"],
        **{k: v for k, v in report.items() if k not in ("run_id", "verdict")},
        "hashes": {"source": report.get("source_hash"), "twin": report.get("twin_hash")},
        "approval": store.get_approval(run_id),
    }
    out.setdefault("profile", row["profile"])
    out.setdefault("seed", row["seed"])
    out.setdefault("mutation", row["mutation"])
    return out


def next_decision_id(directory):
    numbers = [int(m.group(1)) for p in directory.glob("dec_*.json") if (m := re.fullmatch(r"dec_(\d+)", p.stem))]
    return "dec_%04d" % (max(numbers) + 1 if numbers else 1)


@app.post("/api/decisions")
def create_decision(payload: dict):
    try:
        req = DecisionRequest(
            class_=payload.get("class"),
            field=payload.get("field"),
            counterexample_ids=payload.get("counterexample_ids"),
            options_considered=payload.get("options_considered"),
            choice=payload.get("choice"),
            reviewer=payload.get("reviewer"),
            note=payload.get("note", ""),
        )
    except Exception as exc:
        raise bad("decision is not valid", {"problem": str(exc)})
    if not req.class_.strip() or not req.reviewer.strip():
        raise bad("class and reviewer are required")
    directory = Path(decision_store.DECISIONS_DIR)
    directory.mkdir(parents=True, exist_ok=True)
    record = None
    for _ in range(20):
        dec_id = next_decision_id(directory)
        record = {
            "id": dec_id,
            "class": req.class_,
            "field": req.field,
            "counterexample_ids": req.counterexample_ids,
            "options_considered": req.options_considered,
            "choice": req.choice,
            "reviewer": req.reviewer,
            "date": store.now()[:10],
            "note": req.note,
        }
        try:
            with open(directory / (dec_id + ".json"), "x") as handle:
                handle.write(json.dumps(record, indent=2) + "\n")
            return record
        except FileExistsError:
            continue
    raise errors.ApiError("RUNTIME_ERROR", "could not allocate a decision id")


@app.get("/api/decisions")
def list_decisions():
    return decision_store.load(decision_store.DECISIONS_DIR)


@app.post("/api/patches/{patch_id}/apply")
def apply_patch(patch_id: str):
    patches.patch_file(patch_id)
    if hosted() and not oracle_available():
        raise errors.ApiError(
            "RUNTIME_ERROR",
            "the legacy compiler is not available on this host, see /api/snapshot for the pre-rendered result",
            {"snapshot": "/api/snapshot"},
        )
    config = patches.apply_patch(patch_id)
    return {"run_id": start_run("full", None, config.get("mutation")), "config": config}


@app.post("/api/demo/inject")
def inject(req: InjectRequest):
    check_mutation(req.mutation)
    if hosted() and not oracle_available():
        raise errors.ApiError(
            "RUNTIME_ERROR",
            "the legacy compiler is not available on this host, see /api/snapshot for the pre-rendered result",
            {"snapshot": "/api/snapshot"},
        )
    config = patches.inject(req.mutation)
    return {"config": config}


@app.get("/api/snapshot")
def snapshot():
    path = ROOT / "evidence" / "snapshot.json"
    if not path.exists():
        raise errors.ApiError("NOT_FOUND", "no snapshot has been rendered")
    return json.loads(path.read_text())


@app.get("/api/patches")
def list_patches():
    return patches.list_ids()


DIST = ROOT / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="frontend")
