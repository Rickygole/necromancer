import json
import subprocess
import sys
import tempfile
from pathlib import Path

from oracle.runner import ROOT, cobc_command, compiler_version, oracle_env

PROBES = ROOT / "legacy" / "probes"
REPORT = ROOT / "evidence" / "probes" / "report.json"


def run_probe(source):
    with tempfile.TemporaryDirectory(prefix="probe-") as tmp:
        binary = Path(tmp) / "probe"
        build = subprocess.run(
            [cobc_command(), "-x", "-free", "-o", str(binary), str(source)],
            capture_output=True,
            text=True,
            env=oracle_env(),
        )
        if build.returncode != 0:
            return {"ok": False, "log": build.stderr}
        run = subprocess.run([str(binary)], capture_output=True, text=True, env=oracle_env(), timeout=15)
        return {"ok": True, "lines": run.stdout.splitlines()}


def main():
    results = {}
    for source in sorted(PROBES.glob("*.cbl")):
        results[source.stem] = run_probe(source)
    report = {"compiler": compiler_version(), "probes": results}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    json.dump(report, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
