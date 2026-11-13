import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from oracle.runner import ROOT

DEFAULT_DB = ROOT / "evidence" / "necromancer.sqlite3"

SCHEMA = """
create table if not exists runs (
    id text primary key,
    profile text not null,
    seed integer not null,
    mutation text,
    status text not null,
    verdict text,
    report_json text,
    created_at text not null
);
create table if not exists approvals (
    id integer primary key autoincrement,
    run_id text not null,
    verdict text not null,
    approved integer not null,
    reviewer text not null,
    note text not null,
    simulated integer not null,
    created_at text not null
);
"""


def db_path():
    return Path(os.environ.get("NECRO_DB") or DEFAULT_DB)


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect():
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def run_row(row):
    if row is None:
        return None
    out = dict(row)
    raw = out.pop("report_json")
    out["report"] = json.loads(raw) if raw else None
    return out


def create_run(run_id, profile, seed, mutation):
    with closing(connect()) as conn, conn:
        conn.execute(
            "insert into runs (id, profile, seed, mutation, status, verdict, report_json, created_at) values (?, ?, ?, ?, 'running', null, null, ?)",
            (run_id, profile, seed, mutation, now()),
        )


def finish_run(run_id, status, verdict, report):
    with closing(connect()) as conn, conn:
        conn.execute(
            "update runs set status = ?, verdict = ?, report_json = ? where id = ?",
            (status, verdict, json.dumps(report), run_id),
        )


def get_run(run_id):
    with closing(connect()) as conn:
        return run_row(conn.execute("select * from runs where id = ?", (run_id,)).fetchone())


def list_runs(limit=50):
    with closing(connect()) as conn:
        rows = conn.execute("select * from runs order by created_at desc, rowid desc limit ?", (limit,)).fetchall()
    return [run_row(r) for r in rows]


def add_approval(run_id, approved, reviewer, note, simulated):
    verdict = "APPROVED" if approved else "REJECTED"
    stamp = now()
    with closing(connect()) as conn, conn:
        conn.execute(
            "insert into approvals (run_id, verdict, approved, reviewer, note, simulated, created_at) values (?, ?, ?, ?, ?, ?, ?)",
            (run_id, verdict, int(approved), reviewer, note, int(simulated), stamp),
        )
    return approval_dict(run_id, verdict, approved, reviewer, note, simulated, stamp)


def approval_dict(run_id, verdict, approved, reviewer, note, simulated, created_at):
    out = {
        "run_id": run_id,
        "verdict": verdict,
        "approved": bool(approved),
        "reviewer": reviewer,
        "note": note,
        "created_at": created_at,
    }
    if simulated:
        out["simulated"] = True
    return out


def get_approval(run_id):
    with closing(connect()) as conn:
        row = conn.execute("select * from approvals where run_id = ? order by id desc limit 1", (run_id,)).fetchone()
    if row is None:
        return None
    return approval_dict(row["run_id"], row["verdict"], row["approved"], row["reviewer"], row["note"], row["simulated"], row["created_at"])
