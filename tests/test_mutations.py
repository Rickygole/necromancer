import pytest

from harness import mutation_score
from modern.mutations import MUTATIONS


@pytest.fixture(scope="module")
def result(oracle_binary):
    return mutation_score.score(batches=8, size=200, binary=oracle_binary)


def test_baseline_matches_oracle(result):
    assert result["baseline_mismatches"] == 0


@pytest.mark.parametrize("mutation", sorted(MUTATIONS))
def test_mutation_is_caught(result, mutation):
    assert result["caught"][mutation] > 0
