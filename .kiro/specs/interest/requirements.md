# Requirements: CBACT04C 1300-COMPUTE-INTEREST

1. `compute_interest(balance, annual_rate_percent, total_interest)` takes three `decimal.Decimal` values and returns `(monthly_interest, new_total_interest)` as two `Decimal` values.
2. WHEN called with valid inputs, monthly_interest SHALL equal `(balance * annual_rate_percent) / 1200` stored in a `PIC S9(09)V99` field (COBOL `COMPUTE WS-MONTHLY-INT`).
3. new_total_interest SHALL equal `total_interest + monthly_interest` stored in a `PIC S9(09)V99` field (COBOL `ADD WS-MONTHLY-INT TO WS-TOTAL-INT`).
4. Both results SHALL have exactly two decimal places.
5. No floats SHALL be used for input, output or intermediate values.
6. The function SHALL have defined behavior for every input, including values that do not fit the declared fields and results that do not fit the receiving fields.
7. Writing the transaction (`1300-B-WRITE-TX`) is out of scope.
