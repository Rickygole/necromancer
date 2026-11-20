from pathlib import Path

import pytest

from case_studies.carddemo_interest import build
from migration import verify

FIXTURES = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(scope="module")
def binary():
    try:
        return build.build().binary
    except Exception as exc:
        pytest.skip("compiler not available: %s" % exc)


def test_exact_candidate_has_no_mismatch(binary):
    report = verify.verify(FIXTURES / "migration_exact.py", random_cases=500, binary=binary)
    assert report["mismatched"] == 0
    assert report["counterexamples"] == []


def test_rounding_candidate_is_caught_and_explained(binary):
    report = verify.verify(FIXTURES / "migration_rounding.py", random_cases=500, binary=binary)
    assert report["mismatched"] > 0
    assert "rounds_instead_of_truncating" in report["classes"]
    cx = next(c for c in report["counterexamples"] if c["class"] == "rounds_instead_of_truncating")
    assert cx["oracle_output"] != cx["candidate_output"]


def test_render_flags_values_that_are_not_cents():
    from decimal import Decimal

    assert verify.render(Decimal("1.005")) == verify.NOT_CENTS
    assert verify.render(Decimal("1000000000")) == verify.OUT_OF_RANGE
    assert verify.render(1.5) == verify.NOT_NUMBER
    assert verify.render(Decimal("-2.50")) == "-00000000250"
    assert verify.render(Decimal("-0.00")) == "-00000000000"
    assert verify.render(Decimal("0.00")) == "+00000000000"


def test_raising_candidate_is_reported(tmp_path, binary):
    path = tmp_path / "raises.py"
    path.write_text("def compute_interest(a, b, c):\n    raise ValueError\n")
    report = verify.verify(path, random_cases=50, binary=binary)
    assert report["matched"] == 0
    assert set(report["classes"]) == {"raised"}


def test_feedback_text_lists_each_class(binary):
    report = verify.verify(FIXTURES / "migration_rounding.py", random_cases=100, binary=binary, shrink_classes=False)
    text = verify.feedback(report)
    assert "rounds_instead_of_truncating" in text and "COBOL output" in text
