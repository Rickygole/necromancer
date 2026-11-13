import hashlib
import os
import shutil
import subprocess
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "legacy" / "UICALC.cbl"
RECORD_LEN = 80
RESULT_LEN = 40
BATCH_LIMIT = 200
TIMEOUT_SECONDS = 30


BUILD_LOCK = threading.Lock()


class OracleError(Exception):
    code = "RUNTIME_ERROR"

    def __init__(self, message, detail=None):
        super().__init__(message)
        self.detail = detail or {}


class BuildFailed(OracleError):
    code = "BUILD_FAILED"


class OracleTimeout(OracleError):
    code = "ORACLE_TIMEOUT"


class MalformedOutput(OracleError):
    code = "RUNTIME_ERROR"


@dataclass
class BuildResult:
    binary: Path
    compiler_version: str
    source_hash: str
    log: str


def cobc_command():
    return os.environ.get("COBC") or shutil.which("cobc") or str(Path.home() / ".local" / "cobol" / "bin" / "cobc")


def oracle_env():
    env = dict(os.environ)
    lib = Path.home() / ".local" / "cobol" / "lib"
    if lib.exists():
        env["DYLD_LIBRARY_PATH"] = f"{lib}:{env.get('DYLD_LIBRARY_PATH', '')}"
        env["LD_LIBRARY_PATH"] = f"{lib}:{env.get('LD_LIBRARY_PATH', '')}"
    return env


PREBUILT = ROOT / "bin" / "uicalc"
PREBUILT_VERSION = ROOT / "bin" / "ORACLE_VERSION"


def cobc_available():
    command = cobc_command()
    return bool(Path(command).exists() or shutil.which(command))


def prebuilt_available():
    return PREBUILT.exists() and PREBUILT_VERSION.exists()


def oracle_ready():
    return cobc_available() or prebuilt_available()


def source_hash(path=SOURCE):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def compiler_version():
    if not cobc_available() and prebuilt_available():
        return PREBUILT_VERSION.read_text().strip()
    try:
        out = subprocess.run(
            [cobc_command(), "--version"],
            capture_output=True,
            text=True,
            timeout=15,
            env=oracle_env(),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise BuildFailed("compiler not available", {"reason": str(exc)})
    first = out.stdout.splitlines()[0] if out.stdout else ""
    return first.strip()


def build(source=SOURCE, out_dir=None):
    with BUILD_LOCK:
        return _build(source, out_dir)


def _build(source, out_dir):
    if not cobc_available() and prebuilt_available():
        return BuildResult(PREBUILT, compiler_version(), source_hash(source), "prebuilt binary, not compiled on this host")
    out_dir = Path(out_dir) if out_dir else ROOT / "bin"
    out_dir.mkdir(parents=True, exist_ok=True)
    binary = out_dir / "uicalc"
    version = compiler_version()
    try:
        proc = subprocess.run(
            [cobc_command(), "-x", "-free", "-o", str(binary), str(source)],
            capture_output=True,
            text=True,
            timeout=120,
            env=oracle_env(),
        )
    except subprocess.TimeoutExpired:
        raise BuildFailed("compiler timed out")
    log = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode != 0 or not binary.exists():
        raise BuildFailed("compile failed", {"log": log, "exit": proc.returncode})
    return BuildResult(binary, version, source_hash(source), log)


def run_batch(records, binary=None):
    if len(records) > BATCH_LIMIT:
        raise ValueError("batch too large")
    binary = Path(binary) if binary else ROOT / "bin" / "uicalc"
    payload = "".join(r + "\n" for r in records)
    with tempfile.TemporaryDirectory(prefix="necro-") as tmp:
        try:
            proc = subprocess.run(
                [str(binary)],
                input=payload.encode("ascii", "replace"),
                capture_output=True,
                timeout=TIMEOUT_SECONDS,
                cwd=tmp,
                env=oracle_env(),
            )
        except subprocess.TimeoutExpired:
            raise OracleTimeout("oracle timed out", {"records": len(records)})
    if proc.returncode != 0:
        raise OracleError(
            "oracle exited nonzero",
            {"exit": proc.returncode, "stderr": proc.stderr.decode("ascii", "replace")[:2000]},
        )
    lines = proc.stdout.decode("ascii", "replace").split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    if len(lines) != len(records):
        raise MalformedOutput(
            "result count differs from input count",
            {"expected": len(records), "got": len(lines)},
        )
    for index, line in enumerate(lines):
        if len(line) != RESULT_LEN:
            raise MalformedOutput("result line has wrong width", {"index": index, "line": line})
    return lines
