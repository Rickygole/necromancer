import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = json.loads((ROOT / "evidence" / "snapshot.json").read_text())
SCORE = json.loads((ROOT / "evidence" / "mutation_score.json").read_text())
README = (ROOT / "README.md").read_text()
RUNS = SNAPSHOT["runs"]


def test_story_counts_equal_run_counts():
    assert set(SNAPSHOT["story"]) == set(RUNS)
    for name, story in SNAPSHOT["story"].items():
        run = RUNS[name]
        for key in ("run_id", "profile", "verdict", "cases", "matched", "mismatched", "seed", "mutation"):
            assert story[key] == run[key], (name, key)


def test_matched_plus_mismatched_equals_cases():
    for name, run in RUNS.items():
        assert run["matched"] + run["mismatched"] == run["cases"], name


def test_planned_equals_cases():
    for name, run in RUNS.items():
        assert run["planned"] == run["cases"], name
    assert SNAPSHOT["planned"] == SNAPSHOT["cases"]


def test_top_level_matches_injected_run():
    injected = RUNS["injected"]
    for key in ("run_id", "cases", "matched", "mismatched", "verdict", "mutation"):
        assert SNAPSHOT[key] == injected[key]


def test_injected_run_uses_m4_and_only_mx_counterexamples():
    injected = RUNS["injected"]
    assert injected["mutation"] == "M4"
    assert injected["counterexample_ids"]
    assert all(i.startswith("mx_") for i in injected["counterexample_ids"])
    assert all(c["id"].startswith("mx_") for c in SNAPSHOT["counterexamples"])


def test_baseline_and_after_patch_have_no_mismatches():
    for name in ("baseline", "after_patch"):
        assert RUNS[name]["mismatched"] == 0, name
        assert RUNS[name]["counterexample_ids"] == [], name


def test_limitations_mention_crlf_coverage():
    for run in list(RUNS.values()) + [SNAPSHOT]:
        assert any("CRLF" in text for text in run["limitations"])


def test_mutation_score_totals():
    assert SCORE["baseline_mismatches"] == 0
    assert SCORE["named_total"] == 5
    assert SCORE["named_caught"] == 5
    assert SCORE["hidden_total"] == 5
    assert SCORE["hidden_caught"] == 5
    assert len(SCORE["named"]) == SCORE["named_total"]
    assert len(SCORE["hidden"]) == SCORE["hidden_total"]


def test_readme_quotes_the_evidence_case_counts():
    counts = [RUNS["baseline"]["cases"], RUNS["after_patch"]["cases"], SCORE["cases"]]
    assert counts == [3291, 41260, 4090]
    for count in counts:
        assert format(count, ",") in README
