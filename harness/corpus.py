import random

from hypothesis import strategies as st

from harness.records import Claim, encode_claim

WAGE_MAX = 999999999
SMALL_MONEY = 9999999


def wages():
    return st.one_of(
        st.integers(0, 3000000),
        st.integers(0, WAGE_MAX),
        st.sampled_from([0, 1, 249999, 250000, 1690000, 2599999, 2600000, 2600001]),
    )


def money():
    return st.one_of(st.integers(0, 200000), st.integers(0, SMALL_MONEY), st.sampled_from([0, 1, 9999999]))


@st.composite
def claims(draw):
    return Claim(
        claimant_id="CLM" + str(draw(st.integers(0, 999999))).zfill(6),
        q1=draw(wages()),
        q2=draw(wages()),
        q3=draw(wages()),
        q4=draw(wages()),
        dependents=draw(st.integers(0, 12)),
        age=draw(st.one_of(st.integers(18, 99), st.sampled_from([61, 62, 63]))),
        retirement=draw(st.sampled_from(["N", "V", "M"])),
        pension=draw(money()),
        severance=draw(money()),
        flag=draw(st.sampled_from(["Y", "N"])),
    )


def valid_records():
    return claims().map(encode_claim)


@st.composite
def invalid_records(draw):
    base = encode_claim(draw(claims()))
    kind = draw(st.sampled_from(["letters", "retirement", "flag", "short", "long", "blank"]))
    if kind == "letters":
        pos = draw(st.integers(9, 63))
        return base[:pos] + draw(st.sampled_from("AXZ-+ .")) + base[pos + 1:]
    if kind == "retirement":
        return base[:49] + draw(st.sampled_from("XZ1 ")) + base[50:]
    if kind == "flag":
        return base[:64] + draw(st.sampled_from("XZ1 y")) + base[65:]
    if kind == "short":
        return base[: draw(st.integers(1, 79))]
    if kind == "long":
        return base + draw(st.text("0123 ", min_size=1, max_size=5))
    return " " * 80


def mixed_records():
    return st.one_of(valid_records(), valid_records(), valid_records(), invalid_records())


def record_batches(max_size):
    return st.lists(mixed_records(), min_size=max(1, max_size // 2), max_size=max_size)


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
    ]


def random_valid_batch(rng, size):
    out = []
    for _ in range(size):
        out.append(
            encode_claim(
                Claim(
                    "CLM" + str(rng.randrange(1000000)).zfill(6),
                    rng.choice([rng.randrange(0, 3000000), rng.randrange(0, WAGE_MAX)]),
                    rng.choice([rng.randrange(0, 3000000), rng.randrange(0, WAGE_MAX)]),
                    rng.choice([rng.randrange(0, 3000000), rng.randrange(0, WAGE_MAX)]),
                    rng.choice([rng.randrange(0, 3000000), rng.randrange(0, WAGE_MAX)]),
                    rng.randrange(0, 13),
                    rng.randrange(18, 100),
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
