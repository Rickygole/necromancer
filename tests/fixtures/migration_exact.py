from decimal import Decimal, ROUND_DOWN

CENT = Decimal("0.01")
WRAP = Decimal(10**9)


def wrap(value):
    magnitude = abs(value) % WRAP
    return magnitude.copy_negate() if value < 0 else magnitude


def compute_interest(balance, annual_rate_percent, total_interest):
    exact = balance * annual_rate_percent / Decimal(1200)
    monthly = wrap(exact.quantize(CENT, rounding=ROUND_DOWN))
    return monthly, wrap(total_interest + monthly)
