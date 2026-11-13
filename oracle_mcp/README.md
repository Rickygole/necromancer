# oracle_mcp

A small MCP server that exposes the compiled COBOL oracle over stdio.

The folder is named `oracle_mcp` because a top level `mcp/` directory would shadow the `mcp` package.

## Run

    .venv/bin/python -m oracle_mcp.server

Kiro picks it up from `.kiro/settings/mcp.json`. `bin/uicalc` must exist (build it with `oracle.runner.build`).

## Tools

- `compile_cobol(source_path)` compiles a `.cbl` file inside the repo with `cobc -x -free` to a temp binary. Returns `{ok, log}`.
- `run_oracle(records)` runs up to 200 records of 80 characters through `bin/uicalc`. Returns `{ok, results, error?}` with 40 character result lines.
- `parse_record(line)` splits an 80 character input record or a 40 character result line into fields, and decodes the amounts with two implied decimals.
- `probe(source)` compiles and runs a COBOL snippet and returns its output lines.

## Tests

    .venv/bin/python -m pytest tests/test_mcp_tools.py -q
