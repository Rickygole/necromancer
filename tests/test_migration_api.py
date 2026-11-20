import hashlib
import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from migration import service
from oracle import runner

FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture()
def candidates(tmp_path, monkeypatch):
    entries = []
    for cid, name in (("exact", "migration_exact.py"), ("rounding", "migration_rounding.py")):
        target = tmp_path / ("%s.py" % cid)
        shutil.copy(FIXTURES / name, target)
        entries.append({
            "id": cid,
            "label": cid,
            "file": target.name,
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "note": "fixture",
        })
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"candidates": entries}))
    monkeypatch.setattr(service, "CANDIDATES", tmp_path)
    monkeypatch.setattr(service, "MANIFEST", manifest)
    monkeypatch.setattr(service, "RANDOM_CASES", 200)
    return tmp_path


@pytest.fixture()
def client():
    return TestClient(app)


def test_listing_returns_source_and_task(candidates, client):
    body = client.get("/api/migration").json()
    assert {c["id"] for c in body["candidates"]} == {"exact", "rounding"}
    assert "def compute_interest" in body["candidates"][0]["source"]
    assert "1300-COMPUTE-INTEREST" in body["task"]


def test_listing_without_manifest_is_not_found(tmp_path, monkeypatch, client):
    monkeypatch.setattr(service, "MANIFEST", tmp_path / "missing.json")
    assert client.get("/api/migration").status_code == 404


def test_unknown_candidate_is_rejected(candidates, client):
    res = client.post("/api/migration/verify", json={"candidate": "../../etc/passwd"})
    assert res.status_code == 400


def test_tampered_candidate_is_refused(candidates, client):
    (candidates / "exact.py").write_text("def compute_interest(a, b, c):\n    return a, b\n")
    res = client.post("/api/migration/verify", json={"candidate": "exact"})
    assert res.status_code == 500
    assert "hash" in res.json()["error"]["message"]


def test_verify_runs_the_live_oracle(candidates, client):
    clean = client.post("/api/migration/verify", json={"candidate": "exact"}).json()
    assert clean["mismatched"] == 0
    red = client.post("/api/migration/verify", json={"candidate": "rounding"}).json()
    assert red["mismatched"] > 0
    assert red["counterexamples"]


def test_no_oracle_is_an_error_not_a_replay(candidates, client, monkeypatch):
    monkeypatch.setattr(service, "PREBUILT", candidates / "none")
    monkeypatch.setattr(runner, "cobc_command", lambda: "/nonexistent/cobc")
    res = client.post("/api/migration/verify", json={"candidate": "exact"})
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "ORACLE_UNAVAILABLE"
    assert "snapshot" not in json.dumps(res.json())
