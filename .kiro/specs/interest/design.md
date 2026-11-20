# Design: compute_interest

## Arithmetic
- The `COMPUTE` has no `ROUNDED` clause, so COBOL truncates the result to the receiving field's 2 decimal places. Python uses `quantize(Decimal("0.01"), rounding=ROUND_DOWN)`, which truncates toward zero. Examples: 0.019 becomes 0.01; -0.019 becomes -0.01.
- The product and division run in a local decimal context with 60 digits of precision. The largest product has 6 + 9 + 2 + 2 = 15 significant digits, so the quotient is effectively exact before truncation.
- The `ADD` adds two 2-decimal values, so it is exact and needs no rounding.
- A zero result that did not overflow is returned as `Decimal("0.00")`, never `Decimal("-0.00")`. For example, -0.001 truncates to `0.00`. A result that overflows and wraps to zero is the one exception; see the wrap section below.

## Results that do not fit S9(09)V99 (legacy wrap)
The COBOL statements have no `ON SIZE ERROR` clause. A differential check against the compiled COBOL showed that on overflow it stores the low-order digits and keeps going. The reviewer decided to preserve that behavior, so the Python function wraps instead of raising.

- Rule: after truncating to 2 decimals, keep the low-order 9 integer digits and the 2 decimal digits, and keep the sign. In Python this is `value % Decimal(10**9)`. Decimal `%` takes the sign of the dividend, so a negative result stays negative. Example: -1,000,000,000.50 becomes -0.50.
- The rule applies to monthly_interest after the `COMPUTE`, and to new_total_interest after the `ADD`. The `ADD` uses the already-wrapped monthly value, since COBOL stores it in `WS-MONTHLY-INT` before the `ADD` runs.
- Example from the differential check: balance 1.00, rate 12.00, total 999,999,999.99. Monthly is 0.01. The total is 1,000,000,000.00, which wraps to 0.00.
- Monthly interest can overflow even with valid inputs: 999,999,999.99 × 9,999.99 / 1200 ≈ 8.33 × 10^9. That case wraps.
- A result that overflows and wraps to exactly zero keeps its sign. A positive overflow returns `Decimal("0.00")`, and a negative overflow returns `Decimal("-0.00")`. A differential check of 51,251 cases confirmed that COBOL stores `-00000000000` here, and the reviewer decided to preserve it. Examples from that check:
  - balance -600,000,000.00, rate 2,000.00, total 0.00. Monthly is -1,000,000,000.00, which wraps to -0.00.
  - balance -1,000.00, rate 5.00, total -999,999,995.84. Monthly is -4.16. The total is -1,000,000,000.00, which wraps to -0.00.
- Callers must not use the sign of a zero result for business logic unless they want this legacy behavior. `Decimal("-0.00") == 0` is true in Python, as it is in COBOL.

## Inputs that do not fit the declared fields
These rules still raise. The differential mismatches were all result overflows, and in the COBOL these values could never reach the paragraph because the fields cannot hold them. Raising here catches caller bugs rather than changing legacy results.

| Condition | Result |
|---|---|
| Any argument is not a `Decimal` (including `float`, `int`, `str`, `bool`) | `TypeError` |
| Any argument is NaN or infinite | `ValueError` |
| balance or total_interest has 10 or more integer digits (abs >= 10^9) | `ValueError` |
| annual_rate_percent has 5 or more integer digits (abs >= 10^4) | `ValueError` |
| Any argument has non-zero digits beyond 2 decimal places | `ValueError` (silent truncation would hide a caller bug) |

- Trailing zeros beyond 2 places are accepted (`Decimal("1.500")` is treated as 1.50).
- Negative values are accepted for all three fields, since all are signed (`S`).

## Interface
One pure function in `migration/interest.py` with no I/O and no global state. The decimal context changes are scoped with `localcontext()`, so callers' contexts are unaffected.
