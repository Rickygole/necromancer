import random

from hypothesis import strategies as st

from harness.records import Claim, encode_claim

WAGE_MAX = 999999999
SMALL_MONEY = 9999999
CR_BOUNDARIES = [0, 9, 18, 27, 36, 45, 47, 49, 50, 57, 64, 65, 79, 80]


WAGES = st.one_of(
    st.just(0),
    st.just(0),
    st.just(0),
    st.integers(0, 3000000),
    st.integers(0, WAGE_MAX),
    st.sampled_from([0, 1, 249999, 250000, 1690000, 2599999, 2600000, 2600001]),
)
MONEY = st.one_of(st.integers(0, 200000), st.integers(0, SMALL_MONEY), st.sampled_from([0, 1, 9999999]))
CLAIM_ID = st.integers(0, 999999)
DEPENDENTS = st.one_of(st.integers(0, 12), st.integers(13, 99))
AGES = st.one_of(st.integers(0, 17), st.integers(18, 99), st.sampled_from([61, 62, 63]))
RETIREMENT = st.sampled_from(["N", "V", "M"])
FLAG = st.sampled_from(["Y", "N"])
KINDS = st.sampled_from(["letters", "retirement", "flag", "short", "long", "blank",
                         "cr_middle", "cr_trailing", "cr_start", "cr_insert", "cr_boundary", "cr_junk", "cr_many", "nonascii_id", "nonascii_filler", "nonascii_numeric"])
LETTER_POS = st.integers(9, 63)
LETTER_CHAR = st.sampled_from("AXZ-+ .")
RET_CHAR = st.sampled_from("XZ1 ")
FLAG_CHAR = st.sampled_from("XZ1 y")
SHORT_LEN = st.integers(1, 79)
LONG_TAIL = st.text("0123 ", min_size=1, max_size=5)
MID_POS = st.integers(1, 78)
CR_TRAILING = st.integers(1, 3)
CR_INSERT_POS = st.integers(0, 80)
CR_BOUNDARY_POS = st.sampled_from(CR_BOUNDARIES)
CR_JUNK = st.text("GARBAGEX0123 ", min_size=1, max_size=8)
CR_MANY_COUNT = st.integers(4, 12)
NONASCII_ID_POS = st.integers(0, 8)
NONASCII_ID_CHAR = st.sampled_from("\u00e9\u00fc\u4e2d")
NONASCII_FILLER_POS = st.integers(65, 79)
NONASCII_NUMERIC_POS = st.integers(9, 63)
NONASCII_NUMERIC_CHAR = st.sampled_from("\u00e9\u0663\u4e2d")


def wages():
    return WAGES


def money():
    return MONEY


@st.composite
def claims(draw):
    return Claim(
        claimant_id="CLM" + str(draw(CLAIM_ID)).zfill(6),
        q1=draw(WAGES),
        q2=draw(WAGES),
        q3=draw(WAGES),
        q4=draw(WAGES),
        dependents=draw(DEPENDENTS),
        age=draw(AGES),
        retirement=draw(RETIREMENT),
        pension=draw(MONEY),
        severance=draw(MONEY),
        flag=draw(FLAG),
    )


CLAIMS = claims()
VALID_RECORDS = CLAIMS.map(encode_claim)


def valid_records():
    return VALID_RECORDS


@st.composite
def invalid_records(draw):
    base = encode_claim(draw(CLAIMS))
    kind = draw(KINDS)
    if kind == "letters":
        pos = draw(LETTER_POS)
        return base[:pos] + draw(LETTER_CHAR) + base[pos + 1:]
    if kind == "retirement":
        return base[:49] + draw(RET_CHAR) + base[50:]
    if kind == "flag":
        return base[:64] + draw(FLAG_CHAR) + base[65:]
    if kind == "short":
        return base[: draw(SHORT_LEN)]
    if kind == "long":
        return base + draw(LONG_TAIL)
    if kind == "cr_middle":
        pos = draw(MID_POS)
        return base[:pos] + "\r" + base[pos + 1:]
    if kind == "cr_trailing":
        return base + "\r" * draw(CR_TRAILING)
    if kind == "cr_start":
        return "\r" * draw(CR_TRAILING) + base
    if kind == "cr_insert":
        pos = draw(CR_INSERT_POS)
        return base[:pos] + "\r" + base[pos:]
    if kind == "cr_boundary":
        pos = draw(CR_BOUNDARY_POS)
        return base[:pos] + "\r" + base[pos:]
    if kind == "cr_junk":
        return base + "\r" + draw(CR_JUNK)
    if kind == "cr_many":
        out = base
        for _ in range(draw(CR_MANY_COUNT)):
            pos = draw(st.integers(0, len(out)))
            out = out[:pos] + "\r" + out[pos:]
        return out
    if kind == "nonascii_id":
        pos = draw(NONASCII_ID_POS)
        return base[:pos] + draw(NONASCII_ID_CHAR) + base[pos + 1:]
    if kind == "nonascii_filler":
        pos = draw(NONASCII_FILLER_POS)
        return base[:pos] + draw(NONASCII_ID_CHAR) + base[pos + 1:]
    if kind == "nonascii_numeric":
        pos = draw(NONASCII_NUMERIC_POS)
        return base[:pos] + draw(NONASCII_NUMERIC_CHAR) + base[pos + 1:]
    return " " * 80


INVALID_RECORDS = invalid_records()
MIXED_RECORDS = st.one_of(CLAIMS.map(encode_claim), CLAIMS.map(encode_claim), CLAIMS.map(encode_claim), INVALID_RECORDS)


def mixed_records():
    return MIXED_RECORDS


def record_batches(max_size):
    return st.lists(MIXED_RECORDS, min_size=max(1, max_size // 2), max_size=max_size)


def golden():
    return [
        encode_claim(Claim("GOLD00001", 1250050, 800000, 900000, 700000, 2, 45)),
        encode_claim(Claim("GOLD00002", 1500000, 0, 0, 0, 0, 50)),
        encode_claim(Claim("GOLD00003", 200000, 50000, 0, 0, 0, 38)),
        encode_claim(Claim("GOLD00004", 900000, 900000, 900000, 900000, 3, 58, "V", 12000, 0)),
        encode_claim(Claim("GOLD00005", 900000, 900000, 900000, 900000, 0, 64, "M", 30000, 10000)),
    ]


def boundary():
    out = []
    for total in (249999, 250000, 250001):
        out.append(encode_claim(Claim("BNDT" + str(total).zfill(5), total // 2, total - total // 2)))
    for high in (1689974, 1689975, 1690000, 1690001, 1715999, 1716000, 2599999, 2600000, 2600001):
        out.append(encode_claim(Claim("BNDH" + str(high).zfill(5)[-5:], high, 100000, 100000, 100000)))
    for age in (61, 62, 63):
        for code in ("N", "V", "M"):
            out.append(encode_claim(Claim("BNDA" + str(age) + code, 900000, 900000, 900000, 900000, 0, age, code, 5000, 2000)))
    for dep in (0, 1, 4, 5, 12):
        out.append(encode_claim(Claim("BNDD" + str(dep).zfill(2), 900000, 900000, 900000, 900000, dep)))
    out.append(encode_claim(Claim("BNDQ4Y", 100000, 100000, 100000, 5000000, 0, 40, "N", 0, 0, "Y")))
    out.append(encode_claim(Claim("BNDWRAP", 900000, 900000, 900000, 900000, 0, 40, "N", 9999999, 9999999)))
    out.append(encode_claim(Claim("BNDZERO", 0, 0, 0, 0)))
    out.append(encode_claim(Claim("EQCEIL", 260000, 260000, 260000, 20000)))
    out.append(encode_claim(Claim("SUBDOL", 500000, 50, 0, 0)))
    for total in (249999, 250000, 250001):
        splits = {
            "Q1": (total, 0, 0, 0),
            "Q12": (total // 2, total - total // 2, 0, 0),
            "Q4W": (total // 4, total // 4, total // 4, total - 3 * (total // 4)),
        }
        for label, quarters in splits.items():
            for flag in ("N", "Y"):
                out.append(encode_claim(Claim("TH" + label + str(total)[-3:] + flag, *quarters, flag=flag)))
        out.append(encode_claim(Claim("THQ3" + str(total)[-3:], 0, 0, total, 0)))
        out.append(encode_claim(Claim("THQ34" + str(total)[-3:], 0, 0, total // 2, total - total // 2)))
    return out


def invalid_fixed():
    base = encode_claim(Claim("INVALID01", 900000, 900000, 900000, 900000))
    return [
        base[:12] + "A" + base[13:],
        base[:49] + "X" + base[50:],
        base[:64] + "Q" + base[65:],
        base[:79],
        base + "0",
        " " * 80,
    ] + crlf_cases(base)


def crlf_cases(base):
    return [
        base + "\r",
        base[:79] + "\r",
        base[:70] + "\r" + base[71:],
        base + "\r\r",
        "\r" + base,
        "\r\r\r" + base,
        base + "\rGARBAGE",
        base + "\rXXXXX",
        base + "\r" + "0" * 40,
        base[:9] + "\r" + base[9:],
        base[:20] + "\r" + base[20:],
        base[:45] + "\r" + base[45:],
        base[:49] + "\r" + base[49:],
        base[:64] + "\r" + base[64:],
        base[:65] + "\r" + base[65:],
        base[:40] + "\r\r" + base[40:] + "\r",
        "\r".join(base),
        base[:30] + "\r" + base[31:],
        base[:9] + "\r" + base[10:],
        base[:64] + "\r" + base[65:],
        "CLM\u00e900001" + base[9:],
        base[:70] + "\u00e9" + base[71:],
        base[:20] + "\u00e9" + base[21:],
        base[:45] + "\u0663\u0663" + base[47:],
    ]


def random_wage(rng):
    if rng.random() < 0.5:
        return 0
    return rng.choice([rng.randrange(0, 3000000), rng.randrange(0, WAGE_MAX)])


def random_valid_batch(rng, size):
    out = []
    for _ in range(size):
        out.append(
            encode_claim(
                Claim(
                    "CLM" + str(rng.randrange(1000000)).zfill(6),
                    random_wage(rng),
                    random_wage(rng),
                    random_wage(rng),
                    random_wage(rng),
                    rng.choice([rng.randrange(0, 13), rng.randrange(13, 100)]),
                    rng.choice([rng.randrange(0, 18), rng.randrange(18, 100), rng.randrange(61, 64)]),
                    rng.choice("NVM"),
                    rng.choice([0, rng.randrange(0, 200000), rng.randrange(0, SMALL_MONEY)]),
                    rng.choice([0, rng.randrange(0, 200000), rng.randrange(0, SMALL_MONEY)]),
                    rng.choice("YN"),
                )
            )
        )
    return out


def seeded_rng(seed):
    return random.Random(seed)
