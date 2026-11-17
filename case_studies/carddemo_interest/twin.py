from decimal import Decimal, ROUND_HALF_UP, localcontext

from case_studies.carddemo_interest.layout import RESULT_LEN, decode, signed_text

CENT = Decimal("0.01")
LIMIT = Decimal("1000000000")
SIZE_ERROR = "SIZE ERROR  "


def monthly_interest(balance, annual_rate_percent):
    with localcontext() as ctx:
        ctx.prec = 60
        return (balance * annual_rate_percent / Decimal(1200)).quantize(CENT, rounding=ROUND_HALF_UP)


def step(total, balance, annual_rate_percent):
    monthly = monthly_interest(balance, annual_rate_percent)
    return monthly, total + monthly


def render(amount):
    if abs(amount) >= LIMIT:
        return SIZE_ERROR
    return signed_text(int((amount / CENT).to_integral_value()), 11)


def calc(record):
    case = decode(record)
    total = Decimal(case.total) * CENT
    balance = Decimal(case.balance) * CENT
    rate = Decimal(case.rate) * CENT
    monthly, new_total = step(total, balance, rate)
    return (render(monthly) + render(new_total)).ljust(RESULT_LEN)


def calc_batch(records):
    return [calc(r) for r in records]
