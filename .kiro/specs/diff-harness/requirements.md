# Requirements: diff-harness

## Execution
1. WHEN a run starts, THE harness SHALL record the source hash, twin hash, seed, corpus version and tool versions.
2. WHEN the legacy build fails, THE harness SHALL stop and report BUILD FAILED.
3. THE harness SHALL run one legacy process per batch of at most 200 records.
4. WHEN the oracle times out, crashes or returns malformed output, THE harness SHALL report it as a runtime error and never as a pass or a mismatch.

## Comparison
1. THE harness SHALL compare status, every amount and the rule trace for exact equality.
2. THE harness SHALL normalize nothing and apply no tolerance.
3. WHEN a result is missing, extra or malformed, THE harness SHALL count it as a mismatch.

## Counterexamples
1. WHEN a mismatch is found, THE harness SHALL shrink it to a minimal claimant and save it with its seed.
2. THE harness SHALL replay every saved counterexample on each run.
3. THE harness SHALL group mismatches into classes by differing fields and trace bits.

## Reporting
1. THE harness SHALL report every count with its denominator.
2. THE harness SHALL list known limitations in every report.
