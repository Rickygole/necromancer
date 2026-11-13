import json
from pathlib import Path

import pytest

from harness.compare import compare_batch, mismatches
from modern import calculator
from modern.behaviors import preserved
from modern.models import decode_record
from oracle import runner

CASES = json.loads((Path(__file__).parent / "fixtures" / "cr_cases.json").read_text())


def test_fixture_has_all_cases():
    assert len(CASES) == 112


def test_every_cr_is_dropped_before_decoding():
    base = "CLM000001" + "000900000" * 4 + "00" + "40" + "N" + "0000000" * 2 + "N" + " " * 15
    assert decode_record(base)[1]
    assert decode_record("\r" + base)[1]
    assert decode_record(base[:20] + "\r" + base[20:])[1]
    assert not decode_record(base + "\rGARBAGE")[1]


def test_twin_matches_oracle_on_recorded_cr_cases(oracle_binary):
    lines = runner.run_batch(CASES, oracle_binary)
    twin = calculator.calc_batch(CASES, None, preserved())
    assert mismatches(compare_batch(CASES, lines, twin)) == []
