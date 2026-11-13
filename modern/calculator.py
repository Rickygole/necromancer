from decimal import Decimal

from modern.arith import truncate, store
from modern.models import Claim, Result, decode_record, encode_result
from modern.behaviors import preserved
from modern.mutations import is_active

MIN_WAGES = Decimal("2500.00")
BASE_CAP = Decimal("650.00")
PER_DEPENDENT = Decimal("25.00")
MAX_DEPENDENTS = 4
CEILING_RATE = Decimal("0.65")
RETIREMENT_AGE = 62
ZERO = Decimal("0.00")
OFFSET_MAX = Decimal("99999.99")


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
    total = store(sum(quarters, ZERO), 10, 2)
    if total < MIN_WAGES:
        return total, (3,)
    return total, ()


def count_quarters(quarters, claim=None, mutation=None):
    if is_active(mutation, "H1"):
        quarters = [claim.q1, claim.q2, claim.q3, claim.q4]
    count = sum(1 for wage in quarters if wage > 0)
    if count < 2:
        return count, (4,)
    return count, ()


def base_benefit(quarters, mutation=None, behaviors=frozenset()):
    bits = [5]
    raw = max(quarters) / 26
    if is_active(mutation, "M1"):
        whole = store(raw, 7, 0, rounded=True)
    else:
        whole = truncate(raw, 0)
    if "narrow_quotient" in behaviors:
        whole = whole % 1000
    cap = BASE_CAP + 1 if is_active(mutation, "M2") else BASE_CAP
    if whole > cap:
        whole = cap
        bits.append(6)
    return store(whole, 7, 2), tuple(bits)


def dependency_allowance(dependents, mutation=None):
    if is_active(mutation, "H2") and dependents > 12:
        dependents = 3
    allowance = PER_DEPENDENT * min(dependents, MAX_DEPENDENTS)
    if allowance > 0:
        return store(allowance, 7, 2), (7,)
    return ZERO, ()


def wage_ceiling(base, allowance, total, mutation=None):
    combined = base + allowance
    if is_active(mutation, "M5"):
        ceiling = truncate(truncate(total / 52, 2) * CEILING_RATE, 2)
    else:
        ceiling = truncate(CEILING_RATE * total / 52, 2)
    if combined > ceiling:
        return store(ceiling, 7, 2), (8,)
    return store(combined, 7, 2), ()


def offset(claim, mutation=None, behaviors=frozenset()):
    threshold = RETIREMENT_AGE + 1 if is_active(mutation, "M3") else RETIREMENT_AGE
    age = claim.age % 18 if is_active(mutation, "H3") else claim.age
    if age >= threshold and claim.retirement_code == "M":
        return ZERO, (10,)
    amount = claim.pension + truncate(claim.severance / 2, 2)
    if "offset_wrap" in behaviors:
        amount = store(amount, 7, 2)
    else:
        amount = min(amount, OFFSET_MAX)
    if amount > 0:
        return amount, (9,)
    return ZERO, ()


def net_payout(combined, total_offset, mutation=None, behaviors=frozenset()):
    net = combined - total_offset
    if net < 0:
        if is_active(mutation, "M4"):
            net = ZERO
        elif "unsigned_net" in behaviors:
            net = abs(net)
        else:
            net = ZERO
    return store(net, 7, 2), ()


def _trace(bits):
    return "".join("1" if pos in bits else "0" for pos in range(1, 11))


def _result(status, bits):
    return Result(status, ZERO, ZERO, ZERO, ZERO, _trace(bits))


def calc(claim_or_record, mutation=None, behaviors=None):
    behaviors = preserved() if behaviors is None else behaviors
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

    _, found = count_quarters(quarters, claim, mutation)
    bits.update(found)
    if found:
        return _result(2, bits)

    base, found = base_benefit(quarters, mutation, behaviors)
    bits.update(found)
    allowance, found = dependency_allowance(claim.dependents, mutation)
    bits.update(found)
    combined, found = wage_ceiling(base, allowance, total, mutation)
    bits.update(found)
    total_offset, found = offset(claim, mutation, behaviors)
    bits.update(found)
    net, found = net_payout(combined, total_offset, mutation, behaviors)
    bits.update(found)

    return Result(0, base, allowance, total_offset, net, _trace(bits))


def calc_batch(records, mutation=None, behaviors=None):
    behaviors = preserved() if behaviors is None else behaviors
    return [encode_result(calc(record, mutation, behaviors)) for record in records]
