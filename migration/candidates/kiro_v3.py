from decimal import Decimal, ROUND_DOWN, localcontext

_CENT = Decimal("0.01")
_ZERO = Decimal("0.00")
_NEG_ZERO = Decimal("-0.00")
_FIELD_LIMIT = Decimal(10) ** 9


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
    # Mimic a MOVE into PIC S9(09)V99 with no ON SIZE ERROR: keep the
    # low-order 9.2 digits and the sign of the original value.
    wrapped = value % _FIELD_LIMIT
    if not wrapped.is_zero():
        return wrapped
    if abs(value) >= _FIELD_LIMIT:
        # Overflow that wraps to zero: COBOL keeps the sign, so a negative
        # result is stored as negative zero (differential check).
        return _NEG_ZERO if value.is_signed() else _ZERO
    # A result that is zero without overflow is always positive zero.
    return _ZERO


def compute_interest(balance, annual_rate_percent, total_interest):
    _check(balance, "balance", 9)
    _check(annual_rate_percent, "annual_rate_percent", 4)
    _check(total_interest, "total_interest", 9)

    with localcontext() as ctx:
        ctx.prec = 60
        monthly = (balance * annual_rate_percent / Decimal(1200)).quantize(
            _CENT, rounding=ROUND_DOWN
        )
        monthly = _store(monthly)
        new_total = _store(total_interest.quantize(_CENT) + monthly)

    return monthly, new_total
