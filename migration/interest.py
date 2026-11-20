from decimal import Decimal, ROUND_DOWN, localcontext

_CENT = Decimal("0.01")
_ZERO = Decimal("0.00")


def _fit(value, name, int_digits):
    if abs(value) >= Decimal(10) ** int_digits:
        raise ValueError(f"{name} does not fit {int_digits} integer digits")


def _check(value, name, int_digits):
    if not isinstance(value, Decimal):
        raise TypeError(f"{name} must be a Decimal")
    if not value.is_finite():
        raise ValueError(f"{name} must be finite")
    _fit(value, name, int_digits)
    with localcontext() as ctx:
        ctx.prec = 60
        if value != value.quantize(_CENT):
            raise ValueError(f"{name} has more than 2 decimal places")


def _store(value):
    return _ZERO if value.is_zero() else value


def compute_interest(balance, annual_rate_percent, total_interest):
    _check(balance, "balance", 9)
    _check(annual_rate_percent, "annual_rate_percent", 4)
    _check(total_interest, "total_interest", 9)

    with localcontext() as ctx:
        ctx.prec = 60
        monthly = (balance * annual_rate_percent / Decimal(1200)).quantize(
            _CENT, rounding=ROUND_DOWN
        )
        _fit(monthly, "monthly_interest", 9)
        new_total = total_interest.quantize(_CENT) + monthly
        _fit(new_total, "new_total_interest", 9)

    return _store(monthly), _store(new_total)
