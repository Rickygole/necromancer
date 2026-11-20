# Design: evidence-report

## Module
`harness/report.py` is the whole feature. It imports only `json`, `pathlib` and `sys` from the standard library and depends on no oracle, engine, corpus, twin or case study runner.

## Entry point
`python -m harness.report` calls `main()`. `main` loads the three files, validates them, builds the report and prints it to stdout. On any report error it prints the message to stderr and exits 1.

## Loading
`load_required(path, keys)` reads the file with `json.loads` and raises `ReportError` when the path is missing, the JSON is invalid, or any required key is absent. The three sources are validated against fixed key lists before the report is built.

## Sections
- Snapshot, from `evidence/snapshot.json`: run id, seed, compiler, verdict, cases, matched and mismatched.
- Mutation score, from `evidence/mutation_score.json`: seed, cases, baseline mismatches, named and hidden mutants caught with their totals, and the mismatch count for each mutant.
- CardDemo case study, from `case_studies/carddemo_interest/evidence/report.json`: case study name, seed, compiler, cases, matched, mismatched, and the cases and mismatches for each family.

## Source labels and closing line
Each section prints a `Source:` line with the path of the file it came from, relative to the workspace root. The report ends with one line that the results are counts over the cases run and not a proof of equivalence.

## No run, no writes, no floats
The command only calls `Path.read_text` and `json.loads`. It never opens a file for writing, never imports a runner or the twin, and every number it prints is an integer.
