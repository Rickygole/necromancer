import subprocess
import tempfile
from decimal import Decimal
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from harness.records import INPUT_FIELDS, OUTPUT_FIELDS, RECORD_LEN, RESULT_LEN, split_result
from oracle.probe import run_probe
from oracle.runner import (
    BATCH_LIMIT,
    ROOT,
    OracleError,
    cobc_command,
    oracle_env,
    run_batch,
)

mcp = FastMCP("oracle")

INPUT_AMOUNTS = {"q1", "q2", "q3", "q4", "pension", "severance"}
OUTPUT_AMOUNTS = {"base", "allowance", "offset", "net"}


def _inside_repo(path):
    try:
        path.resolve().relative_to(ROOT.resolve())
    except ValueError:
        return False
    return True


def _amount(text):
    if not text.isdigit():
        return None
    return str(Decimal(int(text)).scaleb(-2).quantize(Decimal("0.01")))


@mcp.tool()
def compile_cobol(source_path: str) -> dict:
    path = Path(source_path)
    if not path.is_absolute():
        path = ROOT / path
    if not _inside_repo(path):
        return {"ok": False, "log": "path is outside the repo root"}
    if path.suffix != ".cbl" or not path.is_file():
        return {"ok": False, "log": "not a .cbl file that exists"}
    with tempfile.TemporaryDirectory(prefix="compile-") as tmp:
        try:
            proc = subprocess.run(
                [cobc_command(), "-x", "-free", "-o", str(Path(tmp) / "out"), str(path)],
                capture_output=True,
                text=True,
                timeout=120,
                env=oracle_env(),
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"ok": False, "log": str(exc)}
    return {"ok": proc.returncode == 0, "log": (proc.stdout or "") + (proc.stderr or "")}


@mcp.tool()
def run_oracle(records: list[str]) -> dict:
    if not records:
        return {"ok": False, "results": [], "error": "no records given"}
    if len(records) > BATCH_LIMIT:
        return {"ok": False, "results": [], "error": f"at most {BATCH_LIMIT} records per call"}
    for index, record in enumerate(records):
        if len(record) != RECORD_LEN or not record.isascii():
            return {
                "ok": False,
                "results": [],
                "error": f"record {index} must be {RECORD_LEN} ascii characters, got {len(record)}",
            }
    try:
        return {"ok": True, "results": run_batch(records)}
    except (OracleError, OSError) as exc:
        return {"ok": False, "results": [], "error": f"{exc} {getattr(exc, 'detail', '')}".strip()}


@mcp.tool()
def parse_record(line: str) -> dict:
    if len(line) == RECORD_LEN:
        kind, table, amounts = "input", INPUT_FIELDS, INPUT_AMOUNTS
        fields = {name: line[a:b] for name, a, b in table}
    elif len(line) == RESULT_LEN:
        kind, amounts = "output", OUTPUT_AMOUNTS
        fields = split_result(line)
    else:
        return {"ok": False, "error": f"expected {RECORD_LEN} or {RESULT_LEN} characters, got {len(line)}"}
    decoded = {name: _amount(value) for name, value in fields.items() if name in amounts}
    return {"ok": True, "kind": kind, "fields": fields, "amounts": decoded}


@mcp.tool()
def probe(source: str) -> dict:
    with tempfile.TemporaryDirectory(prefix="snippet-") as tmp:
        path = Path(tmp) / "snippet.cbl"
        path.write_text(source)
        try:
            return run_probe(path)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return {"ok": False, "log": str(exc)}


if __name__ == "__main__":
    mcp.run()
