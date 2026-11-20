import hashlib
import importlib
import json
import sys
import threading
from pathlib import Path

import hypothesis
from hypothesis import HealthCheck, Phase, given, seed as hyp_seed, settings

from harness import corpus, provider
from harness.profiles import CORPUS_VERSION, DEFAULT_SEED, PROFILES

CACHE_DIR = Path(__file__).resolve().parent / "corpus_cache"
SOURCES = ("corpus.py", "records.py", "profiles.py", "provider.py")
PRECOMPUTED_PROFILES = ("dev", "demo", "full")
MEMORY_LIMIT = 8

MEMORY = {}
LOCK = threading.Lock()


def generator_hash():
    digest = hashlib.sha256()
    for name in SOURCES:
        digest.update(name.encode())
        digest.update((Path(__file__).resolve().parent / name).read_bytes())
    return digest.hexdigest()


def cache_key(batches, size, seed):
    return {
        "corpus_version": CORPUS_VERSION,
        "generator": generator_hash(),
        "hypothesis": hypothesis.__version__,
        "python": "%d.%d" % sys.version_info[:2],
        "random_batches": batches,
        "batch_size": size,
        "seed": seed,
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
        backend=provider.BACKEND,
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
    generated = generate(batches, size, seed)
    payload = {"key": cache_key(batches, size, seed), "hash": corpus_hash(generated), "batches": generated}
    path = cache_path(directory, batches, size, seed)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload))
    return path


def read_cache(directory, batches, size, seed):
    path = cache_path(directory, batches, size, seed)
    try:
        payload = json.loads(path.read_text())
        stored = payload["batches"]
        if payload["key"] != cache_key(batches, size, seed) or payload["hash"] != corpus_hash(stored):
            return None
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return stored


def freeze(batches):
    return tuple(tuple(b) for b in batches)


def load(batches, size, seed, directory=None):
    ident = (batches, size, seed)
    with LOCK:
        hit = MEMORY.get(ident)
    if hit is not None:
        return hit
    stored = read_cache(directory or CACHE_DIR, batches, size, seed)
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
