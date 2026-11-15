import pytest

from oracle import runner


def test_junk_executable_is_a_clean_unavailable_error(tmp_path):
    junk = tmp_path / "uicalc"
    junk.write_bytes(b"not an executable at all")
    junk.chmod(0o755)
    with pytest.raises(runner.OracleUnavailable) as caught:
        runner.run_batch(["x" * runner.RECORD_LEN], binary=junk)
    assert caught.value.code == "ORACLE_UNAVAILABLE"
    assert isinstance(caught.value, runner.OracleError)


def test_missing_binary_is_a_clean_unavailable_error(tmp_path):
    with pytest.raises(runner.OracleUnavailable):
        runner.run_batch(["x" * runner.RECORD_LEN], binary=tmp_path / "absent")


def test_non_executable_file_is_a_clean_unavailable_error(tmp_path):
    plain = tmp_path / "uicalc"
    plain.write_text("data")
    plain.chmod(0o644)
    with pytest.raises(runner.OracleUnavailable):
        runner.run_batch(["x" * runner.RECORD_LEN], binary=plain)
