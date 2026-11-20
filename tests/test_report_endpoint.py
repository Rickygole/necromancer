import pytest
from fastapi.testclient import TestClient

from backend import app as app_module
from harness import report as evidence_report


@pytest.fixture
def hosted(monkeypatch):
    monkeypatch.setenv("NECRO_HOSTED", "1")
    return TestClient(app_module.app)


@pytest.fixture
def client_off_host(monkeypatch):
    monkeypatch.delenv("NECRO_HOSTED", raising=False)
    return TestClient(app_module.app)


def expected_report():
    snapshot, mutation, carddemo = evidence_report.load_evidence()
    return evidence_report.build_report(
        snapshot,
        evidence_report.relative_label(evidence_report.SNAPSHOT_PATH),
        mutation,
        evidence_report.relative_label(evidence_report.MUTATION_PATH),
        carddemo,
        evidence_report.relative_label(evidence_report.CARDDEMO_PATH),
    )


def test_report_returns_the_markdown_from_the_recorded_files(hosted):
    response = hosted.get("/api/report")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    assert response.text == expected_report()
    assert response.text.startswith("# Necromancer evidence report")
    assert "- Injected mutation: M4" in response.text
    assert evidence_report.CLOSING_LINE in response.text


def test_report_is_cacheable_when_hosted(hosted):
    control = hosted.get("/api/report").headers["cache-control"]
    assert "max-age=60" in control
    assert "s-maxage=60" in control
    assert "stale-while-revalidate" not in control


def test_report_is_not_cached_off_host(client_off_host):
    response = client_off_host.get("/api/report")
    assert response.status_code == 200
    assert "cache-control" not in response.headers


def test_report_does_not_run_anything(hosted, monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("the report must not run the harness")

    monkeypatch.setattr(app_module.engine, "run_verification", refuse)
    assert hosted.get("/api/report").status_code == 200


def test_missing_evidence_file_is_a_503_without_server_paths(hosted, monkeypatch, tmp_path):
    monkeypatch.setattr(evidence_report, "CARDDEMO_PATH", tmp_path / "report.json")
    response = hosted.get("/api/report")
    assert response.status_code == 503
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == "EVIDENCE_UNAVAILABLE"
    assert str(tmp_path) not in body["error"]["message"]
    assert len(body["error"]["detail"]["missing"]) == 1


def test_report_refuses_post(hosted):
    response = hosted.post("/api/report", json={})
    assert response.status_code == 405
