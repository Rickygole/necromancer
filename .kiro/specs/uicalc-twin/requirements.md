# Requirements: uicalc-twin

A Python twin of the UICALC weekly benefit calculator, written from the business rules only.

## R0 Validation
1. WHEN a record is not exactly 80 bytes, THE twin SHALL return status 99 with all amounts zero.
2. WHEN a numeric field holds a non digit, THE twin SHALL return status 99 with all amounts zero.
3. WHEN the retirement code is not N, V or M, or the boundary flag is not Y or N, THE twin SHALL return status 99 with all amounts zero.

## R1 Quarter boundary
1. WHEN the boundary flag is Y, THE twin SHALL treat Q4 wages as zero.

## R2 Insufficient wages
1. THE twin SHALL compute total base wages as Q1 + Q2 + Q3 + Q4.
2. WHEN total base wages are below 2,500.00, THE twin SHALL return status 01.

## R3 Single quarter
1. WHEN fewer than two quarters have wages above zero, THE twin SHALL return status 02.

## R4 Base benefit
1. THE twin SHALL compute the base weekly benefit as the high quarter divided by 26, truncated to a whole dollar.
2. THE twin SHALL cap the base weekly benefit at 650.00.

## R5 Dependency allowance
1. THE twin SHALL add 25.00 per dependent, up to 4 dependents.

## R6 Wage ceiling
1. THE twin SHALL cap the combined benefit at 65 percent of total base wages divided by 52, truncated to cents.

## R7 Offset
1. THE twin SHALL compute the offset as weekly pension at 100 percent plus weekly severance at 50 percent.
2. WHEN age is 62 or older and the retirement code is M, THE twin SHALL set the offset to zero.

## R8 Net payout
1. THE twin SHALL compute the net weekly payout as the combined benefit less the offset, never below zero.

## Output
1. WHEN status is not 00, THE twin SHALL return zero for every amount.
2. THE twin SHALL return a 40 byte result: status, base, allowance, offset, net and a 10 character rule trace.
