from decimal import Decimal, ROUND_HALF_UP, localcontext

from hypothesis import example, given, settings
from hypothesis import strategies as st

from case_studies.carddemo_interest import layout, twin

CENT = Decimal("0.01")
LIMIT = Decimal("1000000000")
LIMIT_CENTS = 10 ** 11
AMOUNT_MAX = 10 ** 11 - 1
RATE_MAX = 10 ** 6 - 1

amount_cents = st.integers(-AMOUNT_MAX, AMOUNT_MAX)
rate_units = st.integers(-RATE_MAX, RATE_MAX)
nonneg_amount_cents = st.integers(0, AMOUNT_MAX)
nonneg_rate_units = st.integers(0, RATE_MAX)

PROP = settings(database=None, max_examples=300, deadline=None)


def ref_monthly(balance_cents, rate_units):
    balance = Decimal(balance_cents) * CENT
    rate = Decimal(rate_units) * CENT
    with localcontext() as ctx:
        ctx.prec = 80
        return (balance * rate / Decimal(1200)).quantize(CENT, rounding=ROUND_HALF_UP)


def ref_monthly_cents(balance_cents, rate_units):
    return int(ref_monthly(balance_cents, rate_units) / CENT)


@PROP
@given(amount_cents, rate_units)
@example(100000, 500)
@example(30, 2000)
@example(-30, 2000)
@example(0, 999999)
def test_monthly_interest_equals_balance_times_rate_over_1200_half_up_when_it_fits(balance_cents, rate_units):
    balance = Decimal(balance_cents) * CENT
    rate = Decimal(rate_units) * CENT
    assert twin.monthly_interest(balance, rate) == ref_monthly(balance_cents, rate_units)
    line = twin.calc(layout.encode(layout.Case(0, balance_cents, rate_units)))
    monthly_field = layout.split_result(line)["monthly"]
    cents = ref_monthly_cents(balance_cents, rate_units)
    if abs(cents) < LIMIT_CENTS:
        assert monthly_field == layout.signed_text(cents, layout.AMOUNT_DIGITS)


@PROP
@given(nonneg_amount_cents, nonneg_amount_cents, nonneg_rate_units)
@example(0, 0, 0)
@example(100000, 100000, 500)
def test_results_are_nonnegative_for_nonnegative_inputs(total_cents, balance_cents, rate_units):
    balance = Decimal(balance_cents) * CENT
    rate = Decimal(rate_units) * CENT
    monthly = twin.monthly_interest(balance, rate)
    assert monthly >= 0
    new_total = Decimal(total_cents) * CENT + monthly
    assert new_total >= 0
    line = twin.calc(layout.encode(layout.Case(total_cents, balance_cents, rate_units)))
    fields = layout.split_result(line)
    for name in ("monthly", "total"):
        field = fields[name]
        if field != twin.SIZE_ERROR:
            assert field[0] == "+"


@PROP
@given(amount_cents, amount_cents, nonneg_rate_units)
@example(0, 100000, 500)
@example(0, 0, 999999)
def test_monthly_interest_is_monotonic_in_balance_for_fixed_rate(lo_cents, hi_cents, rate_units):
    if lo_cents > hi_cents:
        lo_cents, hi_cents = hi_cents, lo_cents
    rate = Decimal(rate_units) * CENT
    lo = twin.monthly_interest(Decimal(lo_cents) * CENT, rate)
    hi = twin.monthly_interest(Decimal(hi_cents) * CENT, rate)
    assert lo <= hi


@PROP
@given(amount_cents, amount_cents, rate_units)
@example(0, 0, 999999)
@example(99999999999, 99999999999, 0)
def test_zero_balance_or_zero_rate_gives_zero_interest_and_unchanged_total(total_cents, balance_cents, rate_units):
    for case in (layout.Case(total_cents, 0, rate_units), layout.Case(total_cents, balance_cents, 0)):
        line = twin.calc(layout.encode(case))
        fields = layout.split_result(line)
        assert fields["monthly"] == layout.signed_text(0, layout.AMOUNT_DIGITS)
        assert fields["total"] == layout.signed_text(total_cents, layout.AMOUNT_DIGITS)


@PROP
@given(st.integers(-(LIMIT_CENTS + 1000), LIMIT_CENTS + 1000))
@example(LIMIT_CENTS)
@example(LIMIT_CENTS - 1)
@example(-LIMIT_CENTS)
@example(0)
def test_render_reports_size_error_on_overflow_and_never_wraps(cents):
    amount = Decimal(cents) * CENT
    rendered = twin.render(amount)
    if abs(cents) >= LIMIT_CENTS:
        assert rendered == twin.SIZE_ERROR
    else:
        assert rendered == layout.signed_text(cents, layout.AMOUNT_DIGITS)


@PROP
@given(amount_cents, amount_cents, rate_units)
@example(0, 99999999999, 999999)
@example(99999999999, 100000, 500)
def test_overflow_fields_are_size_error_not_wrapped_values(total_cents, balance_cents, rate_units):
    line = twin.calc(layout.encode(layout.Case(total_cents, balance_cents, rate_units)))
    fields = layout.split_result(line)
    monthly_cents = ref_monthly_cents(balance_cents, rate_units)
    new_total_cents = total_cents + monthly_cents
    if abs(monthly_cents) >= LIMIT_CENTS:
        assert fields["monthly"] == twin.SIZE_ERROR
    if abs(new_total_cents) >= LIMIT_CENTS:
        assert fields["total"] == twin.SIZE_ERROR


@PROP
@given(amount_cents, amount_cents, rate_units)
@example(0, 100000, 500)
@example(5, -12345, 1999)
def test_adding_to_running_total_is_exact_when_the_sum_fits(total_cents, balance_cents, rate_units):
    line = twin.calc(layout.encode(layout.Case(total_cents, balance_cents, rate_units)))
    total_field = layout.split_result(line)["total"]
    monthly_cents = ref_monthly_cents(balance_cents, rate_units)
    new_total_cents = total_cents + monthly_cents
    if abs(new_total_cents) < LIMIT_CENTS:
        assert total_field == layout.signed_text(new_total_cents, layout.AMOUNT_DIGITS)
