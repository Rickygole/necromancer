from decimal import Decimal, ROUND_HALF_UP


def compute_interest(balance, annual_rate_percent, total_interest):
    monthly = (balance * annual_rate_percent / Decimal(1200)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return monthly, total_interest + monthly
