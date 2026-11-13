from decimal import Decimal

from modern.arith import truncate, store
from modern.models import Claim, Result, decode_record, encode_result
from modern.mutations import is_active

MIN_WAGES = Decimal("2500.00")
BASE_CAP = Decimal("650.00")
PER_DEPENDENT = Decimal("25.00")
MAX_DEPENDENTS = 4
CEILING_RATE = Decimal("0.65")
RETIREMENT_AGE = 62
ZERO = Decimal("0.00")


def validate(record):
    if isinstance(record, Claim):
        return record, ()
    claim, ok = decode_record(record)
    if not ok:
        return None, (1,)
    return claim, ()


def quarter_shift(claim):
    quarters = [claim.q1, claim.q2, claim.q3, claim.q4]
    if claim.boundary_flag == "Y":
        quarters[3] = ZERO
        return quarters, (2,)
    return quarters, ()


def total_wages(quarters):
    total = store(sum(quarters, ZERO), 9, 2)
    if total < MIN_WAGES:
        return total, (3,)
    return total, ()


def count_quarters(quarters):
    count = sum(1 for wage in quarters if wage > 0)
    if count < 2:
        return count, (4,)
    return count, ()


def base_benefit(quarters, mutation=None):
    bits = [5]
    raw = max(quarters) / 26
    if is_active(mutation, "M1"):
        whole = store(raw, 7, 0, rounded=True)
    else:
        whole = truncate(raw, 0)
    cap = BASE_CAP + 1 if is_active(mutation, "M2") else BASE_CAP
    if whole > cap:
        whole = cap
        bits.append(6)
    return store(whole, 5, 2), tuple(bits)


def dependency_allowance(dependents):
    allowance = PER_DEPENDENT * min(dependents, MAX_DEPENDENTS)
    if allowance > 0:
        return store(allowance, 5, 2), (7,)
    return ZERO, ()


def wage_ceiling(base, allowance, total, mutation=None):
    combined = base + allowance
    weekly = total / 52
    if is_active(mutation, "M5"):
        weekly = truncate(weekly, 2)
    ceiling = truncate(weekly * CEILING_RATE, 2)
    if combined > ceiling:
        return store(ceiling, 5, 2), (8,)
    return store(combined, 5, 2), ()


def offset(claim, mutation=None):
    threshold = RETIREMENT_AGE + 1 if is_active(mutation, "M3") else RETIREMENT_AGE
    if claim.age >= threshold and claim.retirement_code == "M":
        return ZERO, (10,)
    amount = store(claim.pension + truncate(claim.severance / 2, 2), 5, 2)
    if amount > 0:
        return amount, (9,)
    return ZERO, ()


def net_payout(combined, total_offset, mutation=None):
    net = combined - total_offset
    if net < 0:
        net = ZERO
    if is_active(mutation, "M4") and net < 0:
        net = ZERO
    return store(net, 5, 2), ()


def _trace(bits):
    return "".join("1" if pos in bits else "0" for pos in range(1, 11))


def _result(status, bits):
    return Result(status, ZERO, ZERO, ZERO, ZERO, _trace(bits))


def calc(claim_or_record, mutation=None):
    bits = set()
    claim, found = validate(claim_or_record)
    bits.update(found)
    if claim is None:
        return _result(99, bits)

    quarters, found = quarter_shift(claim)
    bits.update(found)

    total, found = total_wages(quarters)
    bits.update(found)
    if found:
        return _result(1, bits)

    _, found = count_quarters(quarters)
    bits.update(found)
    if found:
        return _result(2, bits)

    base, found = base_benefit(quarters, mutation)
    bits.update(found)
    allowance, found = dependency_allowance(claim.dependents)
    bits.update(found)
    combined, found = wage_ceiling(base, allowance, total, mutation)
    bits.update(found)
    total_offset, found = offset(claim, mutation)
    bits.update(found)
    net, found = net_payout(combined, total_offset, mutation)
    bits.update(found)

    return Result(0, base, allowance, total_offset, net, _trace(bits))


def calc_batch(records, mutation=None):
    return [encode_result(calc(record, mutation)) for record in records]
