# Requirements: evidence-report

A read only command, `python -m harness.report`, that turns recorded evidence into one plain Markdown report and never runs or changes anything.

## Inputs
1. THE command SHALL read exactly three recorded evidence files: `evidence/snapshot.json`, `evidence/mutation_score.json` and `case_studies/carddemo_interest/evidence/report.json`.
2. THE command SHALL read no other file and SHALL run no program, build, oracle call, twin call or corpus generation.
3. THE command SHALL never write, move or delete any file.

## Report contents
1. THE report SHALL print the run id, seed, compiler, case counts and verdict from the snapshot.
2. THE report SHALL print the mutation score from the mutation score file.
3. THE report SHALL print the CardDemo case study counts from the case study report.
4. THE report SHALL name the source file for each section.
5. THE report SHALL end with a line stating the results are counts over the cases run and not a proof of equivalence.

## Failure
1. WHEN a source file is missing, THE command SHALL fail with a message naming the missing file and SHALL print no partial report.
2. WHEN a required key is missing, THE command SHALL fail with a message naming the file and the missing key.

## Discipline
1. THE command SHALL use no floating point numbers anywhere.
2. THE command SHALL print every count as an integer with its denominator where one exists.
3. THE command SHALL never claim proof of equivalence.
