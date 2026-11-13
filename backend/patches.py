import difflib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from backend.errors import ApiError
from oracle.runner import ROOT

PATCH_DIR = Path(__file__).resolve().parent / "patches"
DEMO_DIR = ROOT / "evidence" / "demo"
CONFIG_NAME = "twin.config.json"


def config_path():
    return DEMO_DIR / CONFIG_NAME


def read_config():
    path = config_path()
    if not path.exists():
        return {"mutation": None}
    return json.loads(path.read_text())


def render(mutation):
    return json.dumps({"mutation": mutation}) + "\n"


def list_ids():
    return sorted(p.stem for p in PATCH_DIR.glob("*.patch"))


def patch_file(patch_id):
    if patch_id not in list_ids():
        raise ApiError("NOT_FOUND", "no such patch", {"patch_id": patch_id})
    return PATCH_DIR / (patch_id + ".patch")


def run_patch(diff_path):
    if shutil.which("patch") is None:
        raise ApiError("RUNTIME_ERROR", "the patch command is not available on this host")
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    if not config_path().exists():
        config_path().write_text(render(None))
    try:
        proc = subprocess.run(
            ["patch", "-N", "-t", "-p1", "-d", str(DEMO_DIR), "-i", str(diff_path)],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ApiError("RUNTIME_ERROR", "patch could not run", {"reason": str(exc)})
    for leftover in DEMO_DIR.glob("*.rej"):
        leftover.unlink()
    for leftover in DEMO_DIR.glob("*.orig"):
        leftover.unlink()
    if proc.returncode != 0:
        raise ApiError(
            "BAD_REQUEST",
            "patch does not apply to the current config",
            {"output": (proc.stdout or "") + (proc.stderr or ""), "config": read_config()},
        )


def apply_patch(patch_id):
    run_patch(patch_file(patch_id))
    return read_config()


def inject(mutation):
    path = config_path()
    before = path.read_text() if path.exists() else render(None)
    after = render(mutation)
    if before == after:
        return read_config()
    diff = "".join(
        difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            "a/" + CONFIG_NAME,
            "b/" + CONFIG_NAME,
        )
    )
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "inject.patch"
        target.write_text(diff)
        run_patch(target)
    return read_config()
