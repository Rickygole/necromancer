# Necromancer

A verification workbench for legacy COBOL migration. A compiled COBOL program is the oracle. A Python twin runs against thousands of generated inputs, and every disagreement is shown with its input, both outputs, a field level diff and the rule trace.

Live demo: https://necromancer-rickygole32-8911s-projects.vercel.app

Results are evidence over the cases counted in each run, with the count and the seed shown. They are never a proof of equivalence.

## What is real and what is staged

- UICALC is a synthetic unemployment benefit calculator. Its rules, rates and thresholds are invented and are not any state's law. It is not for benefit determinations or any legal, financial or eligibility use. All data is synthetic.
- The three legacy quirks (narrow quotient wrap, unsigned subtraction, offset field wrap) were written into the COBOL on purpose so the oracle has something real to find. Their behavior was measured on the compiler, not assumed.
- The mismatch shown in the guided demo is an injected mutation (M4), labelled as such. It is a demonstration of the harness catching a regression, not a legacy finding.
- The three decision records in `decisions/` choose to preserve legacy behavior. The reviewer delegated those choices and has not yet confirmed them.
- The case counts differ on purpose: the demo profile runs 3,291 cases, the full profile runs 41,260, and the mutation score uses a separate fixed set of 4,090 cases. All use seed 731942.

## Build disclosure

All code in this repository was written on or after October 30, 2026. Before that date a short feasibility spike checked whether GnuCOBOL could act as an oracle. No spike code was copied into this repository.

The repository was built in a single working session, so the commit history is dense and recent. It was produced by a human owner working with several AI coding agents. The `.kiro` directory holds steering, specs, custom agent definitions and an MCP registration. How those files were produced is described in `KIRO.md`.

## How it works

1. `legacy/UICALC.cbl` is compiled with GnuCOBOL 3.1.2.0 and is the oracle.
2. `modern/` holds a Python twin that was first written from the business rules table only, and committed before the first oracle run.
3. `harness/` generates golden, boundary, invalid and property based cases, runs both sides on identical bytes, compares every field exactly, and shrinks each failure to a minimal claimant.
4. Each class of difference needs a decision: preserve the legacy behavior or correct it.
5. Five named mutations check that the tests have teeth. All five are caught. Five further hidden mutants, found by reviews of the corpus, are also caught.

## Run it

    sh oracle/build.sh
    python -m pytest tests -q
    uvicorn index:app --port 8000

Requirements: Python 3.12, GnuCOBOL 3.1.2 (`cobc` on the path), Node 22 for the console.

The hosted build runs the same harness against a prebuilt Linux copy of the oracle when it is available, and otherwise replays a recorded run and says so on the page.

## Layout

    legacy/      UICALC.cbl and semantics probes
    oracle/      build script, batch runner, probe runner
    modern/      Python twin
    harness/     corpus, comparator, engine, mutation score, snapshot
    backend/     FastAPI app, SQLite store, patches
    frontend/    Vite and React site and console
    oracle_mcp/  MCP server exposing the oracle
    decisions/   decision records and the incident log
    evidence/    probe report, counterexamples, mutation score, snapshot
    docs/        architecture notes
    tests/       unit, property, mutation and API tests

## License

MIT. Third party components are listed in `THIRD_PARTY_NOTICES.md`.
