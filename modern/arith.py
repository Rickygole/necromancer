from decimal import Decimal, Context, ROUND_DOWN, ROUND_HALF_UP

CTX = Context(prec=60)


def truncate(value, places):
    step = Decimal(1).scaleb(-places)
    return value.quantize(step, rounding=ROUND_DOWN, context=CTX)


def store(value, digits, decimals, rounded=False):
    step = Decimal(1).scaleb(-decimals)
    mode = ROUND_HALF_UP if rounded else ROUND_DOWN
    fitted = abs(value).quantize(step, rounding=mode, context=CTX)
    units = int(fitted.scaleb(decimals, context=CTX)) % (10 ** digits)
    return Decimal(units).scaleb(-decimals, context=CTX)


def to_units(value, decimals):
    return int(value.scaleb(decimals, context=CTX))
