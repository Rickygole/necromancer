from decimal import Decimal

from modern.calculator import calc, calc_batch
from modern.models import Claim, decode_record, encode_record, encode_result


def make(**changes):
    values = dict(
        claimant_id="A00000001",
        q1=Decimal("5000.00"),
        q2=Decimal("5000.00"),
        q3=Decimal("5000.00"),
        q4=Decimal("5000.00"),
        dependents=0,
        age=40,
        retirement_code="N",
        pension=Decimal("0"),
        severance=Decimal("0"),
        boundary_flag="N",
    )
    values.update(changes)
    return Claim(**values)


def test_record_round_trip():
    claim = make(q1=Decimal("12500.50"))
    line = encode_record(claim)
    assert len(line) == 80
    assert line[9:18] == "001250050"
    decoded, ok = decode_record(line)
    assert ok and decoded == claim


def test_basic_eligible():
    result = calc(make())
    assert result.status == 0
    assert result.base == Decimal("192.00")
    assert result.net == Decimal("192.00")
    assert result.trace == "0000100000"


def test_base_cap_and_ceiling():
    result = calc(make(q1=Decimal("30000.00"), q2=Decimal("100.00"), q3=Decimal("0"), q4=Decimal("0")))
    assert result.base == Decimal("650.00")
    assert result.trace[5] == "1"
    assert result.trace[7] == "1"
    assert result.net == Decimal("376.25")


def test_insufficient_wages():
    result = calc(make(q1=Decimal("1000.00"), q2=Decimal("1000.00"), q3=Decimal("0"), q4=Decimal("0")))
    assert result.status == 1
    assert result.net == 0
    assert result.trace == "0010000000"


def test_single_quarter():
    result = calc(make(q1=Decimal("3000.00"), q2=Decimal("0"), q3=Decimal("0"), q4=Decimal("0")))
    assert result.status == 2
    assert result.trace == "0001000000"


def test_quarter_shift_drops_q4():
    result = calc(make(q1=Decimal("0"), q2=Decimal("0"), q3=Decimal("0"), q4=Decimal("9000.00"), boundary_flag="Y"))
    assert result.status == 1
    assert result.trace == "0110000000"


def test_dependents_capped_at_four():
    result = calc(make(dependents=7))
    assert result.allowance == Decimal("100.00")
    assert result.trace[6] == "1"


def test_offset_and_exemption():
    plain = calc(make(pension=Decimal("100.00"), severance=Decimal("50.00")))
    assert plain.offset == Decimal("125.00")
    assert plain.net == Decimal("67.00")
    assert plain.trace[8] == "1"
    exempt = calc(make(age=62, retirement_code="M", pension=Decimal("100.00")))
    assert exempt.offset == 0
    assert exempt.net == Decimal("192.00")
    assert exempt.trace[9] == "1"


def test_net_never_negative():
    result = calc(make(pension=Decimal("900.00")))
    assert result.net == 0
    assert result.status == 0


def test_invalid_records():
    good = encode_record(make())
    assert calc_batch([good[:79], good[:49] + "X" + good[50:], "x" * 80]) == [
        "99" + "0" * 28 + "1000000000"
    ] * 3
    assert encode_result(calc(good)) == calc_batch([good])[0]
