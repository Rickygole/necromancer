import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SNAPSHOT_PATH = ROOT / "evidence" / "snapshot.json"
MUTATION_PATH = ROOT / "evidence" / "mutation_score.json"
CARDDEMO_PATH = ROOT / "case_studies" / "carddemo_interest" / "evidence" / "report.json"

SNAPSHOT_KEYS = ("run_id", "seed", "mutation", "compiler", "verdict", "cases", "matched", "mismatched")
MUTATION_KEYS = (
    "seed",
    "cases",
    "baseline_mismatches",
    "named",
    "named_caught",
    "named_total",
    "hidden",
    "hidden_caught",
    "hidden_total",
)
CARDDEMO_KEYS = ("case_study", "seed", "compiler", "cases", "matched", "mismatched", "families")


class ReportError(Exception):
    pass


def load_required(path, required_keys):
    path = Path(path)
    if not path.exists():
        raise ReportError("missing evidence file: {}".format(path))
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ReportError("could not parse {}: {}".format(path, exc)) from exc
    missing = [key for key in required_keys if key not in data]
    if missing:
        raise ReportError("missing required keys in {}: {}".format(path, ", ".join(missing)))
    return data


def validate_families(data, path):
    families = data.get("families")
    if not isinstance(families, dict) or not families:
        raise ReportError("families missing or empty in {}".format(path))
    for name in sorted(families):
        family = families[name]
        for key in ("cases", "mismatches"):
            if key not in family:
                raise ReportError("family {} missing key {} in {}".format(name, key, path))


def load_evidence(snapshot_path=None, mutation_path=None, carddemo_path=None):
    if snapshot_path is None:
        snapshot_path = SNAPSHOT_PATH
    if mutation_path is None:
        mutation_path = MUTATION_PATH
    if carddemo_path is None:
        carddemo_path = CARDDEMO_PATH
    snapshot = load_required(snapshot_path, SNAPSHOT_KEYS)
    mutation = load_required(mutation_path, MUTATION_KEYS)
    carddemo = load_required(carddemo_path, CARDDEMO_KEYS)
    validate_families(carddemo, carddemo_path)
    return snapshot, mutation, carddemo


def relative_label(path, root=None):
    if root is None:
        root = ROOT
    path = Path(path).resolve()
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def count(value, name):
    if isinstance(value, bool) or not isinstance(value, int):
        raise ReportError("{} must be an integer, got {!r}".format(name, value))
    return value


def snapshot_section(snapshot, source):
    cases = count(snapshot["cases"], "snapshot cases")
    lines = ["## UICALC twin snapshot", "Source: {}".format(source), ""]
    lines.append("- Run id: {}".format(snapshot["run_id"]))
    lines.append("- Seed: {}".format(count(snapshot["seed"], "snapshot seed")))
    injected = snapshot["mutation"]
    lines.append("- Injected mutation: {}".format("none" if injected is None else injected))
    lines.append("- Compiler: {}".format(snapshot["compiler"]))
    lines.append("- Verdict: {}".format(snapshot["verdict"]))
    lines.append("- Cases: {}".format(cases))
    lines.append("- Matched: {} of {}".format(count(snapshot["matched"], "snapshot matched"), cases))
    lines.append("- Mismatched: {} of {}".format(count(snapshot["mismatched"], "snapshot mismatched"), cases))
    lines.append("")
    return lines


def mutation_section(mutation, source):
    cases = count(mutation["cases"], "mutation cases")
    lines = ["## Mutation score", "Source: {}".format(source), ""]
    lines.append("- Seed: {}".format(count(mutation["seed"], "mutation seed")))
    lines.append("- Cases: {}".format(cases))
    lines.append(
        "- Baseline mismatches: {} of {}".format(count(mutation["baseline_mismatches"], "baseline_mismatches"), cases)
    )
    lines.append(
        "- Named mutants caught: {} of {}".format(
            count(mutation["named_caught"], "named_caught"), count(mutation["named_total"], "named_total")
        )
    )
    lines.append(
        "- Hidden mutants caught: {} of {}".format(
            count(mutation["hidden_caught"], "hidden_caught"), count(mutation["hidden_total"], "hidden_total")
        )
    )
    lines.append("- Mismatches per mutant (of {} cases):".format(cases))
    for group in ("named", "hidden"):
        for name in sorted(mutation[group]):
            lines.append("  - {}: {} of {}".format(name, count(mutation[group][name], name), cases))
    lines.append("")
    return lines


def carddemo_section(carddemo, source):
    cases = count(carddemo["cases"], "carddemo cases")
    lines = ["## CardDemo interest case study", "Source: {}".format(source), ""]
    lines.append("- Case study: {}".format(carddemo["case_study"]))
    lines.append("- Seed: {}".format(count(carddemo["seed"], "carddemo seed")))
    lines.append("- Compiler: {}".format(carddemo["compiler"]))
    lines.append("- Cases: {}".format(cases))
    lines.append("- Matched: {} of {}".format(count(carddemo["matched"], "carddemo matched"), cases))
    lines.append("- Mismatched: {} of {}".format(count(carddemo["mismatched"], "carddemo mismatched"), cases))
    lines.append("- Families:")
    for name in sorted(carddemo["families"]):
        family = carddemo["families"][name]
        lines.append(
            "  - {}: {} mismatches of {} cases".format(
                name, count(family["mismatches"], name + " mismatches"), count(family["cases"], name + " cases")
            )
        )
    lines.append("")
    return lines


CLOSING_LINE = "These results are counts over the cases run and not a proof of equivalence."


def build_report(snapshot, snapshot_src, mutation, mutation_src, carddemo, carddemo_src):
    lines = ["# Necromancer evidence report", ""]
    lines.extend(snapshot_section(snapshot, snapshot_src))
    lines.extend(mutation_section(mutation, mutation_src))
    lines.extend(carddemo_section(carddemo, carddemo_src))
    lines.append(CLOSING_LINE)
    lines.append("")
    return "\n".join(lines)


def main():
    try:
        snapshot, mutation, carddemo = load_evidence()
        report = build_report(
            snapshot,
            relative_label(SNAPSHOT_PATH),
            mutation,
            relative_label(MUTATION_PATH),
            carddemo,
            relative_label(CARDDEMO_PATH),
        )
    except ReportError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    sys.stdout.write(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
