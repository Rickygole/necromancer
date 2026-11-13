# Design: diff-harness

## Pipeline
Freeze hashes, build the oracle, generate the corpus from the seed, run each batch through both programs, compare field by field, shrink, persist, report.

## Corpus families
Golden, boundary, invalid, property based, metamorphic and regression.

## Profiles
- dev: small, runs on save.
- demo: about 5,000 comparisons for the live console.
- full: up to 100,000 comparisons for the evidence report.

## Correctness properties
- P1 Differential equivalence: for any valid batch, the twin equals the oracle.
- P2 Totality: each program returns exactly one well formed result per input, in order.
- P3 Determinism: the same batch run twice gives identical output.
- P4 Batch independence: permuting a batch permutes the results and changes nothing else.
- P6 Offset direction: raising severance or pension never raises the net payout.
- P7 Wage monotonicity: raising the high quarter never lowers the base benefit.
- P11 Decision coverage: every observed class of mismatch has a decision record.
