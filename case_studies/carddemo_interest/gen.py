import random

from case_studies.carddemo_interest.layout import Case, encode

AMOUNT_MAX = 10**11 - 1
RATE_MAX = 10**6 - 1
DEFAULT_SEED = 731942
UNITS_PER_CENT = 120000


def golden():
    return [
        Case(0, 100000, 500),
        Case(0, 250000, 1999),
        Case(0, 1500000, 2499),
        Case(0, 9999999, 1200),
        Case(1250, 100000, 0),
        Case(5, -12345, 1999),
        Case(0, 0, 1999),
        Case(30000, 480000, 1500),
    ]


def smallest_rate_for_monthly(balance, monthly_cents):
    return -(-monthly_cents * UNITS_PER_CENT // balance)


def boundary():
    out = []
    rates = [0, 1, 99, 100, 500, 1200, 1999, 2499, 12000, 120001, 999998, 999999]
    balances = [0, 1, 99, 100, 119999, 120000, 120001, 12000000, 99999999, 50000000000, 99999999998, 99999999999]
    totals = [0, 1, -1, 99999999999, -99999999999, 99999999000, -99999999000]
    for r in rates:
        for b in balances:
            for t in totals:
                out.append(Case(t, b, r))
    for r in (-1, -500, -1999, -999999):
        for b in (100000, 119999, 99999999999, -100000, -99999999999):
            for t in (0, 99999999999, -99999999999):
                out.append(Case(t, b, r))
    for r in (1, 5, 25, 125, 625, 3125, 15625):
        step = 2 * UNITS_PER_CENT
        base = UNITS_PER_CENT // 2
        for j in range(0, 6):
            wanted = base + step * j
            if wanted % r == 0 and wanted // r <= AMOUNT_MAX:
                for sign in (1, -1):
                    out.append(Case(0, sign * (wanted // r), r))
    for balance in (AMOUNT_MAX, 60000000000, 12345678901):
        edge = smallest_rate_for_monthly(balance, 10**11)
        for r in (edge - 2, edge - 1, edge, edge + 1):
            if 0 <= r <= RATE_MAX:
                for sign in (1, -1):
                    out.append(Case(0, sign * balance, r))
    for monthly in (0, 1, 416, 417, 100000):
        for delta in (-2, -1, 0, 1, 2):
            total = AMOUNT_MAX - monthly + delta
            if 0 <= total <= AMOUNT_MAX:
                for b, r in ((100000, 500), (-100000, 500), (60000, 1)):
                    out.append(Case(total, b, r))
                    out.append(Case(-total, b, r))
    seen = set()
    unique = []
    for case in out:
        if case not in seen:
            seen.add(case)
            unique.append(case)
    return unique


def digits_value(rng, max_digits, max_value):
    width = rng.randint(1, max_digits)
    return rng.randint(0, min(10**width - 1, max_value))


def random_cases(count, seed=DEFAULT_SEED):
    rng = random.Random(seed)
    out = []
    for _ in range(count):
        balance = digits_value(rng, 11, AMOUNT_MAX)
        rate = digits_value(rng, 6, RATE_MAX)
        pick = rng.random()
        if pick < 0.35:
            total = 0
        elif pick < 0.9:
            total = digits_value(rng, 11, AMOUNT_MAX)
        else:
            total = AMOUNT_MAX - rng.randint(0, 2000)
        out.append(
            Case(
                -total if rng.random() < 0.25 else total,
                -balance if rng.random() < 0.25 else balance,
                -rate if rng.random() < 0.15 else rate,
            )
        )
    return out


def all_cases(count, seed=DEFAULT_SEED):
    families = [("golden", golden()), ("boundary", boundary()), ("random", random_cases(count, seed))]
    return [(name, [encode(c) for c in cases]) for name, cases in families]
