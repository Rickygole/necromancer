# Design: uicalc-twin

## Modules
- modern/models.py: Claim and Result contracts and the 80 and 40 byte codecs.
- modern/arith.py: fixed point helpers. Decimal only.
- modern/calculator.py: one function per paragraph, in rule order.
- modern/mutations.py: named, labeled mutations selected by a flag.

## Rule trace
Ten positions: input rejected, quarter shift, insufficient wages, single quarter, high quarter formula, base cap, allowance above zero, wage ceiling clamp, offset applied, retirement exemption.

## Correctness properties
These match `tests/test_properties.py`. "Twin" means `modern.calculator` with its default preserved legacy behaviors unless a property says it runs on the stated rules only.

- P1 Differential equivalence: for any batch of valid and invalid records, the twin's output lines equal the oracle's output lines byte for byte.
- P2 Totality: for any batch of valid and invalid records, the oracle and the twin each return exactly one 40 byte line per input record.
- P3 Determinism: running the same batch twice gives identical output, on the oracle and on the twin.
- P4 Batch independence: shuffling a batch shuffles the output lines in the same order, on the oracle and on the twin, so a record's result does not depend on its position or its neighbors.
- P5 Record round trip: encoding a generated claim gives an 80 byte record, and parsing then re-encoding that record returns the same bytes. The twin's own codec (`modern.models.decode_record` and `encode_record`) also accepts every valid record and re-encodes it to the same bytes.
- P6 Offset direction: on the stated rules, raising severance never raises the net payout. The oracle breaks this reproducibly: Q1 26,000.00, Q2 to Q4 1,000.00 each and pension 0.01 give status 00 with base 0, allowance 0, offset 0.01 and net 0.01, while the twin with only the narrow quotient behavior gives net 0.
- P7 Wage monotonicity: on the stated rules, raising wages never lowers the base benefit. The oracle breaks this reproducibly: Q1 26,000.00 gives base 0 while Q1 25,999.99 gives base 650.00, both with status 00, and the twin on the stated rules gives 650.00 for Q1 26,000.00.
- P8 Limits: for valid records with pension and severance set to zero, the oracle's base never exceeds 650.00, and, whenever status is 00, the net never exceeds 65 percent of total base wages (Q4 counted as zero when the boundary flag is Y) divided by 52, truncated to cents.
- P9 Eligibility consistency: on the oracle and on the twin, any status other than 00 means base, allowance, offset and net are all zero.
- P10 No floats: every Python file in `modern/` (at least four files) contains no float literal and no use of the names `float` or `round`.
- P11 Decision coverage: every counterexample class recorded in the global counterexample store, excluding those produced by injected mutations, has a decision record in `decisions/`.
