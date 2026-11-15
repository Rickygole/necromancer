import hashlib
import importlib
import json
import sys
import threading
from pathlib import Path

import hypothesis
from hypothesis import HealthCheck, Phase, given, seed as hyp_seed, settings

from harness import corpus
from harness.profiles import CORPUS_VERSION, DEFAULT_SEED, PROFILES

CACHE_DIR = Path(__file__).resolve().parent / "corpus_cache"
SOURCES = ("corpus.py", "records.py", "profiles.py")
PRECOMPUTED_PROFILES = ("dev", "demo")
MEMORY_LIMIT = 8

MEMORY = {}
LOCK = threading.Lock()


def generator_hash():
    digest = hashlib.sha256()
    for name in SOURCES:
        digest.update(name.encode())
        digest.update((Path(__file__).resolve().parent / name).read_bytes())
    return digest.hexdigest()


def constants_fingerprint():
    try:
        from hypothesis.internal.conjecture.providers import _get_local_constants

        found = _get_local_constants()
        digest = hashlib.sha256()
        for kind in ("integers", "floats", "bytes", "strings"):
            values = getattr(found, kind)
            if kind == "floats":
                rendered = sorted(float(v).hex() for v in values)
            else:
                rendered = sorted(repr(v) for v in values)
            digest.update(kind.encode())
            digest.update("\x00".join(rendered).encode("utf-8", "backslashreplace"))
            digest.update(b"\x01")
        return digest.hexdigest()
    except Exception:
        return None


def cache_key(batches, size, seed, fingerprint):
    return {
        "corpus_version": CORPUS_VERSION,
        "generator": generator_hash(),
        "hypothesis": hypothesis.__version__,
        "python": "%d.%d" % sys.version_info[:2],
        "random_batches": batches,
        "batch_size": size,
        "seed": seed,
        "constants": fingerprint,
    }


def generate(batches, size, seed):
    out = []

    def collect(batch):
        out.append(batch)

    collector = given(corpus.record_batches(size))(collect)
    collector = hyp_seed(seed)(collector)
    collector = settings(
        max_examples=batches,
        database=None,
        deadline=None,
        phases=[Phase.generate],
        suppress_health_check=list(HealthCheck),
    )(collector)
    collector()
    return out


def corpus_hash(batches):
    return hashlib.sha256(json.dumps(batches).encode()).hexdigest()


def cache_path(directory, batches, size, seed):
    return Path(directory) / ("%dx%d_%d.json" % (batches, size, seed))


def write_cache(directory, batches, size, seed):
    fingerprint = constants_fingerprint()
    if fingerprint is None:
        raise RuntimeError("hypothesis constants are not readable")
    generated = generate(batches, size, seed)
    payload = {"key": cache_key(batches, size, seed, fingerprint), "hash": corpus_hash(generated), "batches": generated}
    path = cache_path(directory, batches, size, seed)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload))
    return path


def read_cache(directory, batches, size, seed, fingerprint):
    path = cache_path(directory, batches, size, seed)
    try:
        payload = json.loads(path.read_text())
        stored = payload["batches"]
        if payload["key"] != cache_key(batches, size, seed, fingerprint) or payload["hash"] != corpus_hash(stored):
            return None
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return stored


def freeze(batches):
    return tuple(tuple(b) for b in batches)


def load(batches, size, seed, directory=None):
    fingerprint = constants_fingerprint()
    if fingerprint is None:
        return freeze(generate(batches, size, seed))
    ident = (batches, size, seed, fingerprint)
    with LOCK:
        hit = MEMORY.get(ident)
    if hit is not None:
        return hit
    stored = read_cache(directory or CACHE_DIR, batches, size, seed, fingerprint)
    frozen = freeze(stored if stored is not None else generate(batches, size, seed))
    with LOCK:
        if len(MEMORY) >= MEMORY_LIMIT:
            MEMORY.pop(next(iter(MEMORY)))
        MEMORY[ident] = frozen
    return frozen


def precompute(directory=None, seed=DEFAULT_SEED):
    paths = []
    for name in PRECOMPUTED_PROFILES:
        cfg = PROFILES[name]
        paths.append(write_cache(directory or CACHE_DIR, cfg["random_batches"], cfg["batch_size"], seed))
    return paths


def main():
    try:
        importlib.import_module("backend.app")
    except ImportError:
        pass
    for written in precompute():
        print("corpus cache written", written.name)


if __name__ == "__main__":
    main()
