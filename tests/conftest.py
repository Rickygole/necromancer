import pytest

from oracle import runner


@pytest.fixture(scope="session")
def oracle_binary():
    return runner.build().binary
