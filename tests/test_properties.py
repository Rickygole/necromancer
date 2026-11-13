import ast
import random
from pathlib import Path

from hypothesis import HealthCheck, assume, given, settings, strategies as st

from harness import corpus, decisions as decision_store
from harness.records import Claim, encode_claim, parse_claim, split_result
from modern import calculator, models
from oracle import runner

SETTINGS = settings(max_examples=40, deadline=None, suppress_health_check=list(HealthCheck))
BATCH = st.lists(corpus.valid_records(), min_size=1, max_size=30)
MIXED = st.lists(corpus.mixed_records(), min_size=1, max_size=30)


def oracle(records, binary):
    return runner.run_batch(records, binary)


def amounts(line):
    parts = split_result(line)
    return {k: int(parts[k]) for k in ("base", "allowance", "offset", "net")}


@SETTINGS
@given(MIXED)
def test_p1_differential_equivalence(oracle_binary, batch):
    assert calculator.calc_batch(batch) == oracle(batch, oracle_binary)


@SETTINGS
@given(MIXED)
def test_p2_totality(oracle_binary, batch):
    for lines in (oracle(batch, oracle_binary), calculator.calc_batch(batch)):
        assert len(lines) == len(batch)
        assert all(len(line) == 40 for line in lines)


@SETTINGS
@given(MIXED)
def test_p3_determinism(oracle_binary, batch):
    assert oracle(batch, oracle_binary) == oracle(batch, oracle_binary)
    assert calculator.calc_batch(batch) == calculator.calc_batch(batch)


@SETTINGS
@given(MIXED, st.integers(0, 10000))
def test_p4_batch_independence(oracle_binary, batch, shuffle_seed):
    order = list(range(len(batch)))
    random.Random(shuffle_seed).shuffle(order)
    shuffled = [batch[i] for i in order]
    for fn in (lambda b: oracle(b, oracle_binary), calculator.calc_batch):
        straight = fn(batch)
        permuted = fn(shuffled)
        assert permuted == [straight[i] for i in order]


@SETTINGS
@given(corpus.claims())
def test_p5_record_round_trip(claim):
    record = encode_claim(claim)
    assert len(record) == 80
    assert encode_claim(parse_claim(record)) == record


OFFSET_COUNTEREXAMPLE = encode_claim(Claim("P6LEGACY1", 2600000, 100000, 100000, 100000, 0, 40, "N", 1, 0, "N"))
WAGE_COUNTEREXAMPLE = encode_claim(Claim("P7LEGACY1", 2600000, 100000, 100000, 100000))
WAGE_NEIGHBOR = encode_claim(Claim("P7LEGACY2", 2599999, 100000, 100000, 100000))


def test_p6_legacy_offset_direction_is_reproducible(oracle_binary):
    line = oracle([OFFSET_COUNTEREXAMPLE], oracle_binary)[0]
    parts = split_result(line)
    assert parts["status"] == "00"
    assert amounts(line) == {"base": 0, "allowance": 0, "offset": 1, "net": 1}
    stated = calculator.calc_batch([OFFSET_COUNTEREXAMPLE], None, frozenset({"narrow_quotient"}))[0]
    assert amounts(stated) == {"base": 0, "allowance": 0, "offset": 1, "net": 0}


@SETTINGS
@given(corpus.claims(), st.integers(0, 50000))
def test_p6_offset_direction_twin_with_stated_rules(claim, extra):
    assume(claim.pension <= 3000000 and claim.severance <= 3000000)
    low = claim
    high = claim.__class__(**{**claim.__dict__, "severance": min(claim.severance + extra, 4000000)})
    lines = calculator.calc_batch([encode_claim(low), encode_claim(high)], None, frozenset())
    assert amounts(lines[1])["net"] <= amounts(lines[0])["net"]


def test_p7_legacy_wage_monotonicity_is_reproducible(oracle_binary):
    high, neighbor = oracle([WAGE_COUNTEREXAMPLE, WAGE_NEIGHBOR], oracle_binary)
    assert split_result(high)["status"] == "00"
    assert split_result(neighbor)["status"] == "00"
    assert amounts(high)["base"] == 0
    assert amounts(neighbor)["base"] == 65000
    stated = calculator.calc_batch([WAGE_COUNTEREXAMPLE], None, frozenset())[0]
    assert amounts(stated)["base"] == 65000


@SETTINGS
@given(BATCH)
def test_p8_limits(oracle_binary, batch):
    stripped = []
    for record in batch:
        claim = parse_claim(record)
        stripped.append(encode_claim(claim.__class__(**{**claim.__dict__, "pension": 0, "severance": 0})))
    for line, record in zip(oracle(stripped, oracle_binary), stripped):
        a = amounts(line)
        total = sum(int(record[i:i + 9]) for i in (9, 18, 27, 36)) if record[49] in "NVM" else 0
        flag_total = total - (int(record[36:45]) if record[64] == "Y" else 0)
        assert a["base"] <= 65000
        assert a["net"] <= flag_total * 65 // 100 // 52 or split_result(line)["status"] != "00"


@SETTINGS
@given(MIXED)
def test_p9_eligibility_consistency(oracle_binary, batch):
    for lines in (oracle(batch, oracle_binary), calculator.calc_batch(batch)):
        for line in lines:
            if split_result(line)["status"] != "00":
                assert amounts(line) == {"base": 0, "allowance": 0, "offset": 0, "net": 0}


@SETTINGS
@given(corpus.valid_records())
def test_p5_twin_round_trip(record):
    claim, ok = models.decode_record(record)
    assert ok
    assert models.encode_record(claim) == record


def test_p10_no_floats():
    modern_dir = Path(__file__).resolve().parent.parent / "modern"
    paths = sorted(modern_dir.glob("*.py"))
    assert len(paths) >= 4
    for path in paths:
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant):
                assert not isinstance(node.value, float), path
            if isinstance(node, ast.Name):
                assert node.id not in ("float", "round"), path


def test_p11_decision_coverage():
    from harness.engine import GLOBAL_CX
    from harness import counterexamples

    observed = {cx["class"] for cx in counterexamples.load_all(GLOBAL_CX) if not cx.get("mutation")}
    assert decision_store.uncovered(observed, decision_store.load()) == []
