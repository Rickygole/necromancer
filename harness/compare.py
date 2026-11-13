from dataclasses import dataclass, field

from harness.records import OUTPUT_FIELDS, RESULT_LEN, split_result


@dataclass
class Difference:
    field: str
    oracle: str
    twin: str


@dataclass
class Comparison:
    record: str
    oracle_output: str
    twin_output: str
    diffs: list = field(default_factory=list)

    @property
    def matches(self):
        return not self.diffs


def compare_one(record, oracle_line, twin_line):
    diffs = []
    if len(twin_line) != RESULT_LEN:
        diffs.append(Difference("width", oracle_line, twin_line))
        return Comparison(record, oracle_line, twin_line, diffs)
    if len(oracle_line) != RESULT_LEN:
        diffs.append(Difference("oracle_width", oracle_line, twin_line))
        return Comparison(record, oracle_line, twin_line, diffs)
    left = split_result(oracle_line)
    right = split_result(twin_line)
    for name, _, _ in OUTPUT_FIELDS:
        if left[name] != right[name]:
            diffs.append(Difference(name, left[name], right[name]))
    return Comparison(record, oracle_line, twin_line, diffs)


def compare_batch(records, oracle_lines, twin_lines):
    if len(oracle_lines) != len(records):
        raise ValueError("oracle returned a different number of results")
    if len(twin_lines) != len(records):
        raise ValueError("twin returned a different number of results")
    return [compare_one(r, o, t) for r, o, t in zip(records, oracle_lines, twin_lines)]


def mismatches(comparisons):
    return [c for c in comparisons if not c.matches]


def trace_diff(comparison):
    return {
        "oracle": split_result(comparison.oracle_output)["trace"],
        "twin": split_result(comparison.twin_output)["trace"] if len(comparison.twin_output) == RESULT_LEN else "",
    }
