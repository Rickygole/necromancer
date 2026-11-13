import json
import time

import pytest
from fastapi.testclient import TestClient

from backend import app as app_module
from backend import patches
from harness import decisions as decision_store
from harness import engine


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("NECRO_DB", str(tmp_path / "test.sqlite3"))
    monkeypatch.delenv("NECRO_HOSTED", raising=False)
    monkeypatch.setattr(decision_store, "DECISIONS_DIR", tmp_path / "decisions")
    monkeypatch.setattr(engine, "EVIDENCE", tmp_path / "evidence")
    monkeypatch.setattr(engine, "GLOBAL_CX", tmp_path / "evidence" / "counterexamples")
    monkeypatch.setattr(patches, "DEMO_DIR", tmp_path / "demo")
    return TestClient(app_module.app)


def wait_done(client, run_id, timeout=120):
    deadline = time.time() + timeout
    while time.time() < deadline:
        body = client.get("/api/runs/" + run_id).json()
        if body["status"] != "running":
            return body
        time.sleep(0.2)
    raise AssertionError("run did not finish")


def assert_error(response, code, status):
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "detail"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str)


def test_health(client):
    body = client.get("/api/health").json()
    assert set(body) == {"app_version", "compiler_version", "oracle_available", "hosted"}
    assert body["hosted"] is False
    assert isinstance(body["oracle_available"], bool)


def test_hosted_flag(client, monkeypatch):
    monkeypatch.setenv("NECRO_HOSTED", "1")
    assert client.get("/api/health").json()["hosted"] is True


def test_bad_profile(client):
    response = client.post("/api/runs", json={"profile": "nope"})
    assert_error(response, "BAD_REQUEST", 400)


def test_bad_mutation(client):
    response = client.post("/api/runs", json={"profile": "dev", "mutation": "M9"})
    assert_error(response, "BAD_REQUEST", 400)


def test_missing_profile_is_bad_request(client):
    assert_error(client.post("/api/runs", json={}), "BAD_REQUEST", 400)


def test_not_found_shapes(client):
    assert_error(client.get("/api/runs/run_missing"), "NOT_FOUND", 404)
    assert_error(client.get("/api/runs/run_missing/events"), "NOT_FOUND", 404)
    assert_error(client.get("/api/runs/run_missing/counterexamples"), "NOT_FOUND", 404)
    assert_error(client.post("/api/patches/nope/apply"), "NOT_FOUND", 404)
    assert_error(client.get("/api/nothing-here"), "NOT_FOUND", 404)


def test_hosted_without_compiler(client, monkeypatch):
    monkeypatch.setenv("NECRO_HOSTED", "1")
    monkeypatch.setattr(app_module, "oracle_available", lambda: False)
    response = client.post("/api/runs", json={"profile": "dev"})
    assert_error(response, "BAD_REQUEST", 400)
    live = client.post("/api/live", json={"profile": "dev"})
    assert_error(live, "RUNTIME_ERROR", 500)
    assert "/api/snapshot" in live.json()["error"]["message"]


def test_hosted_rejects_decision_writes(client, monkeypatch):
    monkeypatch.setenv("NECRO_HOSTED", "1")
    response = client.post("/api/decisions", json={"class": "net"})
    assert_error(response, "BAD_REQUEST", 400)


def test_mutations(client):
    body = client.get("/api/mutations").json()
    assert [m["id"] for m in body] == ["M1", "M2", "M3", "M4", "M5"]


def test_dev_run_streams_to_verdict(client):
    started = client.post("/api/runs", json={"profile": "dev"})
    assert started.status_code == 200
    run_id = started.json()["run_id"]
    events = []
    with client.stream("GET", "/api/runs/%s/events" % run_id) as stream:
        for line in stream.iter_lines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))
    assert events
    assert events[-1]["type"] == "verdict"
    assert sum(1 for e in events if e["type"] == "verdict") == 1
    final = wait_done(client, run_id)
    assert final["verdict"] == events[-1]["verdict"]
    assert final["run_id"] == run_id
    assert final["profile"] == "dev"
    assert "hashes" in final
    listed = client.get("/api/runs").json()
    assert run_id in [r["run_id"] for r in listed]
    cx = client.get("/api/runs/%s/counterexamples" % run_id).json()
    assert set(cx) == {"counterexamples", "classes"}


def test_approval_rejected_for_wrong_verdict(client):
    run_id = client.post("/api/runs", json={"profile": "dev"}).json()["run_id"]
    wait_done(client, run_id)
    response = client.post("/api/runs/%s/approval" % run_id, json={"approved": True, "reviewer": "r"})
    assert_error(response, "BAD_REQUEST", 400)


def decision_body(**changes):
    body = {
        "class": "net_payout",
        "field": "net",
        "counterexample_ids": ["cx_0001"],
        "options_considered": ["preserve", "correct"],
        "choice": "preserve",
        "reviewer": "reviewer one",
        "note": "kept legacy behavior",
    }
    body.update(changes)
    return body


def test_decisions_round_trip(client, tmp_path):
    assert client.get("/api/decisions").json() == []
    first = client.post("/api/decisions", json=decision_body())
    assert first.status_code == 200
    record = first.json()
    assert record["id"] == "dec_0001"
    assert record["class"] == "net_payout"
    assert set(record) == {"id", "class", "field", "counterexample_ids", "options_considered", "choice", "reviewer", "date", "note"}
    second = client.post("/api/decisions", json=decision_body(choice="correct")).json()
    assert second["id"] == "dec_0002"
    listed = client.get("/api/decisions").json()
    assert [d["id"] for d in listed] == ["dec_0001", "dec_0002"]
    assert (tmp_path / "decisions" / "dec_0001.json").exists()
    assert json.loads((tmp_path / "decisions" / "dec_0002.json").read_text())["choice"] == "correct"


def test_decision_validation(client):
    assert_error(client.post("/api/decisions", json=decision_body(choice="maybe")), "BAD_REQUEST", 400)
    assert_error(client.post("/api/decisions", json={"class": "x"}), "BAD_REQUEST", 400)


def test_inject_and_patch_use_real_diffs(client, monkeypatch):
    monkeypatch.setattr(app_module, "start_run", lambda profile, seed, mutation: "run_stub_" + str(mutation))
    injected = client.post("/api/demo/inject", json={"mutation": "M2"}).json()
    assert injected["config"] == {"mutation": "M2"}
    assert "run_id" not in injected
    assert json.loads((patches.DEMO_DIR / "twin.config.json").read_text()) == {"mutation": "M2"}
    assert_error(client.post("/api/patches/apply-M1/apply"), "BAD_REQUEST", 400)
    fixed = client.post("/api/patches/fix-M2/apply").json()
    assert fixed["config"] == {"mutation": None}
    again = client.post("/api/patches/apply-M1/apply").json()
    assert again["config"] == {"mutation": "M1"}


def test_use_demo_config(client, monkeypatch):
    seen = {}

    def fake(profile, seed, mutation):
        seen["mutation"] = mutation
        return "run_stub"

    monkeypatch.setattr(app_module.runs, "start", fake)
    patches.inject("M3")
    client.post("/api/runs", json={"profile": "dev"})
    assert seen["mutation"] is None
    client.post("/api/runs", json={"profile": "dev", "use_demo_config": True})
    assert seen["mutation"] == "M3"


def test_snapshot_missing_or_present(client):
    response = client.get("/api/snapshot")
    assert response.status_code in (200, 404)
    if response.status_code == 404:
        assert_error(response, "NOT_FOUND", 404)


def test_approval_flow_and_simulated_flag(client, monkeypatch):
    from backend import store

    store.create_run("run_x", "full", 1, None)
    store.finish_run("run_x", "done", "APPROVAL REQUIRED", {"verdict": "APPROVAL REQUIRED", "profile": "full"})
    plain = client.post("/api/runs/run_x/approval", json={"approved": True, "reviewer": "r", "note": "ok"}).json()
    assert plain["verdict"] == "APPROVED"
    assert "simulated" not in plain
    monkeypatch.setenv("NECRO_HOSTED", "1")
    hosted = client.post("/api/runs/run_x/approval", json={"approved": False, "reviewer": "r"}).json()
    assert hosted["verdict"] == "REJECTED"
    assert hosted["simulated"] is True
    assert client.get("/api/runs/run_x").json()["approval"]["verdict"] == "REJECTED"
