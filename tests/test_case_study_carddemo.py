import hashlib
from decimal import Decimal
from pathlib import Path

import pytest

from case_studies.carddemo_interest import layout, twin

CASE_DIR = Path(__file__).resolve().parent.parent / "case_studies" / "carddemo_interest"
VENDOR = CASE_DIR / "vendor"

VENDORED_SHA256 = {
    "LICENSE": "09e8a9bcec8067104652c168685ab0931e7868f9c8284b66f5ae6edae5f1130b",
    "NOTICE": "d4290ed64c2edd0fce1d84e3f9dfb2881240fe534def76b8cd29ed6af683e287",
    "CBACT04C.cbl": "5084bb8b0c9a0f0199f737487ae1863f12e43cabbdc459a62b6b67bedc683cc4",
    "CVTRA01Y.cpy": "50637f13692c89b17a2fc60d249dc54e9eb3569d933afca3cdcf65b491a9d5ba",
    "CVTRA02Y.cpy": "7828fae489c59944b4310e223028a8d3a525ccf4ead113c062bcaff04b52bf9c",
}


@pytest.mark.parametrize("name", sorted(VENDORED_SHA256))
def test_vendored_file_is_byte_identical_to_upstream(name):
    assert hashlib.sha256((VENDOR / name).read_bytes()).hexdigest() == VENDORED_SHA256[name]


def test_vendored_program_keeps_its_license_header():
    head = (VENDOR / "CBACT04C.cbl").read_text()[:1500]
    assert "Licensed under the Apache License, Version 2.0" in head
    assert "Copyright Amazon.com, Inc. or its affiliates" in head


def test_notice_names_source_commit_and_license():
    text = (CASE_DIR / "NOTICE").read_text()
    assert "59cc6c2fd7ebd7ef7925cad552a01a4b8b6e4d5e" in text
    assert "Apache-2.0" in text
    assert "https://github.com/aws-samples/aws-mainframe-modernization-carddemo" in text


def test_layout_round_trip():
    case = layout.Case(-5, 123456789012 % 10**11, -1999)
    assert layout.decode(layout.encode(case)) == case
    assert len(layout.encode(case)) == layout.RECORD_LEN


def test_twin_simple_interest():
    line = twin.calc(layout.encode(layout.Case(0, 100000, 500)))
    assert layout.split_result(line)["monthly"] == "+00000000417"
    assert layout.split_result(line)["total"] == "+00000000417"
    assert len(line) == layout.RESULT_LEN


def test_twin_rounds_half_up_to_cents():
    assert twin.monthly_interest(Decimal("0.30"), Decimal("20.00")) == Decimal("0.01")
    assert twin.monthly_interest(Decimal("-0.30"), Decimal("20.00")) == Decimal("-0.01")


def test_twin_accumulates_into_total():
    line = twin.calc(layout.encode(layout.Case(5, -12345, 1999)))
    fields = layout.split_result(line)
    assert fields["monthly"] == "-00000000206"
    assert fields["total"] == "-00000000201"


def test_twin_reports_size_error_instead_of_wrapping():
    line = twin.calc(layout.encode(layout.Case(0, 99999999999, 999999)))
    assert layout.split_result(line)["monthly"] == twin.SIZE_ERROR


def test_twin_uses_no_floats():
    source = (CASE_DIR / "twin.py").read_text()
    assert "float" not in source
