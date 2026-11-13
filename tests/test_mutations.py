import pytest

from harness import mutation_score
from modern.mutations import HIDDEN_MUTANTS, MUTATIONS


@pytest.fixture(scope="module")
def result(oracle_binary):
    return mutation_score.score(batches=8, size=200, binary=oracle_binary)


def test_named_set_is_unchanged():
    assert sorted(MUTATIONS) == ["M1", "M2", "M3", "M4", "M5"]
    assert sorted(HIDDEN_MUTANTS) == ["H1", "H2", "H3", "H4", "H5"]


def test_baseline_matches_oracle(result):
    assert result["baseline_mismatches"] == 0


@pytest.mark.parametrize("mutation", sorted(MUTATIONS))
def test_mutation_is_caught(result, mutation):
    assert result["named"][mutation] > 0


@pytest.mark.parametrize("mutation", sorted(HIDDEN_MUTANTS))
def test_hidden_mutant_is_caught(result, mutation):
    assert result["hidden"][mutation] > 0


def test_score_totals(result):
    assert result["named_total"] == 5
    assert result["hidden_total"] == 5
    assert result["named_caught"] == 5
    assert result["hidden_caught"] == 5
