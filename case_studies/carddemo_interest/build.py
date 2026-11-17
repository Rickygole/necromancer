import subprocess
from pathlib import Path

from oracle import runner

CASE_DIR = Path(__file__).resolve().parent
VENDOR = CASE_DIR / "vendor"
WRAPPER = CASE_DIR / "INTWRAP.cbl"
BUILD_DIR = CASE_DIR / "build"
PROGRAM = VENDOR / "CBACT04C.cbl"

PARAGRAPH_START = "       1300-COMPUTE-INTEREST."
PARAGRAPH_END = "       1300-B-WRITE-TX."
MISC_START = "       01 WS-MISC-VARS."
MISC_END = "       01 WS-COUNTERS."


def slice_between(lines, start_prefix, end_prefix):
    starts = [i for i, line in enumerate(lines) if line.startswith(start_prefix)]
    ends = [i for i, line in enumerate(lines) if line.startswith(end_prefix)]
    if len(starts) != 1 or len(ends) != 1 or ends[0] <= starts[0]:
        raise runner.BuildFailed("vendored program does not contain the expected paragraph markers")
    return lines[starts[0]:ends[0]]


def extract(program=PROGRAM):
    lines = Path(program).read_text().splitlines(keepends=True)
    paragraph = slice_between(lines, PARAGRAPH_START, PARAGRAPH_END)
    misc = slice_between(lines, MISC_START, MISC_END)
    return "".join(paragraph), "".join(misc)


def write_sources(build_dir=BUILD_DIR, paragraph_transform=None):
    build_dir = Path(build_dir)
    build_dir.mkdir(parents=True, exist_ok=True)
    paragraph, misc = extract()
    if paragraph_transform:
        paragraph = paragraph_transform(paragraph)
    (build_dir / "PARA1300.cpy").write_text(paragraph)
    (build_dir / "MISCVARS.cpy").write_text(misc)
    return build_dir


def build(build_dir=BUILD_DIR, paragraph_transform=None):
    build_dir = write_sources(build_dir, paragraph_transform)
    binary = build_dir / "intwrap"
    try:
        proc = subprocess.run(
            [runner.cobc_command(), "-x", "-I", str(build_dir), "-I", str(VENDOR), "-o", str(binary), str(WRAPPER)],
            capture_output=True,
            text=True,
            timeout=120,
            env=runner.oracle_env(),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise runner.BuildFailed("compiler not available", {"reason": str(exc)})
    log = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode != 0 or not binary.exists():
        raise runner.BuildFailed("compile failed", {"log": log, "exit": proc.returncode})
    return runner.BuildResult(binary, runner.compiler_version(), runner.source_hash(WRAPPER), log)
