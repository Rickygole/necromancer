from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend import app as app_module
from backend import errors, patches
from oracle import runner

pytestmark = pytest.mark.skipif(not runner.oracle_ready(), reason="legacy oracle is not available")


@pytest.fixture
def hosted(monkeypatch):
    monkeypatch.setenv("NECRO_HOSTED", "1")
    return TestClient(app_module.app)


def error_of(response, code, status):
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    return body["error"]


def test_live_dev_returns_snapshot_shaped_body(hosted):
    response = hosted.post("/api/live", json={"profile": "dev"})
    assert response.status_code == 200
    body = response.json()
    for key in ("verdict", "cases", "matched", "events", "counterexamples"):
        assert key in body
    assert body["verdict"] == "MATCH"
    assert body["cases"] == body["matched"]
    assert body["cases"] > 0
    assert isinstance(body["counterexamples"], list)
    kinds = [e["type"] for e in body["events"]]
    assert "planned" in kinds
    assert "verdict" in kinds


def test_live_demo_m4_is_a_mismatch_with_undecided_counterexamples(hosted):
    response = hosted.post("/api/live", json={"profile": "demo", "mutation": "M4"})
    assert response.status_code == 200
    body = response.json()
    assert body["verdict"] == "MISMATCH"
    assert body["mismatched"] > 0
    assert body["cases"] == body["matched"] + body["mismatched"]
    assert body["counterexamples"]
    undecided = body["decision_coverage"]["undecided"]
    for cx in body["counterexamples"]:
        assert cx["id"].startswith("mx_")
    assert any(cx["class"] in undecided for cx in body["counterexamples"])


def test_family_cases_sum_to_cases_and_planned(hosted):
    body = hosted.post("/api/live", json={"profile": "dev"}).json()
    total = sum(f["cases"] for f in body["families"].values())
    assert total == body["cases"]
    assert total == body["planned"]


def test_full_profile_is_refused(hosted):
    error_of(hosted.post("/api/live", json={"profile": "full"}), "BAD_REQUEST", 400)


@pytest.mark.parametrize("seed", [-1, 2**31])
def test_out_of_range_seed_is_refused(hosted, seed):
    error_of(hosted.post("/api/live", json={"profile": "dev", "seed": seed}), "BAD_REQUEST", 400)


def test_unknown_mutation_is_refused(hosted):
    error_of(hosted.post("/api/live", json={"profile": "dev", "mutation": "M99"}), "BAD_REQUEST", 400)


def test_unknown_profile_is_refused(hosted):
    error_of(hosted.post("/api/live", json={"profile": "nope"}), "BAD_REQUEST", 400)


def test_busy_slots_return_retry(hosted):
    slots = app_module.LIVE_SLOTS
    assert slots.acquire(blocking=False)
    try:
        assert slots.acquire(blocking=False)
        try:
            error = error_of(hosted.post("/api/live", json={"profile": "dev"}), "RUNTIME_ERROR", 500)
            assert error["detail"]["retry"] is True
        finally:
            slots.release()
    finally:
        slots.release()


def test_run_creation_is_refused(hosted):
    error_of(hosted.post("/api/runs", json={"profile": "dev"}), "BAD_REQUEST", 400)


def test_decisions_are_refused(hosted):
    payload = {
        "class": "net",
        "field": "net",
        "counterexample_ids": ["mx_0001"],
        "options_considered": ["preserve", "correct"],
        "choice": "preserve",
        "reviewer": "tester",
    }
    error_of(hosted.post("/api/decisions", json=payload), "BAD_REQUEST", 400)


def test_approvals_are_simulated_and_stateless(hosted):
    run_id = "run_00000000000000_abcdef"
    response = hosted.post("/api/runs/" + run_id + "/approval", json={"approved": True, "reviewer": "tester"})
    assert response.status_code == 200
    body = response.json()
    assert body["simulated"] is True
    assert body["verdict"] == "APPROVED"
    assert hosted.get("/api/runs/" + run_id).status_code == 404
    assert hosted.get("/api/runs/" + run_id + "/counterexamples").status_code == 404
    rejected = hosted.post("/api/runs/" + run_id + "/approval", json={"approved": False, "reviewer": "tester"})
    assert rejected.json()["verdict"] == "REJECTED"


def test_approval_still_requires_a_reviewer(hosted):
    response = hosted.post("/api/runs/run_x/approval", json={"approved": True, "reviewer": "  "})
    error_of(response, "BAD_REQUEST", 400)


@pytest.mark.parametrize(
    "patch_id",
    ["../x", "..%2fx", "apply-M4/../../etc", "..%2f..%2fetc%2fpasswd", "%2e%2e/x", "apply-M4%2f..%2f..%2fetc"],
)
def test_patch_ids_with_traversal_never_touch_the_filesystem(hosted, monkeypatch, patch_id):
    def forbidden(*args, **kwargs):
        raise AssertionError("filesystem was read")

    monkeypatch.setattr(Path, "read_text", forbidden)
    monkeypatch.setattr(Path, "read_bytes", forbidden)
    monkeypatch.setattr(Path, "open", forbidden)
    response = hosted.post("/api/patches/" + patch_id + "/apply")
    assert response.status_code in (400, 404, 405)
    assert response.json()["error"]["code"] in ("NOT_FOUND", "BAD_REQUEST")


@pytest.mark.parametrize("patch_id", ["../x", "..%2fx", "apply-M4/../../etc", "apply-M4/..", "/etc/passwd", "apply-M4\x00"])
def test_patch_lookup_rejects_traversal_ids(monkeypatch, patch_id):
    def forbidden(*args, **kwargs):
        raise AssertionError("filesystem was read")

    monkeypatch.setattr(Path, "read_text", forbidden)
    with pytest.raises(errors.ApiError) as caught:
        patches.patch_file(patch_id)
    assert caught.value.code == "NOT_FOUND"
