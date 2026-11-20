# Design: compute_interest

## Arithmetic
- The `COMPUTE` has no `ROUNDED` clause, so COBOL truncates the result to the receiving field's 2 decimal places. Python uses `quantize(Decimal("0.01"), rounding=ROUND_DOWN)`, which truncates toward zero. Examples: 0.019 becomes 0.01; -0.019 becomes -0.01.
- The product and division run in a local decimal context with 60 digits of precision. The largest product has 6 + 9 + 2 + 2 = 15 significant digits, so the quotient is effectively exact before truncation.
- The `ADD` adds two 2-decimal values, so it is exact and needs no rounding.
- A zero result is returned as `Decimal("0.00")`, never `Decimal("-0.00")`. A COBOL signed numeric field holding zero compares equal to zero, and a negative zero in Python output would be misleading.

## Inputs that do not fit the declared fields
The COBOL statements have no `ON SIZE ERROR` clause. On overflow, standard COBOL leaves the result undefined, and common compilers silently drop high-order digits. Silently corrupting money is worse than failing, so the Python function raises instead and returns no partial result.

| Condition | Result |
|---|---|
| Any argument is not a `Decimal` (including `float`, `int`, `str`, `bool`) | `TypeError` |
| Any argument is NaN or infinite | `ValueError` |
| balance or total_interest has 10 or more integer digits (abs >= 10^9) | `ValueError` |
| annual_rate_percent has 5 or more integer digits (abs >= 10^4) | `ValueError` |
| Any argument has non-zero digits beyond 2 decimal places | `ValueError` (silent truncation would hide a caller bug) |
| monthly_interest does not fit S9(09)V99 (abs >= 10^9 after truncation) | `ValueError` |
| new_total_interest does not fit S9(09)V99 | `ValueError` |

- Trailing zeros beyond 2 places are accepted (`Decimal("1.500")` is treated as 1.50).
- Negative values are accepted for all three fields, since all are signed (`S`).
- Monthly interest can overflow even with valid inputs: 999,999,999.99 × 9,999.99 / 1200 ≈ 8.33 × 10^9. That case raises.

## Interface
One pure function in `migration/interest.py` with no I/O and no global state. The decimal context changes are scoped with `localcontext()`, so callers' contexts are unaffected.
