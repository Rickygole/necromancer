from case_studies.carddemo_interest import twin
from case_studies.carddemo_interest.layout import RESULT_LEN, decode, signed_text, split_result

UNITS_PER_CENT = 120000
WRAP = 10**11


def sign_of(value):
    return -1 if value < 0 else 1


def truncated_monthly(case):
    magnitude = abs(case.balance) * abs(case.rate) // UNITS_PER_CENT
    return sign_of(case.balance) * sign_of(case.rate) * magnitude


def stored(raw):
    negative = raw < 0
    magnitude = abs(raw) % WRAP
    return negative, magnitude


def stored_text(raw):
    negative, magnitude = stored(raw)
    return ("-" if negative else "+") + str(magnitude).zfill(11)


def stored_value(raw):
    negative, magnitude = stored(raw)
    return -magnitude if negative else magnitude


def model_line(record):
    case = decode(record)
    monthly_raw = truncated_monthly(case)
    total_raw = case.total + stored_value(monthly_raw)
    return (stored_text(monthly_raw) + stored_text(total_raw)).ljust(RESULT_LEN, ".")


def causes(comparison):
    case = decode(comparison.record)
    oracle = split_result(comparison.oracle_output)
    twin_fields = split_result(comparison.twin_output)
    monthly_raw = truncated_monthly(case)
    total_raw = case.total + stored_value(monthly_raw)
    monthly_wraps = abs(monthly_raw) >= WRAP
    total_wraps = abs(total_raw) >= WRAP
    twin_monthly_error = twin_fields["monthly"] == twin.SIZE_ERROR
    twin_total_error = twin_fields["total"] == twin.SIZE_ERROR
    flags = []
    if monthly_wraps:
        flags.append("monthly_overflow")
    elif twin_monthly_error:
        flags.append("rounding_over_limit")
    elif oracle["monthly"] == signed_text(monthly_raw, 11) and twin_fields["monthly"] != oracle["monthly"]:
        flags.append("truncation")
    if total_wraps:
        flags.append("total_overflow")
    elif twin_total_error and not twin_monthly_error and "rounding_over_limit" not in flags:
        flags.append("rounding_over_limit")
    return flags


def classify(comparison):
    if comparison.matches:
        return ""
    flags = causes(comparison)
    return "+".join(flags) if flags else "unexplained"
