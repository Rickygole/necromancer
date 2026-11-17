from harness.compare import Comparison, Difference

from case_studies.carddemo_interest.layout import OUTPUT_FIELDS, RESULT_LEN, split_result


def compare_one(record, oracle_line, twin_line):
    diffs = []
    if len(oracle_line) != RESULT_LEN:
        diffs.append(Difference("oracle_width", oracle_line, twin_line))
        return Comparison(record, oracle_line, twin_line, diffs)
    if len(twin_line) != RESULT_LEN:
        diffs.append(Difference("width", oracle_line, twin_line))
        return Comparison(record, oracle_line, twin_line, diffs)
    left = split_result(oracle_line)
    right = split_result(twin_line)
    for name, _, _ in OUTPUT_FIELDS:
        if left[name] != right[name]:
            diffs.append(Difference(name, left[name], right[name]))
    return Comparison(record, oracle_line, twin_line, diffs)


def compare_batch(records, oracle_lines, twin_lines):
    if len(oracle_lines) != len(records) or len(twin_lines) != len(records):
        raise ValueError("result count differs from record count")
    return [compare_one(r, o, t) for r, o, t in zip(records, oracle_lines, twin_lines)]
