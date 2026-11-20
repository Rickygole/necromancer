# How Kiro fits into this project

This file is a plain account of what the `.kiro` directory contains, how it was produced and what has actually been run in Kiro. Judges should read it before trusting anything under `.kiro`.

## What is in `.kiro`

- `steering/`: six steering docs with `inclusion: always` (product, tech, structure, COBOL semantics, test integrity, no floats).
- `specs/`: requirements, design and tasks for five features (`uicalc-twin`, `diff-harness`, `workbench-ui`, `evidence-report`, `interest`).
- `agents/`: three custom agent definitions (COBOL analyst, migration engineer, failure analyst) with scoped write paths. The Kiro CLI upgraded these files to its V3 format, adding permission rules.
- `hooks/`: two hook files (re-derive properties on spec or legacy source edits, and a test guard for the oracle, evidence and decisions). They are still in the legacy format.
- `settings/mcp.json`: registers the local oracle MCP server in `oracle_mcp/`.

## How these files were produced

Most of the repository, including three of the four specs, the steering docs, the hook files and the agent definitions, was written as plain files alongside the code with other AI coding tools, not by walking through the Kiro IDE. The `evidence-report` spec and the `uicalc-twin` design properties were written or changed with Kiro, as described below. The Kiro CLI runs were started by another AI coding assistant working for the owner. The Kiro IDE steps were done by the owner.

## What was run in Kiro

### MCP

- The oracle MCP tools were called from Kiro twice, on the same counterexample `cx_0002`.
- In the Kiro CLI (V3), after the workspace was trusted, an agent called `parse_record` and `run_oracle`. `run_oracle` returned `0000096000000000000312600000010100100110`, which matches the recorded oracle output. Before the workspace was trusted, the CLI agents reported that no MCP tools were available.
- In the Kiro IDE (1.4.154) chat, `parse_record` ran on a second server entry called `oracle-abs` and decoded the record (q2 0.01, q3 2499.99, severance 62.52).
- In the IDE the workspace entry `oracle` in `.kiro/settings/mcp.json` was not available to the chat. That entry uses a relative `.venv/bin/python` command. The cause was not confirmed. The working entry uses absolute paths and lives in the owner's user level Kiro config, not in this repository.

### Agent hooks

- Saving `.kiro/specs/uicalc-twin/design.md` fired the `Re-derive properties` hook in the IDE. It fired three times in total, on saves of that file. On the first run the agent read the spec, noted that the edit was only a blank line, and reported that `design.md` listed only properties P5, P8, P9 and P10 while `tests/test_properties.py` implements P1 to P11. Its suggested numbering did not match the implemented properties, so it was not adopted. It edited nothing on that run.
- Saving a blank line into `oracle/__init__.py` fired the `Test guard` hook. The agent undid the edit, saying the user had not asked for it, and `git status` shows no change.
- Both hook files were still in the legacy format (the hooks panel offered a Migrate button) and fired without being migrated.

### Spec driven development

- Prompted in the IDE chat, Kiro rewrote the Correctness properties section of the `uicalc-twin` design so it lists P1 to P11 as implemented in `tests/test_properties.py`. It was committed after its statements were checked against the test code.
- The `evidence-report` spec was started with the Kiro CLI and continued in the IDE with "Start task" on each task. It produced `python -m harness.report`, a read only command that prints a Markdown evidence report from three recorded evidence files, plus `tests/test_report.py`.
- Kiro's shell did not work in the IDE (its terminal output was replaced by a trust prompt from another tool), so Kiro could not run its own tests. The first version had two failing tests, caused by default arguments bound at definition time, and the report printed the 612 demo mismatches without saying the snapshot is the run with mutation M4 injected. After the owner pasted that review into the Kiro chat, Kiro fixed both and added an `Injected mutation` line and three tests.
- The tests were then run outside Kiro: 16 in `tests/test_report.py` and 205 in the full suite passed at that point. All four tasks are ticked. The last two were ticked by Kiro at the owner's request after that outside run, so those two ticks rest on it, not on a test run by Kiro.

### Migration of a real paragraph

- The task was written in `migration/TASK.md`: the verbatim AWS CardDemo paragraph `1300-COMPUTE-INTEREST`, its field definitions, and a Python function contract. Kiro was told to work from that file alone and to use the spec workflow. In the IDE it wrote `.kiro/specs/interest/requirements.md`, `design.md`, `tasks.md` and `migration/interest.py`. The design chose to raise an error when a result does not fit the field.
- Kiro's shell failed in that session, so it never ran its own code. Every check below was run outside Kiro by `python -m migration.verify`, which feeds the same inputs to the compiled COBOL and to the candidate and compares the 40 byte answers.
- First translation (`kiro_v1`): it truncated correctly and did not fall into the rounding trap. It differed from the COBOL in 2,393 of 51,251 cases (338 of the 3,251 cases the hosted site runs). Every one was an overflow, where the COBOL has no ON SIZE ERROR and keeps the low order digits and Kiro's function raises.
- The owner decided to preserve the legacy wrap. The finding was pasted into the Kiro chat. Second version (`kiro_v2`): 3 mismatches in 51,251. In each, a wrapped result is exactly zero and the COBOL stores negative zero where Kiro returned positive zero. Kiro's own later notes had listed that sign as unconfirmed against the COBOL.
- The owner decided to preserve that too. Third version (`kiro_v3`): no mismatch in 51,251 cases. That is evidence over those cases and not a proof. The file contains comments Kiro wrote and is kept byte for byte, as the manifest hash requires.
- The three versions are on the Legacy page of the site, each with a button that runs it live against the compiled COBOL.

### Custom agents

- The `failure-analyst` agent ran through the CLI, read `evidence/` and `decisions/`, and wrote three class files to `evidence/classes/`. They are raw agent output. The decoded fields of `cx_0002` that it quotes were checked against the record by hand and match. The owner has not reviewed them line by line.
- The `cobol-analyst` agent ran once through the CLI and wrote `evidence/analysis/cobol-analyst.json`. Shell commands were denied in non-interactive mode, so it applied the `parse_record` logic by hand and said so. That file is raw output and has not been reviewed line by line.
- The `migration-engineer` agent was run read only through the CLI several times. In those runs it never called `parse_record` or `run_oracle`, because no MCP tools were registered for it until the workspace was trusted. It was not run again afterwards.

### Property based testing

- Through the Kiro CLI, Kiro wrote `tests/test_carddemo_twin_properties.py`, seven Hypothesis properties for the Python twin of the CardDemo interest paragraph (rounding formula, non negative results, monotonicity, zero cases, size error instead of wrapping, exact running totals). The tests pass when run (7 passed).

### Steering

- Asked which rules about floats and test integrity apply, Kiro answered correctly from `.kiro/steering/no-float.md`, `test-integrity.md` and `tech.md`, but only after reading the repository itself and guessing file names.
- Asked in a new message, without reading any file, which steering rules it currently had, Kiro said none had been loaded into its context. After a window reload the answer was the same. The Kiro panel listed only global steering.
- The six steering files have valid front matter, so steering is not shown to load automatically in this setup. No claim is made that steering changed any answer.

## What was not run or not shown

- Kiro powers and Kiro web were not tried.
- Kiro's shell never worked inside the IDE, so no test run in this repository was executed by Kiro in the IDE, and the migration code was never run by Kiro either.
- Workspace steering did not load, as described above.
- The `migration-engineer` agent has not been shown to call the oracle tools.
- The three agent output files in `evidence/` have not been reviewed line by line.

## What the oracle MCP server does

`oracle_mcp/server.py` exposes four tools: compile a COBOL file inside the repo, run a batch through the compiled oracle, parse a record into fields, and compile and run a small COBOL snippet as a probe. It runs over stdio only and should never be exposed over a network, because a probe compiles arbitrary COBOL.
