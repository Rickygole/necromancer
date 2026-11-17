from dataclasses import dataclass

RECORD_LEN = 31
RESULT_LEN = 40
AMOUNT_DIGITS = 11
RATE_DIGITS = 6

OUTPUT_FIELDS = [
    ("monthly", 0, 12),
    ("total", 12, 24),
    ("pad", 24, 40),
]


@dataclass(frozen=True)
class Case:
    total: int = 0
    balance: int = 0
    rate: int = 0


def signed_text(value, digits):
    sign = "-" if value < 0 else "+"
    return sign + str(abs(value)).zfill(digits)


def encode(case):
    return (
        signed_text(case.total, AMOUNT_DIGITS)
        + signed_text(case.balance, AMOUNT_DIGITS)
        + signed_text(case.rate, RATE_DIGITS)
    )


def decode(record):
    if len(record) != RECORD_LEN:
        raise ValueError("record must be %d characters" % RECORD_LEN)

    def number(start, digits):
        text = record[start:start + 1 + digits]
        if text[0] not in "+-" or not text[1:].isdigit():
            raise ValueError("bad numeric field")
        return int(text[1:]) * (-1 if text[0] == "-" else 1)

    return Case(number(0, AMOUNT_DIGITS), number(12, AMOUNT_DIGITS), number(24, RATE_DIGITS))


def split_result(line):
    return {name: line[start:end] for name, start, end in OUTPUT_FIELDS}
