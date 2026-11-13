# Necromancer

A verification workbench for legacy COBOL migration. A compiled COBOL program is the oracle. A Python twin runs against thousands of generated inputs, and every disagreement is shown with its input, both outputs, a field level diff and the rule trace.

The legacy program, UICALC, is a synthetic state unemployment insurance weekly benefit calculator. All data is synthetic. The rules are not any state's law.

Results are evidence over N generated and curated cases. They are never a proof of equivalence.

## Status

Built for Kiroween 2026, Resurrection category. All code in this repository was written on or after October 30, 2026. There is no pre-existing work.

Live demo: https://necromancer-rickygole32-8911s-projects.vercel.app (the hosted build replays a recorded run, because the COBOL compiler cannot run there. Run it locally for live comparisons.)

## How it works

1. `legacy/UICALC.cbl` is compiled with GnuCOBOL 3.1.2.0 and is the oracle.
2. `modern/` holds a Python twin written from the business rules only.
3. `harness/` generates golden, boundary, invalid and property based cases, runs both sides on identical bytes, compares every field exactly, and shrinks each failure to a minimal claimant.
4. Each class of difference needs a human decision: preserve the legacy behavior or correct it.
5. Five named mutations check that the tests have teeth.

## Run it

    sh oracle/build.sh
    python -m pytest tests -q
    uvicorn index:app --port 8000

Requirements: Python 3.12, GnuCOBOL 3.1.2 (`cobc` on the path), Node 22 for the console.

## Layout

    legacy/      UICALC.cbl and semantics probes
    oracle/      build script, batch runner, probe runner
    modern/      Python twin
    harness/     corpus, comparator, engine, mutation score
    backend/     FastAPI app, SQLite store, patches
    frontend/    Vite and React console
    oracle_mcp/  MCP server exposing the oracle
    decisions/   human authored decision records
    evidence/    probe report, counterexamples, mutation score
    tests/       unit, property, mutation and API tests

## License

MIT
