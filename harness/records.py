from dataclasses import dataclass

RECORD_LEN = 80
RESULT_LEN = 40

INPUT_FIELDS = [
    ("claimant_id", 0, 9),
    ("q1", 9, 18),
    ("q2", 18, 27),
    ("q3", 27, 36),
    ("q4", 36, 45),
    ("dependents", 45, 47),
    ("age", 47, 49),
    ("retirement", 49, 50),
    ("pension", 50, 57),
    ("severance", 57, 64),
    ("flag", 64, 65),
    ("filler", 65, 80),
]

OUTPUT_FIELDS = [
    ("status", 0, 2),
    ("base", 2, 9),
    ("allowance", 9, 16),
    ("offset", 16, 23),
    ("net", 23, 30),
    ("trace", 30, 40),
]


@dataclass(frozen=True)
class Claim:
    claimant_id: str = "CLM000001"
    q1: int = 0
    q2: int = 0
    q3: int = 0
    q4: int = 0
    dependents: int = 0
    age: int = 40
    retirement: str = "N"
    pension: int = 0
    severance: int = 0
    flag: str = "N"


def encode_claim(claim):
    return (
        claim.claimant_id.ljust(9)[:9]
        + str(claim.q1).zfill(9)
        + str(claim.q2).zfill(9)
        + str(claim.q3).zfill(9)
        + str(claim.q4).zfill(9)
        + str(claim.dependents).zfill(2)
        + str(claim.age).zfill(2)
        + claim.retirement
        + str(claim.pension).zfill(7)
        + str(claim.severance).zfill(7)
        + claim.flag
        + " " * 15
    )


def parse_claim(record):
    if len(record) != RECORD_LEN:
        raise ValueError("record must be 80 bytes")
    raw = {name: record[a:b] for name, a, b in INPUT_FIELDS}
    return Claim(
        claimant_id=raw["claimant_id"],
        q1=int(raw["q1"]),
        q2=int(raw["q2"]),
        q3=int(raw["q3"]),
        q4=int(raw["q4"]),
        dependents=int(raw["dependents"]),
        age=int(raw["age"]),
        retirement=raw["retirement"],
        pension=int(raw["pension"]),
        severance=int(raw["severance"]),
        flag=raw["flag"],
    )


def split_result(line):
    return {name: line[a:b] for name, a, b in OUTPUT_FIELDS}


def cents(text):
    return int(text)
