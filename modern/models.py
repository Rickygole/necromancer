from dataclasses import dataclass
from decimal import Decimal

from modern.arith import to_units

DIGITS = "0123456789"
RECORD_LENGTH = 80
RESULT_LENGTH = 40


@dataclass(frozen=True)
class Claim:
    claimant_id: str
    q1: Decimal
    q2: Decimal
    q3: Decimal
    q4: Decimal
    dependents: int
    age: int
    retirement_code: str
    pension: Decimal
    severance: Decimal
    boundary_flag: str


@dataclass(frozen=True)
class Result:
    status: int
    base: Decimal
    allowance: Decimal
    offset: Decimal
    net: Decimal
    trace: str


def _digits(text):
    return len(text) > 0 and all(ch in DIGITS for ch in text)


def _money(text):
    return Decimal(int(text)).scaleb(-2)


def encode_record(claim):
    parts = [claim.claimant_id.ljust(9)[:9]]
    for wage in (claim.q1, claim.q2, claim.q3, claim.q4):
        parts.append(str(to_units(wage, 2)).zfill(9))
    parts.append(str(claim.dependents).zfill(2))
    parts.append(str(claim.age).zfill(2))
    parts.append(claim.retirement_code)
    parts.append(str(to_units(claim.pension, 2)).zfill(7))
    parts.append(str(to_units(claim.severance, 2)).zfill(7))
    parts.append(claim.boundary_flag)
    return "".join(parts).ljust(RECORD_LENGTH)


def decode_record(line):
    if not isinstance(line, str):
        return None, False
    line = line.split("\r", 1)[0]
    if len(line) != RECORD_LENGTH:
        return None, False
    numeric = [line[9:18], line[18:27], line[27:36], line[36:45], line[45:47],
               line[47:49], line[50:57], line[57:64]]
    if not all(_digits(field) for field in numeric):
        return None, False
    if line[49] not in ("N", "V", "M") or line[64] not in ("Y", "N"):
        return None, False
    claim = Claim(
        claimant_id=line[0:9],
        q1=_money(line[9:18]),
        q2=_money(line[18:27]),
        q3=_money(line[27:36]),
        q4=_money(line[36:45]),
        dependents=int(line[45:47]),
        age=int(line[47:49]),
        retirement_code=line[49],
        pension=_money(line[50:57]),
        severance=_money(line[57:64]),
        boundary_flag=line[64],
    )
    return claim, True


def encode_result(result):
    text = str(result.status).zfill(2)
    for amount in (result.base, result.allowance, result.offset, result.net):
        text += str(to_units(amount, 2)).zfill(7)
    return text + result.trace


def decode_result(line):
    if len(line) != RESULT_LENGTH:
        raise ValueError("result line must be 40 characters")
    return Result(
        status=int(line[0:2]),
        base=_money(line[2:9]),
        allowance=_money(line[9:16]),
        offset=_money(line[16:23]),
        net=_money(line[23:30]),
        trace=line[30:40],
    )
