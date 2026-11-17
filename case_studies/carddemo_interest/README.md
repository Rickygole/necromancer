# Case study: CardDemo monthly interest paragraph

This is a differential check of COBOL that this project did not write. The oracle is a paragraph from AWS's CardDemo sample application, compiled with GnuCOBOL 3.1.2.0. The twin is a Python rewrite of what that paragraph is meant to do. The harness compares every output field and shrinks each kind of difference to a small input.

It is evidence over the cases counted below. It is not a proof of equivalence and it says nothing about the rest of CardDemo.

## The program

- Source: `CBACT04C.cbl`, "a interest calculator program", a batch COBOL program in CardDemo. Its paragraph `1300-COMPUTE-INTEREST` computes one month of interest for one transaction category balance:

      COMPUTE WS-MONTHLY-INT
       = ( TRAN-CAT-BAL * DIS-INT-RATE) / 1200

      ADD WS-MONTHLY-INT  TO WS-TOTAL-INT

  `TRAN-CAT-BAL` is `PIC S9(09)V99`, `DIS-INT-RATE` is `PIC S9(04)V99` (an annual percentage rate), `WS-MONTHLY-INT` and `WS-TOTAL-INT` are `PIC S9(09)V99`. The paragraph has no `ROUNDED` and no `ON SIZE ERROR`.
- Repository: https://github.com/aws-samples/aws-mainframe-modernization-carddemo
- Commit: `59cc6c2fd7ebd7ef7925cad552a01a4b8b6e4d5e` (main, 2025-10-16)
- License: Apache-2.0. The repository `LICENSE` is the unmodified Apache 2.0 text, its README says the project is released under Apache 2.0, and `CBACT04C.cbl` carries its own Apache header. Details and file hashes are in `NOTICE`.
- Vendored byte for byte in `vendor/`: `CBACT04C.cbl`, the two copybooks it uses for these fields (`CVTRA01Y.cpy`, `CVTRA02Y.cpy`), the upstream `LICENSE` and `NOTICE`. A test checks the sha256 of each file.

The whole program reads indexed files (VSAM style) and writes a transaction file, so it cannot run as a stdin and stdout batch job. Only the computation is checked.

## The wrapper

`INTWRAP.cbl` is the smallest wrapper that makes the paragraph runnable. It is the only COBOL written here for the oracle.

- `build.py` cuts two verbatim slices out of the vendored `CBACT04C.cbl` at build time: the paragraph `1300-COMPUTE-INTEREST` and the `WS-MISC-VARS` group that declares `WS-MONTHLY-INT` and `WS-TOTAL-INT`. The wrapper `COPY`s them, together with the vendored copybooks. A test checks that the slices are exact substrings of the vendored file.
- The wrapper reads one 31 byte record per line from stdin, loads the three fields, performs `1300-COMPUTE-INTEREST`, and writes one 40 byte line to stdout.
- The paragraph ends with `PERFORM 1300-B-WRITE-TX`. In CardDemo that paragraph builds and writes a transaction record to a file. The wrapper supplies its own `1300-B-WRITE-TX` that moves `WS-MONTHLY-INT` and `WS-TOTAL-INT` to the output line. That stub is a stand-in for the file write, so what happens to the value after the paragraph is not tested.
- `WS-TOTAL-INT` is loaded from the input before the paragraph runs. It stands for the running total of earlier categories of the same account, so the accumulating `ADD` is covered. The account break logic, the file reads and the `IF DIS-INT-RATE NOT = 0` guard of the main loop are not.

Record layout, 31 characters, each number a sign then digits, scaled by 100 (cents, or hundredths of a percent):

| Bytes | Field |
|---|---|
| 0 to 12 | initial `WS-TOTAL-INT`, sign and 11 digits |
| 12 to 24 | `TRAN-CAT-BAL`, sign and 11 digits |
| 24 to 31 | `DIS-INT-RATE`, sign and 6 digits |

Output, 40 characters: `WS-MONTHLY-INT` (sign and 11 digits), `WS-TOTAL-INT` (sign and 11 digits), 16 dots. The dots are there because a line sequential `WRITE` strips trailing spaces and the existing runner requires fixed width results. Both sides write them.

## The twin

`twin.py` is a straightforward reading of what the paragraph says it does: one month of interest is balance times annual percentage rate divided by 1200, to the cent, added to the running total. It uses `Decimal`, no floats. Choices made before the first run against the compiled program, in the first twin commit:

- Rounding: half up to the cent. The source does not document a rounding rule. Half up is the common money convention, so that is what a rewrite from the stated intent would do. A team that decides truncation is the intended rule would call the truncation class below "no difference". This is the one place where the verdict depends on a judgment, and it is flagged as such.
- Range: the twin has unbounded numbers. A result that does not fit `S9(09)V99` is reported as the text `SIZE ERROR`, because there is no number that is correct for it. COBOL has no such text, so any case that overflows the field is a mismatch by construction. What the COBOL does instead is the finding.

The twin was committed before the wrapper existed. After that, one presentation change was made to `twin.py` before any comparison: the output is padded with dots instead of spaces to match the wrapper (see the layout note above). The arithmetic was not changed. It has not been changed since.

## How it was run

Compiler: `cobc (GnuCOBOL) 3.1.2.0`. The oracle is built with the repository's `oracle/runner.py` helpers (`cobc_command`, `oracle_env`, `compiler_version`, `source_hash`) and fed through its unchanged `run_batch`, in batches of 200. Results are compared with `harness.compare.Comparison` and `Difference`, field by field as strings, with a field table for this layout in `compare.py`. Shrinking uses the Hypothesis `find` approach and backend of `harness/engine.py`.

Cases come from `gen.py`, seed 731942 (the same seed value the main harness uses, in an unrelated generator):

- golden: 8 hand written cases
- boundary: 1,243 cases. Rates and balances at 0, 1, 99, 100, 1200, the limits of the fields, exact half cent ties, the exact point where interest reaches 10 to the 9th dollars, and running totals at and next to the field limit, each with both signs.
- random: 50,000 cases with the number of digits of each field drawn uniformly and a mix of zero, small, and near limit totals. This is not a model of real balances. It deliberately reaches the large values, so the overflow counts below say how often the generator got there, not how often a real bank would.

## Results

51,251 cases, 28,658 matched, 22,593 mismatched (golden 5 of 8, boundary 631 of 1,243, random 21,957 of 50,000). Nothing is unexplained: every mismatch falls in one of the classes below. The run is deterministic, rerunning gives a byte identical `evidence/report.json`.

| Class | Cases |
|---|---|
| truncation | 20,192 |
| truncation + total overflow | 923 |
| truncation + rounding over limit | 8 |
| total overflow | 907 |
| monthly overflow | 505 |
| monthly overflow + total overflow | 58 |

Counted by root cause (a case can have more than one): truncation 21,123, monthly overflow 563, total overflow 1,888, rounding over limit 8.

### Finding 1: the result is truncated, not rounded

Minimal input found: initial total 0.00, balance 0.09, rate 66.67. The exact interest is 0.50002 cents, so the twin gives 0.01 and the COBOL gives 0.00. Everyday example: balance 1,000.00 at 5.00 percent is 4.1666 dollars, COBOL stores 4.16, the twin stores 4.17. For a negative balance the COBOL result is also toward zero (-4.16). This is the class that dominates the counts, since about half of all non-tiny inputs have a discarded fraction of half a cent or more.

Cause: `COMPUTE` without `ROUNDED` stores the result in a two decimal field by dropping the extra digits, toward zero. Probe `probes/PRB1.cbl` shows `plain +4.16 rounded +4.17`, and `-4.16` / `-4.17` for the negative, and a half cent tie `0.005` stored as `0.00` plain and `0.01` with `ROUNDED`. As a check on the cause, `probe.py` rebuilds the wrapper with `ROUNDED` added to that one `COMPUTE` (a counterfactual build of a temporary copy, the vendored file is untouched) and reruns all 51,251 cases: 2,401 mismatches remain and all 2,401 are twin `SIZE ERROR` cases. Zero mismatches remain that are not overflow. So with `ROUNDED` the COBOL agrees with the twin's half up rule everywhere the value fits.

Whether this is a defect or the rule is a business decision. The difference is under 1 cent per category line per month. The twin's half up rule is an assumption, as stated above.

### Finding 2: monthly interest silently drops its high digits on overflow

Minimal input found: initial total 0.00, balance 585,688,696.70, rate 2048.87. The interest is 1,000,000,000.0064, which is 1,000,000,000.00 after truncation to the cent, and `WS-MONTHLY-INT` holds 0.00. In general the COBOL keeps the low 9 integer digits and drops the rest: balance 999,999,999.99 at 9999.99 percent has true interest 8,333,324,999.91 and the COBOL stores 333,324,999.91.

The exact smallest case is the threshold 1,000,000,000.00. By arithmetic, the interest can only overflow when the rate is at least 1200.00 percent, because the balance field is capped at 999,999,999.99 (rate 1200.00 gives at most 999,999,999.99). At the maximum rate 9999.99 the smallest balance that overflows is 120,000,120.01. So this class is reachable only at rates no real product uses. It is real, but a theoretical edge for this data model. It matters for a rewrite that widens or changes the field, not for today's balances.

Cause: `COMPUTE` with no `ON SIZE ERROR` stores the low order digits that fit. Probe `probes/PRB2.cbl`: the same computation with `ON SIZE ERROR` raises the condition and leaves the target unchanged, without the clause it stores `+333324999.91`.

### Finding 3: the running total silently wraps

Minimal input found: initial total 3,838,522.11, balance 499,995,304.30, rate 2390.81. Monthly interest is 996,161,477.89, the true total is 1,000,000,000.00 and `WS-TOTAL-INT` holds 0.00. Plain example from `PRB2`: 999,999,999.99 plus 4.16 is stored as 4.15. Unlike finding 2 this needs no unusual rate, only a running total near 1 billion, which one account's categories would need to reach. It is a theoretical edge too, but it is the line `ADD WS-MONTHLY-INT TO WS-TOTAL-INT` that carries it, and the total goes on to `ACCT-CURR-BAL` in the full program.

Cause: `ADD` without `ON SIZE ERROR` stores the low order digits. `PRB2` also shows that `ADD ... ON SIZE ERROR` leaves the target at `999999999.99` and raises the condition.

### Smaller observations

- A mixed case in the data: 8 cases show `truncation + rounding over limit`: the twin's rounding up by one cent is what pushes its own total over the limit (running total 999,999,999.99, balance 0.88, rate 6.82). The COBOL total is 999,999,999.99 and fits. That is the twin's artifact of finding 1, listed so the count is complete.
- Negative zero. When the COBOL truncates a negative value to exactly -1,000,000,000.00, the stored value is a zero that keeps its minus sign. Through the wrapper it appears as `-00000000000`. Whether it appears depends on how the value is moved: `PRB3` moves the same field into a lone display item (`+000000000.00`) and into a member of a group (`-00000000000`). The wrapper sees it because its output is a group. The comparisons count it as part of the overflow classes. I did not check what other compilers do.
- Minimal inputs are the output of Hypothesis `find` followed by a local reduction of each field (to zero, by halves, by one). They are minimal in that no single such reduction keeps the class. They are not claimed to be global minima. In `evidence/report.json`, `shrunk: false` means Hypothesis did not rediscover the class and the first failing record was reduced by the local pass only.
- The classes are labelled by `analysis.py`, a short integer model (truncate toward zero, keep the low 11 digits, keep the sign) that is separate from the twin. It reproduces the oracle output exactly on all 51,251 cases, which is how the causes were checked at scale. The first version of this model missed negative zero on 3 cases. The model was corrected and the twin was not touched. The root cause labels were then reworked twice, before the final recorded run, because the first labels called a rounding artifact an overflow.

### Seen in the source, not run

In the main loop of `CBACT04C.cbl`, `1050-UPDATE-ACCOUNT` is performed when the account number changes and in an `ELSE` branch that is entered only when `END-OF-FILE` is neither `N` nor `Y`. Reading the code, that branch cannot be reached, so the last account's accumulated interest is never added to the account balance. This was read, not executed, because the full program was not run. It is outside the paragraph that this study covers.

## Limitations

- The twin checks the paragraph, not the program. Files, account breaks, the transaction record, dates and fees are not covered.
- One compiler version was exercised. Findings 2 and 3 are about GnuCOBOL 3.1.2.0's behavior when no size error clause is given. Other compilers may handle it differently, and that was not measured.
- The rounding rule is the judgment call described above. The overflow classes do not depend on it.
- Input was well formed by construction. Non numeric data, spaces and bad signs in the fields were not generated, because the wrapper parses signs and digits itself.
- The generator is a probe of the arithmetic, not a sample of production data. The counts show where the paragraph differs from the twin and how often this generator reached it. They are not a measure of real world error rates.
- A run with no mismatch would mean none were found, not that none exist. This run found mismatches, so that caveat applies in the other direction: there might be further classes this generator did not reach.

## Reproduce

Needs Python 3.12 with the repository requirements and GnuCOBOL 3.1.2 (`cobc` on the path, in the `COBC` environment variable, or in `~/.local/cobol/bin`).

    .venv/bin/python -m case_studies.carddemo_interest.run
    .venv/bin/python -m case_studies.carddemo_interest.probe
    .venv/bin/python -m pytest -q tests/test_case_study_carddemo.py tests/test_case_study_carddemo_evidence.py

The first command rebuilds the wrapper, runs all cases and writes `evidence/report.json`. The second compiles the three probes, runs the `ROUNDED` counterfactual and writes `evidence/probes.json`. The tests that need the compiler skip when it is absent, and the tests on recorded evidence run anywhere.

## Files

    vendor/        upstream files, unmodified, with LICENSE and NOTICE
    NOTICE         source URL, commit, license evidence, hashes
    INTWRAP.cbl    harness wrapper
    build.py       extracts the verbatim slices and compiles the wrapper
    layout.py      record layouts
    twin.py        the Python twin
    gen.py         golden, boundary and seeded random cases
    compare.py     field comparison on the harness Comparison classes
    analysis.py    integer cause model and class labels
    run.py         runner, shrinker, report writer
    probe.py       compiler probes and the ROUNDED counterfactual
    probes/        PRB1, PRB2, PRB3 probe programs
    evidence/      report.json and probes.json from the recorded run
