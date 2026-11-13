# Architecture

## Data flow

1. `harness/corpus.py` builds records: golden, boundary, fixed invalid, regression (every saved non-mutation counterexample) and Hypothesis generated batches.
2. `harness/engine.py` generates all batches first, so the planned case count is exact, then runs each family.
3. `oracle/runner.py` builds `legacy/UICALC.cbl` with `cobc` and feeds the same 80 byte lines to the binary, in batches of at most 200, with a 30 second timeout.
4. `modern/calculator.py` computes the same records in Python with `Decimal`. No floats.
5. `harness/compare.py` compares the two 40 byte results field by field, as strings.
6. Each mismatch gets a class signature. Each class is shrunk with Hypothesis `find` to a minimal record and saved to `evidence/counterexamples/` (`cx_NNNN.json`) and the run directory.
7. Classes are checked against `decisions/dec_*.json`. The report lists any class without a decision.
8. The report is written to `evidence/runs/<run_id>/report.json` with the compiler version, the SHA-256 of the COBOL source and a hash of `modern/*.py`.

## Record layouts

Input, 80 bytes. Offsets are zero based, ends exclusive.

| Field | Bytes | PIC |
|---|---|---|
| claimant id | 0-9 | X(9) |
| q1, q2, q3, q4 | 9-45, 9 each | 9(7)V99 |
| dependents | 45-47 | 9(2) |
| age | 47-49 | 9(2) |
| retirement code | 49-50 | X (N, V or M) |
| pension | 50-57 | 9(5)V99 |
| severance | 57-64 | 9(5)V99 |
| quarter flag | 64-65 | X, Y or N |
| filler | 65-80 | X(15) |

Amounts have no decimal point in the text. `0000012345` style values are cents.

Output, 40 bytes: status (2), base (7), allowance (7), offset (7), net (7), trace (10). The four amounts are 9(5)V99.

Status: 00 eligible, 01 wages below 2500.00, 02 fewer than two quarters with wages, 99 invalid record. Non eligible results have zero amounts.

## Rule trace

Ten characters, `1` when the step fired. Positions are 1 based.

| Bit | Meaning |
|---|---|
| 1 | record rejected |
| 2 | quarter flag Y, q4 ignored |
| 3 | total wages below minimum |
| 4 | fewer than two quarters |
| 5 | base benefit computed |
| 6 | base capped at 650.00 |
| 7 | dependency allowance applied |
| 8 | wage ceiling applied |
| 9 | offset applied |
| 10 | retirement exemption (age 62 or over, code M) |

The trace is compared like any other field.

## Failure classes

Kept apart on purpose:

- BUILD FAILED: the oracle did not compile or no compiler or prebuilt binary exists. No cases ran.
- RUNTIME ERROR: the oracle built but timed out, crashed or returned malformed output. Not counted as a mismatch.
- MISMATCH: both sides ran and at least one field differs.

Other verdicts are MATCH, and APPROVAL REQUIRED for a clean `full` profile. A MATCH means no difference was found in the cases run.

A mismatch class is the sorted list of differing fields, plus the trace positions that differ, for example `base+net|t6.8`.

## Profiles

From `harness/profiles.py`. Seed defaults to 731942.

| Profile | Generated batches | Batch size (max) | Shrink examples |
|---|---|---|---|
| dev | 2 | 50 | 200 |
| demo | 100 | 50 | 400 |
| full | 300 | 200 | 800 |

Generated batches hold between half and the full batch size, so totals vary. The fixed families add a few dozen cases, plus one per saved counterexample.

## Decisions and the twin

`decisions/dec_*.json` hold the class, counterexample ids, choice (`preserve` or `correct`), reviewer and note. `modern/behaviors.py` maps classes to twin behaviors for preserved choices:

| Class | Behavior | Effect |
|---|---|---|
| `base+net|t6.8` | `narrow_quotient` | base quotient wraps at 3 digits |
| `net` | `unsigned_net` | a negative net is stored as its absolute value |
| `net+offset` | `offset_wrap` | offset wraps to 7 digits instead of capping |

With no decision, or `correct`, the twin uses the stated rules. All three current decisions are `preserve`.

## Mutations

`modern/mutations.py` defines M1 to M5. A mutation id passed to `calc` changes one rule in the twin: M1 rounds the base, M2 caps at 651.00, M3 starts the exemption above 62, M4 clamps net to zero, M5 truncates wages / 52 before applying 65 percent. `harness/mutation_score.py` runs each against the oracle with the legacy behaviors on. `evidence/mutation_score.json` records 5 of 5 named and 5 of 5 hidden mutants caught on 4090 cases, with 0 baseline mismatches. Runs with a mutation save counterexamples with `mx_` ids and never write to the global counterexample directory.

The demo mutation is applied by patching `evidence/demo/twin.config.json` with `backend/patches/apply-Mx.patch` and reverted with `fix-Mx.patch`.

## Hosted modes

Set by `NECRO_HOSTED=1` and by what is installed.

- Live: `scripts/fetch-oracle.sh` downloads a prebuilt Linux oracle (built by `.github/workflows/oracle-linux.yml`) into `bin/` during the Vercel build, only if its source hash matches `legacy/UICALC.cbl`. `/api/live` then runs a real verification in one request and returns the report, events and counterexamples. Without `cobc`, the runner uses the prebuilt binary.
- Replay: with no oracle on the host, run endpoints return an error pointing to `/api/snapshot`, and the console replays `evidence/snapshot.json`. The snapshot holds three real recorded runs: baseline, injected mutation (M4) and after patch. Hosted approvals are marked simulated.

Locally, `cobc` builds the oracle and `/api/runs` starts real runs.

## Claim discipline

- Results are counts over generated and curated cases, never a proof of equivalence.
- Every report carries limitations: one pinned compiler, ASCII 80 byte lines only, no tabs, CRLF or missing final newline.
- Replayed evidence is labelled as recorded, not live.
- Preserve versus correct is a human decision. The harness reports classes and does not choose.
- Tests are checked by mutation: if a known fault is not caught, the tests are weak.
- All data is synthetic and the rules are not any state's law.
