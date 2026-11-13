from harness.records import Claim, encode_claim
from oracle.runner import ROOT
from oracle_mcp.server import compile_cobol, parse_record, probe, run_oracle

GOOD = encode_claim(Claim(q1=500000, q2=500000, q3=500000, q4=500000))
GOOD_TWO = encode_claim(Claim(claimant_id="CLM000002", q1=300000, q2=300000, q3=300000, q4=300000, dependents=2))

SNIPPET = """IDENTIFICATION DIVISION.
PROGRAM-ID. HELLO.
PROCEDURE DIVISION.
    DISPLAY "hi".
    STOP RUN.
"""


def test_run_oracle_valid_records():
    out = run_oracle([GOOD, GOOD_TWO])
    assert out["ok"]
    assert len(out["results"]) == 2
    assert all(len(line) == 40 for line in out["results"])


def test_run_oracle_rejects_bad_length():
    out = run_oracle([GOOD, "short"])
    assert not out["ok"]
    assert "record 1" in out["error"]


def test_run_oracle_rejects_empty_and_oversized():
    assert not run_oracle([])["ok"]
    assert not run_oracle([GOOD] * 201)["ok"]


def test_parse_input_record():
    out = parse_record(GOOD)
    assert out["kind"] == "input"
    assert out["fields"]["claimant_id"] == "CLM000001"
    assert out["amounts"]["q1"] == "5000.00"
    assert out["amounts"]["pension"] == "0.00"


def test_parse_output_line():
    line = run_oracle([GOOD])["results"][0]
    out = parse_record(line)
    assert out["kind"] == "output"
    assert set(out["amounts"]) == {"base", "allowance", "offset", "net"}
    assert out["amounts"]["base"] == f"{int(line[2:9]) / 100:.2f}"


def test_parse_wrong_length():
    assert not parse_record("12345")["ok"]


def test_compile_cobol_ok():
    out = compile_cobol(str(ROOT / "legacy" / "UICALC.cbl"))
    assert out["ok"], out["log"]


def test_compile_cobol_rejects_outside_repo(tmp_path):
    source = tmp_path / "x.cbl"
    source.write_text(SNIPPET)
    out = compile_cobol(str(source))
    assert not out["ok"]
    assert "outside" in out["log"]


def test_probe_runs_snippet():
    out = probe(SNIPPET)
    assert out["ok"]
    assert out["lines"] == ["hi"]


def test_probe_reports_compile_failure():
    assert not probe("not cobol")["ok"]
