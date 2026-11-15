#!/bin/sh
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root" || exit 0
rm -rf "$root/harness/corpus_cache"
py=
for candidate in "$root/.venv/bin/python" python3; do
  if "$candidate" -c "import hypothesis, fastapi" >/dev/null 2>&1; then
    py=$candidate
    break
  fi
done
if [ -n "$py" ] && "$py" -m harness.corpus_cache; then
  echo "corpus cache ready"
else
  rm -rf "$root/harness/corpus_cache"
  echo "corpus cache not built, runs will generate the corpus"
fi
exit 0
