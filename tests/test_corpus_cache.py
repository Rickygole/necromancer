import json
import subprocess
import sys
from pathlib import Path

import pytest

from harness import corpus, corpus_cache, engine
from oracle import runner

needs_oracle = pytest.mark.skipif(not runner.oracle_ready(), reason="legacy oracle is not available")
SHAPE = (6, 12, 4242)


@pytest.fixture(autouse=True)
def fresh_memory(monkeypatch):
    monkeypatch.setattr(corpus_cache, "MEMORY", {})


def test_generation_is_repeatable_in_one_context():
    first = corpus_cache.corpus_hash(corpus_cache.generate(*SHAPE))
    second = corpus_cache.corpus_hash(corpus_cache.generate(*SHAPE))
    assert first == second


def test_disk_cache_has_the_same_case_hash_as_direct_generation(tmp_path):
    direct = corpus_cache.generate(*SHAPE)
    path = corpus_cache.write_cache(tmp_path, *SHAPE)
    assert path.exists()
    stored = corpus_cache.read_cache(tmp_path, *SHAPE)
    assert stored is not None
    assert corpus_cache.corpus_hash(stored) == corpus_cache.corpus_hash(direct)


def test_load_returns_the_same_cases_from_disk_memory_and_generation(tmp_path):
    direct_hash = corpus_cache.corpus_hash(corpus_cache.generate(*SHAPE))
    corpus_cache.write_cache(tmp_path, *SHAPE)
    from_disk = corpus_cache.load(*SHAPE, directory=tmp_path)
    from_memory = corpus_cache.load(*SHAPE, directory=tmp_path / "missing")
    uncached = corpus_cache.freeze(corpus_cache.generate(*SHAPE))
    hashes = {corpus_cache.corpus_hash([list(b) for b in c]) for c in (from_disk, from_memory, uncached)}
    assert hashes == {direct_hash}
    assert from_memory is from_disk


def test_load_does_not_regenerate_when_the_disk_cache_is_valid(tmp_path, monkeypatch):
    corpus_cache.write_cache(tmp_path, *SHAPE)

    def refuse(*args):
        raise AssertionError("generated despite a valid cache")

    monkeypatch.setattr(corpus_cache, "generate", refuse)
    assert len(corpus_cache.load(*SHAPE, directory=tmp_path)) == SHAPE[0]


def tamper(path, mutate):
    payload = json.loads(path.read_text())
    mutate(payload)
    path.write_text(json.dumps(payload))


@pytest.mark.parametrize(
    "mutate",
    [
        lambda p: p["key"].update(hypothesis="0.0.0"),
        lambda p: p["key"].update(generator="0" * 64),
        lambda p: p["key"].update(batch_size=1),
        lambda p: p["key"].update(seed=1),
        lambda p: p["batches"][0].append("X" * 80),
        lambda p: p.update(hash="0" * 64),
    ],
)
def test_stale_or_edited_cache_is_ignored(tmp_path, mutate):
    path = corpus_cache.write_cache(tmp_path, *SHAPE)
    tamper(path, mutate)
    assert corpus_cache.read_cache(tmp_path, *SHAPE) is None
    expected = corpus_cache.corpus_hash(corpus_cache.generate(*SHAPE))
    loaded = corpus_cache.load(*SHAPE, directory=tmp_path)
    assert corpus_cache.corpus_hash([list(b) for b in loaded]) == expected


def test_missing_and_corrupt_cache_files_fall_back(tmp_path):
    assert corpus_cache.read_cache(tmp_path, *SHAPE) is None
    corpus_cache.cache_path(tmp_path, *SHAPE).write_text("not json")
    assert corpus_cache.read_cache(tmp_path, *SHAPE) is None


def test_a_different_seed_gives_different_cases():
    other = (SHAPE[0], SHAPE[1], SHAPE[2] + 1)
    assert corpus_cache.corpus_hash(corpus_cache.generate(*SHAPE)) != corpus_cache.corpus_hash(corpus_cache.generate(*other))


ROOT = Path(__file__).resolve().parent.parent
SHAPES = [(2, 50, 731942), (8, 50, 1), (5, 30, 99)]
PROBE = "import json;from harness import corpus_cache as c;print(json.dumps([c.corpus_hash(c.generate(*s)) for s in %r]))" % (SHAPES,)
PRELOADS = {
    "bare": "",
    "backend_app": "import backend.app;",
    "pytest_and_tests": "import pytest,importlib,pkgutil;[importlib.import_module('tests.'+m.name) for m in pkgutil.iter_modules(['tests']) if m.name!='conftest'];",
    "constant_heavy_module": "import sys;sys.path.insert(0,LOUD);import loud;",
}


def corpus_hashes(preload, cwd):
    code = preload + PROBE
    env = {"PYTHONPATH": str(ROOT), "PATH": "/usr/bin:/bin"}
    done = subprocess.run([sys.executable, "-c", code], cwd=cwd, env=env, capture_output=True, text=True, timeout=240)
    assert done.returncode == 0, done.stderr
    return json.loads(done.stdout)


@pytest.fixture
def loud_dir(tmp_path):
    directory = tmp_path / "loud_pkg"
    directory.mkdir()
    numbers = ", ".join(str(123456 + 7919 * i) for i in range(400))
    words = ", ".join(repr("LOUD%dWORD" % i) for i in range(200))
    (directory / "loud.py").write_text("NUMBERS = [%s]\nWORDS = [%s]\n" % (numbers, words))
    return directory


def test_corpus_does_not_depend_on_entry_point_or_loaded_modules(tmp_path, loud_dir):
    results = {}
    for name, preload in PRELOADS.items():
        preload = preload.replace("LOUD", repr(str(loud_dir)))
        results[name] = corpus_hashes(preload, ROOT)
    results["other_cwd"] = corpus_hashes("", tmp_path)
    assert len({json.dumps(v) for v in results.values()}) == 1
    in_process = [corpus_cache.corpus_hash(corpus_cache.generate(*s)) for s in SHAPES]
    assert results["bare"] == in_process


def test_local_constants_are_not_used_by_the_generator(loud_dir):
    before = corpus_cache.corpus_hash(corpus_cache.generate(*SHAPE))
    sys.path.insert(0, str(loud_dir))
    try:
        import loud

        assert loud.NUMBERS
        after = corpus_cache.corpus_hash(corpus_cache.generate(*SHAPE))
    finally:
        sys.path.remove(str(loud_dir))
        sys.modules.pop("loud", None)
    assert before == after


def test_cache_key_has_no_module_dependent_field(tmp_path):
    path = corpus_cache.write_cache(tmp_path, *SHAPE)
    assert set(json.loads(path.read_text())["key"]) == {
        "corpus_version", "generator", "hypothesis", "python", "random_batches", "batch_size", "seed",
    }


def stable(report):
    skip = {"run_id", "seconds"}
    return json.dumps({k: v for k, v in report.items() if k not in skip}, sort_keys=True)


@needs_oracle
def test_report_is_identical_with_and_without_the_cache(tmp_path, monkeypatch):
    kwargs = dict(profile="dev", seed=77, decisions={})
    uncached = engine.run_verification(run_dir=tmp_path / "a", **kwargs)
    cfg = engine.PROFILES["dev"]
    cache_dir = tmp_path / "cache"
    corpus_cache.write_cache(cache_dir, cfg["random_batches"], cfg["batch_size"], 77)
    monkeypatch.setattr(corpus_cache, "CACHE_DIR", cache_dir)
    monkeypatch.setattr(corpus_cache, "MEMORY", {})
    monkeypatch.setattr(corpus_cache, "generate", lambda *a: (_ for _ in ()).throw(AssertionError("generated")))
    cached = engine.run_verification(run_dir=tmp_path / "b", **kwargs)
    assert stable(cached) == stable(uncached)


@needs_oracle
def test_one_oracle_pass_matches_per_batch_runs(oracle_binary):
    batches = [list(b) for b in corpus_cache.generate(8, 50, 5)]
    fixed = corpus.golden() + corpus.boundary() + corpus.invalid_fixed()
    flat = fixed + [r for b in batches for r in b]
    together = []
    for i in range(0, len(flat), runner.BATCH_LIMIT):
        together.extend(runner.run_batch(flat[i:i + runner.BATCH_LIMIT], oracle_binary))
    separate = runner.run_batch(fixed, oracle_binary) if len(fixed) <= runner.BATCH_LIMIT else []
    for batch in batches:
        separate.extend(runner.run_batch(batch, oracle_binary))
    assert together == separate
    singles = [runner.run_batch([r], oracle_binary)[0] for r in flat[:150]]
    assert together[:150] == singles
