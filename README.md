# Necromancer

A verification workbench for legacy COBOL migration. A compiled COBOL program is the oracle. A Python twin runs against thousands of generated inputs, and every disagreement is shown with its input, both outputs, a field level diff and the rule trace.

The legacy program, UICALC, is a synthetic state unemployment insurance weekly benefit calculator. All data is synthetic. The rules are not any state's law.

Results are evidence over N generated and curated cases. They are never a proof of equivalence.

## Status

Work in progress for Kiroween 2026, Resurrection category. All code in this repository was written on or after October 30, 2026. There is no pre-existing work.

## Layout

    legacy/    UICALC.cbl, sample claims, probes
    oracle/    build script and batch runner
    modern/    Python twin
    backend/   FastAPI app
    frontend/  Vite and React console
    mcp/       oracle MCP server
    decisions/ human authored decision records
    evidence/  run reports and counterexamples
    tests/     unit, property and mutation tests

## License

MIT
