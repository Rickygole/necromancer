# Design: uicalc-twin

## Modules
- modern/models.py: Claim and Result contracts and the 80 and 40 byte codecs.
- modern/arith.py: fixed point helpers. Decimal only.
- modern/calculator.py: one function per paragraph, in rule order.
- modern/mutations.py: named, labeled mutations selected by a flag.

## Rule trace
Ten positions: input rejected, quarter shift, insufficient wages, single quarter, high quarter formula, base cap, allowance above zero, wage ceiling clamp, offset applied, retirement exemption.

## Correctness properties
- P5 Record round trip: formatting a parsed record returns the original bytes.
- P8 Limits: the base never exceeds 650.00 and the combined benefit never exceeds the wage ceiling.
- P9 Eligibility consistency: any status other than 00 means every amount is zero.
- P10 No floats: modern/ uses Decimal only.
