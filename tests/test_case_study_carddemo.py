import hashlib
from decimal import Decimal
from pathlib import Path

import pytest

from case_studies.carddemo_interest import analysis, build, gen, layout, run as case_run, twin
from case_studies.carddemo_interest.compare import compare_one
from oracle import runner

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

needs_cobc = pytest.mark.skipif(not runner.cobc_available(), reason="cobc is not available")


def test_extracted_paragraph_is_a_verbatim_slice_of_the_vendored_program():
    paragraph, misc = build.extract()
    source = (VENDOR / "CBACT04C.cbl").read_text()
    assert paragraph in source
    assert misc in source
    assert "COMPUTE WS-MONTHLY-INT" in paragraph
    assert "( TRAN-CAT-BAL * DIS-INT-RATE) / 1200" in paragraph
    assert "ROUNDED" not in paragraph
    assert "SIZE ERROR" not in paragraph
    assert "WS-MONTHLY-INT            PIC S9(09)V99." in misc
    assert "WS-TOTAL-INT              PIC S9(09)V99." in misc


def test_generator_is_deterministic_and_counts_are_stable():
    first = gen.all_cases(300, gen.DEFAULT_SEED)
    second = gen.all_cases(300, gen.DEFAULT_SEED)
    assert first == second
    other = gen.all_cases(300, gen.DEFAULT_SEED + 1)
    assert first[2] != other[2]
    for _, records in first:
        assert all(len(r) == layout.RECORD_LEN for r in records)
    assert len(set(first[1][1])) == len(first[1][1])


def test_generator_reaches_the_overflow_and_rounding_regions():
    records = [r for _, rs in gen.all_cases(2000, gen.DEFAULT_SEED) for r in rs]
    lines = twin.calc_batch(records)
    assert any(twin.SIZE_ERROR in line for line in lines)
    rounded_up = [
        r for r, line in zip(records, lines)
        if twin.SIZE_ERROR not in line
        and layout.split_result(line)["monthly"] != analysis.stored_text(analysis.truncated_monthly(layout.decode(r)))
    ]
    assert rounded_up


@needs_cobc
def test_wrapper_matches_the_integer_cause_model_on_curated_cases():
    built = build.build()
    records = [r for name, rs in gen.all_cases(0, gen.DEFAULT_SEED) for r in rs]
    lines = case_run.run_oracle(records, built.binary)
    assert all(analysis.model_line(r) == line for r, line in zip(records, lines))


@needs_cobc
def test_oracle_truncates_where_the_twin_rounds():
    built = build.build()
    record = layout.encode(layout.Case(0, 100000, 500))
    line = runner.run_batch([record], built.binary)[0]
    comparison = compare_one(record, line, twin.calc(record))
    assert layout.split_result(line)["monthly"] == "+00000000416"
    assert [d.field for d in comparison.diffs] == ["monthly", "total"]


@needs_cobc
def test_oracle_wraps_high_order_digits_on_overflow():
    built = build.build()
    record = layout.encode(layout.Case(0, 99999999999, 999999))
    line = runner.run_batch([record], built.binary)[0]
    assert layout.split_result(line)["monthly"] == "+33332499991"
    assert twin.calc(record).startswith(twin.SIZE_ERROR)
