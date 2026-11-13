import pytest

from harness import corpus
from harness.compare import Difference, compare_batch, compare_one
from harness.records import Claim, encode_claim
from modern import calculator
from modern.models import decode_record
from oracle import runner

LEGACY = frozenset({"narrow_quotient", "unsigned_net", "offset_wrap"})
BASE = encode_claim(Claim("INVALID01", 900000, 900000, 900000, 900000))
PAID = "0000346000000000000000000346000000100000"
REJECTED = "9900000000000000000000000000001000000000"

CASES = [
    ("trailing_cr", BASE + "\r", PAID),
    ("short_then_cr", BASE[:79] + "\r", REJECTED),
    ("cr_in_middle", BASE[:70] + "\r" + BASE[71:], REJECTED),
    ("double_cr", BASE + "\r\r", PAID),
    ("accent_in_id", "CLMé00001" + BASE[9:], PAID),
    ("accent_in_filler", BASE[:70] + "é" + BASE[71:], PAID),
    ("accent_in_numeric", BASE[:20] + "é" + BASE[21:], REJECTED),
    ("unicode_digits", BASE[:45] + "٣٣" + BASE[47:], REJECTED),
]


@pytest.mark.parametrize("name,record,expected", CASES, ids=[c[0] for c in CASES])
def test_oracle_and_twin_agree(oracle_binary, name, record, expected):
    assert runner.run_batch([record], oracle_binary) == [expected]
    assert calculator.calc_batch([record], None, LEGACY) == [expected]


@pytest.mark.parametrize("name,record,expected", CASES, ids=[c[0] for c in CASES])
def test_corpus_covers_case(name, record, expected):
    assert record in corpus.invalid_fixed()


def test_decode_truncates_at_first_cr():
    assert decode_record(BASE + "\r")[1] is True
    assert decode_record(BASE[:79] + "\r")[1] is False
    assert decode_record("\r" + BASE)[1] is False


def test_decode_accepts_non_ascii_where_cobol_does():
    claim, ok = decode_record("CLMé00001" + BASE[9:])
    assert ok
    assert claim.claimant_id == "CLMé00001"


def test_corpus_has_wide_dependents_and_ages():
    import random

    rng = random.Random(1)
    records = corpus.random_valid_batch(rng, 2000)
    dependents = {int(r[45:47]) for r in records}
    ages = {int(r[47:49]) for r in records}
    assert max(dependents) >= 90 and min(dependents) == 0
    assert any(13 <= d <= 99 for d in dependents)
    assert any(a < 18 for a in ages)
    assert any(r[64] == "Y" and r[18:27] == "0" * 9 and r[27:36] == "0" * 9 for r in records)
    assert any(r[9:45] == "0" * 36 for r in records)


def test_compare_flags_oracle_width():
    result = compare_one(BASE, PAID[:39], PAID)
    assert not result.matches
    assert result.diffs[0].field == "oracle_width"
    assert isinstance(result.diffs[0], Difference)


def test_compare_batch_rejects_oracle_count_mismatch():
    with pytest.raises(ValueError):
        compare_batch([BASE, BASE], [PAID], [PAID, PAID])


def test_compare_batch_rejects_twin_count_mismatch():
    with pytest.raises(ValueError):
        compare_batch([BASE, BASE], [PAID, PAID], [PAID])


def test_run_batch_rejects_newline_in_record(oracle_binary):
    with pytest.raises(ValueError, match="newline"):
        runner.run_batch([BASE, BASE[:10] + "\n" + BASE[11:]], oracle_binary)


def test_run_batch_newline_is_not_oracle_error(oracle_binary):
    try:
        runner.run_batch(["\n"], oracle_binary)
    except runner.OracleError:
        pytest.fail("newline must raise ValueError")
    except ValueError:
        pass
