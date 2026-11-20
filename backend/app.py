import asyncio
import json
import os
import re
import tempfile
import threading
import time
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, StrictInt
from sse_starlette.sse import EventSourceResponse

from backend import errors, patches, runs, store
from harness import corpus_cache, engine
from harness import decisions as decision_store
from harness import report as evidence_report
from harness.profiles import DEFAULT_SEED, PROFILES
from migration import service as migration_service
from modern.mutations import MUTATIONS
from oracle import runner

VERSION = "0.1.0"
ROOT = runner.ROOT
APPROVABLE = "APPROVAL REQUIRED"

app = FastAPI(title="Necromancer", version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[] if os.environ.get("NECRO_HOSTED") == "1" else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
BODY_LIMIT = 64 * 1024


class BodyLimit:
    def __init__(self, inner, limit=BODY_LIMIT):
        self.inner = inner
        self.limit = limit

    async def refuse(self, send):
        payload = json.dumps(
            errors.body("BAD_REQUEST", "request body is larger than %d bytes" % self.limit, {"max_bytes": self.limit})
        ).encode()
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(payload)).encode())],
        })
        await send({"type": "http.response.body", "body": payload})

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            await self.inner(scope, receive, send)
            return
        declared = dict(scope["headers"]).get(b"content-length", b"")
        if declared.isdigit() and int(declared) > self.limit:
            await self.refuse(send)
            return
        chunks = []
        size = 0
        more = True
        while more:
            message = await receive()
            if message["type"] != "http.request":
                await self.inner(scope, receive, send)
                return
            chunk = message.get("body", b"")
            size += len(chunk)
            if size > self.limit:
                await self.refuse(send)
                return
            chunks.append(chunk)
            more = message.get("more_body", False)
        body = b"".join(chunks)
        sent = False

        async def replay():
            nonlocal sent
            if sent:
                return await receive()
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}

        await self.inner(scope, replay, send)


app.add_middleware(BodyLimit)
LIVE_SLOTS = threading.BoundedSemaphore(2)
LIVE_CACHE = {}
LIVE_CACHE_LOCK = threading.Lock()
LIVE_CACHE_SECONDS = 300
LIVE_CACHE_MAX = 16
RUN_ID = re.compile(r"^run_\d{14}_[0-9a-f]{6}$")
SEED_MAX = 2**31 - 1
STREAM_SECONDS = 180
errors.install(app)


class RunRequest(BaseModel):
    profile: str
    seed: Optional[StrictInt] = None
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
    return runner.oracle_ready()


def cached_json(payload):
    headers = {}
    if hosted():
        headers["Cache-Control"] = "public, max-age=60, s-maxage=60"
    return JSONResponse(payload, headers=headers)


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
            "the legacy compiler is not available on this host, so no run was made",
            {},
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


def corpus_cache_state():
    state = {}
    for name in corpus_cache.PRECOMPUTED_PROFILES:
        cfg = PROFILES[name]
        stored = corpus_cache.read_cache(corpus_cache.CACHE_DIR, cfg["random_batches"], cfg["batch_size"], DEFAULT_SEED)
        state[name] = stored is not None
    return state


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
        "corpus_cache": corpus_cache_state(),
    }


@app.get("/api/mutations")
def list_mutations():
    return [{"id": key, **value} for key, value in sorted(MUTATIONS.items())]


@app.post("/api/runs")
def create_run(req: RunRequest):
    if hosted():
        raise errors.ApiError("BAD_REQUEST", "use POST /api/live on the hosted build", {"live": "/api/live"})
    mutation = req.mutation
    if mutation is None and req.use_demo_config:
        mutation = patches.read_config().get("mutation")
    return {"run_id": start_run(req.profile, req.seed, mutation)}


@app.post("/api/live")
def live_run(req: RunRequest):
    if req.use_demo_config:
        raise bad(
            "use_demo_config is not supported on /api/live, the demo config is not read here, send an explicit mutation instead",
            {"use_demo_config": True, "send": "mutation"},
        )
    if req.profile not in PROFILES:
        raise bad("unknown profile", {"profile": req.profile, "known": sorted(PROFILES)})
    check_mutation(req.mutation)
    if not oracle_available():
        raise errors.ApiError(
            "RUNTIME_ERROR",
            "the legacy oracle is not available on this host, so no run was made",
            {},
        )
    events = []
    seed = DEFAULT_SEED if req.seed is None else req.seed
    if not 0 <= seed <= SEED_MAX:
        raise bad("seed out of range", {"max": SEED_MAX})
    if hosted() and req.profile == "full" and seed != DEFAULT_SEED:
        raise bad(
            "the hosted site runs the full profile with the published seed only",
            {"profile": "full", "seed": DEFAULT_SEED},
        )
    key = (req.profile, seed, req.mutation)
    now = time.monotonic()
    with LIVE_CACHE_LOCK:
        hit = LIVE_CACHE.get(key)
    if hit and now - hit[0] < LIVE_CACHE_SECONDS:
        return {**hit[1], "cached": True, "cached_age_seconds": int(now - hit[0])}
    if not LIVE_SLOTS.acquire(blocking=False):
        raise errors.ApiError("BUSY", "the oracle is busy, try again in a moment", {"retry": True})
    try:
        with tempfile.TemporaryDirectory(prefix="necro-live-") as scratch:
            report = engine.run_verification(
                req.profile, seed, req.mutation, events.append, run_dir=scratch,
                decisions=decision_store.load(decision_store.DECISIONS_DIR),
            )
            cx_dir = Path(scratch) / "counterexamples"
            found = [json.loads(p.read_text()) for p in sorted(cx_dir.glob("*x_*.json"))] if cx_dir.exists() else []
    finally:
        LIVE_SLOTS.release()
    result = dict(report)
    result["run_id"] = report.get("run_id") or runs.new_run_id()
    result["events"] = events
    result["counterexamples"] = found
    with LIVE_CACHE_LOCK:
        if len(LIVE_CACHE) >= LIVE_CACHE_MAX:
            LIVE_CACHE.clear()
        LIVE_CACHE[key] = (time.monotonic(), result)
    return result


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
        deadline = time.monotonic() + STREAM_SECONDS
        while time.monotonic() < deadline:
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
    if hosted():
        if not RUN_ID.match(run_id):
            raise errors.ApiError("NOT_FOUND", "no such run", {"run_id": run_id[:80]})
        if not req.reviewer.strip():
            raise bad("reviewer is required")
        return {
            "run_id": run_id,
            "verdict": "APPROVED" if req.approved else "REJECTED",
            "reviewer": req.reviewer.strip()[:80],
            "note": req.note[:500],
            "simulated": True,
        }
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
    if hosted():
        raise errors.ApiError("BAD_REQUEST", "decisions are recorded in the repository, not on the hosted build")
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
    path = patches.patch_file(patch_id)
    diff = path.read_text()
    if hosted():
        mutation = None if patch_id.startswith("fix-") else patch_id.split("-", 1)[1]
        return {"config": {"mutation": mutation}, "diff": diff}
    config = patches.apply_patch(patch_id)
    return {"run_id": start_run("full", None, config.get("mutation")), "config": config, "diff": diff}


@app.post("/api/demo/inject")
def inject(req: InjectRequest):
    check_mutation(req.mutation)
    diff = ""
    if req.mutation:
        diff = patches.patch_file("apply-" + req.mutation).read_text()
    if hosted():
        return {"config": {"mutation": req.mutation}, "diff": diff}
    config = patches.inject(req.mutation)
    return {"config": config, "diff": diff}


@app.get("/api/snapshot")
def snapshot():
    path = ROOT / "evidence" / "snapshot.json"
    if not path.exists():
        raise errors.ApiError("NOT_FOUND", "no snapshot has been rendered")
    return cached_json(json.loads(path.read_text()))


@app.get("/api/mutation-score")
def mutation_score():
    path = ROOT / "evidence" / "mutation_score.json"
    if not path.exists():
        raise errors.ApiError("NOT_FOUND", "no mutation score has been recorded")
    return cached_json(json.loads(path.read_text()))


class MigrationRequest(BaseModel):
    candidate: str


def migration_error(exc):
    return errors.ApiError(exc.code, exc.message, exc.detail)


@app.get("/api/migration")
def migration_listing():
    try:
        return cached_json(migration_service.listing())
    except migration_service.MigrationError as exc:
        raise migration_error(exc)


@app.post("/api/migration/verify")
def migration_verify(req: MigrationRequest):
    try:
        return migration_service.run(req.candidate)
    except migration_service.MigrationError as exc:
        raise migration_error(exc)


@app.get("/api/report")
def report():
    sources = (evidence_report.SNAPSHOT_PATH, evidence_report.MUTATION_PATH, evidence_report.CARDDEMO_PATH)
    try:
        snapshot, mutation, carddemo = evidence_report.load_evidence()
        text = evidence_report.build_report(
            snapshot,
            evidence_report.relative_label(sources[0]),
            mutation,
            evidence_report.relative_label(sources[1]),
            carddemo,
            evidence_report.relative_label(sources[2]),
        )
    except evidence_report.ReportError:
        missing = [evidence_report.relative_label(p) for p in sources if not Path(p).exists()]
        raise errors.ApiError(
            "EVIDENCE_UNAVAILABLE",
            "the evidence report could not be built from the recorded files on this host",
            {"missing": missing},
        )
    headers = {}
    if hosted():
        headers["Cache-Control"] = "public, max-age=60, s-maxage=60"
    return Response(text, media_type="text/markdown; charset=utf-8", headers=headers)


@app.get("/api/patches")
def list_patches():
    return patches.list_ids()


DIST = ROOT / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="frontend")
