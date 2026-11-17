import json
from pathlib import Path

from case_studies.carddemo_interest import analysis, gen, layout, run as case_run, twin
from case_studies.carddemo_interest.compare import compare_one

EVIDENCE = Path(__file__).resolve().parent.parent / "case_studies" / "carddemo_interest" / "evidence"


def load_report():
    return json.loads((EVIDENCE / "report.json").read_text())


def test_recorded_report_counts_are_consistent():
    report = load_report()
    assert report["seed"] == 731942
    assert report["cases"] == report["matched"] + report["mismatched"]
    assert report["cases"] == sum(f["cases"] for f in report["families"].values())
    assert report["mismatched"] == sum(f["mismatches"] for f in report["families"].values())
    assert report["mismatched"] == sum(report["classes"].values())
    assert report["unexplained"] == 0
    assert report["cause_model_disagreements_with_oracle"] == 0
    assert report["compiler"].startswith("cobc (GnuCOBOL) 3.1.2")


def test_recorded_report_case_count_matches_the_generator():
    report = load_report()
    flat = [r for _, rs in gen.all_cases(case_run.RANDOM_CASES, report["seed"]) for r in rs]
    assert len(flat) == report["cases"]


def test_recorded_counterexamples_replay_without_the_compiler():
    report = load_report()
    assert report["counterexamples"]
    for cx in report["counterexamples"]:
        record = cx["input_record"]
        assert twin.calc(record) == cx["twin_output"]
        assert analysis.model_line(record) == cx["oracle_output"]
        comparison = compare_one(record, cx["oracle_output"], cx["twin_output"])
        assert not comparison.matches
        assert analysis.classify(comparison) == cx["class"]


def test_recorded_probes_show_the_documented_compiler_behavior():
    probes = json.loads((EVIDENCE / "probes.json").read_text())
    assert "plain +000000004.16 rounded +000000004.17" in probes["PRB1"][0]
    assert "compute without clause: +333324999.91" in probes["PRB2"]
    assert "add without clause: +000000004.15" in probes["PRB2"]
    assert "target left at: +999999999.99" in probes["PRB2"][-1]
    counterfactual = probes["rounded_counterfactual"]
    assert counterfactual["of_which_without_size_error"] == 0
