import json
from pathlib import Path

import pytest

from harness.report import (
    CARDDEMO_KEYS,
    MUTATION_KEYS,
    SNAPSHOT_KEYS,
    ReportError,
    load_evidence,
    load_required,
)

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "evidence" / "snapshot.json"
MUTATION = ROOT / "evidence" / "mutation_score.json"
CARDDEMO = ROOT / "case_studies" / "carddemo_interest" / "evidence" / "report.json"


def write_json(path, data):
    path.write_text(json.dumps(data))
    return path


def test_load_evidence_reads_all_three_recorded_files():
    snapshot, mutation, carddemo = load_evidence()
    assert set(SNAPSHOT_KEYS) <= set(snapshot)
    assert set(MUTATION_KEYS) <= set(mutation)
    assert set(CARDDEMO_KEYS) <= set(carddemo)


def test_load_required_missing_file_names_the_path(tmp_path):
    missing = tmp_path / "nope.json"
    with pytest.raises(ReportError) as exc:
        load_required(missing, ("seed",))
    assert "missing evidence file" in str(exc.value)
    assert str(missing) in str(exc.value)


def test_load_required_missing_key_names_the_file_and_key(tmp_path):
    path = write_json(tmp_path / "snap.json", {"seed": 1})
    with pytest.raises(ReportError) as exc:
        load_required(path, ("seed", "verdict"))
    assert "verdict" in str(exc.value)
    assert str(path) in str(exc.value)


def test_load_required_invalid_json_names_the_file(tmp_path):
    path = tmp_path / "bad.json"
    path.write_text("{not json")
    with pytest.raises(ReportError) as exc:
        load_required(path, ("seed",))
    assert str(path) in str(exc.value)


def test_load_evidence_missing_snapshot_file_fails_clearly(tmp_path):
    with pytest.raises(ReportError) as exc:
        load_evidence(tmp_path / "snap.json", MUTATION, CARDDEMO)
    assert "missing evidence file" in str(exc.value)
    assert "snap.json" in str(exc.value)


def test_load_evidence_missing_family_key_fails_clearly(tmp_path):
    good_snapshot = write_json(tmp_path / "snap.json", {
        "run_id": "r1",
        "seed": 1,
        "mutation": None,
        "compiler": "c",
        "verdict": "MATCH",
        "cases": 2,
        "matched": 2,
        "mismatched": 0,
    })
    good_mutation = write_json(tmp_path / "mut.json", {
        "seed": 1,
        "cases": 2,
        "baseline_mismatches": 0,
        "named": {"M1": 1},
        "named_caught": 1,
        "named_total": 1,
        "hidden": {"H1": 1},
        "hidden_caught": 1,
        "hidden_total": 1,
    })
    bad_carddemo = write_json(tmp_path / "cd.json", {
        "case_study": "carddemo_interest",
        "seed": 1,
        "compiler": "c",
        "cases": 2,
        "matched": 1,
        "mismatched": 1,
        "families": {"golden": {"cases": 1}},
    })
    with pytest.raises(ReportError) as exc:
        load_evidence(good_snapshot, good_mutation, bad_carddemo)
    assert "golden" in str(exc.value)
    assert "mismatches" in str(exc.value)


import re

from harness.report import CLOSING_LINE, build_report, relative_label


def sample_evidence():
    snapshot = {"run_id": "r1", "seed": 7, "mutation": "M4", "compiler": "cobc", "verdict": "MISMATCH",
                "cases": 10, "matched": 8, "mismatched": 2}
    mutation = {"seed": 7, "cases": 10, "baseline_mismatches": 0, "named": {"M1": 3},
                "named_caught": 1, "named_total": 1, "hidden": {"H1": 4},
                "hidden_caught": 1, "hidden_total": 1}
    carddemo = {"case_study": "cd", "seed": 7, "compiler": "cobc", "cases": 5, "matched": 4,
                "mismatched": 1, "families": {"golden": {"cases": 5, "mismatches": 1}}}
    return snapshot, mutation, carddemo


def test_build_report_has_sources_denominators_and_closing_line():
    snapshot, mutation, carddemo = sample_evidence()
    text = build_report(
        snapshot, relative_label(SNAPSHOT), mutation, relative_label(MUTATION), carddemo, relative_label(CARDDEMO)
    )
    assert "Source: evidence/snapshot.json" in text
    assert "Source: evidence/mutation_score.json" in text
    assert "Source: case_studies/carddemo_interest/evidence/report.json" in text
    assert "- Matched: 8 of 10" in text
    assert "- Named mutants caught: 1 of 1" in text
    assert "golden: 1 mismatches of 5 cases" in text
    assert text.rstrip("\n").endswith(CLOSING_LINE)
    assert "not a proof of equivalence" in CLOSING_LINE


def test_build_report_on_real_evidence_has_no_floats():
    snapshot, mutation, carddemo = load_evidence()
    text = build_report(snapshot, "a", mutation, "b", carddemo, "c")
    count_lines = [line for line in text.splitlines() if not line.startswith("- Compiler:")]
    assert not any(re.search(r"\d\.\d", line) for line in count_lines)
    assert text.count("Source:") == 3


def test_build_report_prints_injected_mutation():
    snapshot, mutation, carddemo = sample_evidence()
    text = build_report(snapshot, "a", mutation, "b", carddemo, "c")
    assert "- Injected mutation: M4" in text


def test_build_report_prints_none_for_null_mutation():
    snapshot, mutation, carddemo = sample_evidence()
    snapshot["mutation"] = None
    text = build_report(snapshot, "a", mutation, "b", carddemo, "c")
    assert "- Injected mutation: none" in text


def test_load_required_missing_mutation_key_names_file_and_key(tmp_path):
    snapshot, _, _ = sample_evidence()
    del snapshot["mutation"]
    path = write_json(tmp_path / "snap.json", snapshot)
    with pytest.raises(ReportError) as exc:
        load_required(path, SNAPSHOT_KEYS)
    assert "mutation" in str(exc.value)
    assert str(path) in str(exc.value)


def test_build_report_rejects_float_counts():
    snapshot, mutation, carddemo = sample_evidence()
    snapshot["cases"] = 10.0
    with pytest.raises(ReportError):
        build_report(snapshot, "a", mutation, "b", carddemo, "c")


import subprocess
import sys

import harness.report as report_module


def test_main_prints_report_and_returns_zero(capsys):
    assert report_module.main() == 0
    out = capsys.readouterr()
    assert out.out.rstrip("\n").endswith(CLOSING_LINE)
    assert out.err == ""


def test_main_missing_file_prints_stderr_only(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(report_module, "MUTATION_PATH", tmp_path / "gone.json")
    assert report_module.main() == 1
    out = capsys.readouterr()
    assert out.out == ""
    assert "gone.json" in out.err


def test_main_missing_key_prints_stderr_only(tmp_path, monkeypatch, capsys):
    bad = write_json(tmp_path / "snap.json", {"seed": 1})
    monkeypatch.setattr(report_module, "SNAPSHOT_PATH", bad)
    assert report_module.main() == 1
    out = capsys.readouterr()
    assert out.out == ""
    assert "snap.json" in out.err and "run_id" in out.err


def test_module_entry_point_exits_zero():
    result = subprocess.run(
        [sys.executable, "-m", "harness.report"], cwd=ROOT, capture_output=True, text=True
    )
    assert result.returncode == 0
    assert "Source: evidence/snapshot.json" in result.stdout
