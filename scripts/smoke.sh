#!/bin/sh
base=${1:-https://necromancer-rickygole32-8911s-projects.vercel.app}
base=${base%/}
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
passed=""

fail() {
  echo "FAIL: $1" >&2
  if [ -s "$tmp" ]; then
    head -c 400 "$tmp" >&2
    echo >&2
  fi
  exit 1
}

pass() {
  passed="$passed
  ok  $1"
}

request() {
  method=$1
  path=$2
  data=$3
  if [ -n "$data" ]; then
    code=$(curl -sS -m 90 -o "$tmp" -w '%{http_code}' -X "$method" -H 'Content-Type: application/json' -d "$data" "$base$path") || fail "$method $path could not connect"
  else
    code=$(curl -sS -m 90 -o "$tmp" -w '%{http_code}' -X "$method" "$base$path") || fail "$method $path could not connect"
  fi
}

expect_status() {
  [ "$code" = "$1" ] || fail "$method $path returned $code, expected $1"
}

expect_body() {
  grep -q "$1" "$tmp" || fail "$method $path body does not contain $1"
}

method=GET; path=/
request GET / ""
expect_status 200
pass "GET / 200"

path=/api/health
request GET /api/health ""
expect_status 200
expect_body '"oracle_available"'
pass "GET /api/health has oracle_available"
oracle=false
grep -Eq '"oracle_available" *: *true' "$tmp" && oracle=true

request GET /api/snapshot ""
expect_status 200
pass "GET /api/snapshot 200"

request GET /api/mutation-score ""
expect_status 200
pass "GET /api/mutation-score 200"

request GET /api/report ""
expect_status 200
expect_body '^# Necromancer evidence report'
expect_body 'not a proof of equivalence'
pass "GET /api/report returns the evidence report"

request GET /api/decisions ""
expect_status 200
records=$(grep -o '"id" *: *"dec_' "$tmp" | wc -l | tr -d ' ')
[ "$records" = "3" ] || fail "GET /api/decisions returned $records records, expected 3"
pass "GET /api/decisions returns 3 records"

[ "$oracle" = "true" ] || fail "oracle_available is false, there is no recorded replay in its place"

request POST /api/live '{"profile":"dev"}'
expect_status 200
grep -Eq '"verdict" *: *"MATCH"' "$tmp" || fail "POST /api/live dev verdict was not MATCH"
pass "POST /api/live dev verdict MATCH"

request POST /api/live '{"profile":"full"}'
expect_status 200
grep -Eq '"verdict" *: *"APPROVAL REQUIRED"' "$tmp" || fail "POST /api/live full verdict was not APPROVAL REQUIRED"
pass "POST /api/live full runs live and ends in APPROVAL REQUIRED"

request GET /api/migration ""
expect_status 200
expect_body '1300-COMPUTE-INTEREST'
pass "GET /api/migration lists the candidate translations"

ids=$(grep -o '"id": *"[a-z0-9_]*"' "$tmp" | sed 's/.*"\([a-z0-9_]*\)"$/\1/' | head -n 4)
for id in $ids; do
  request POST /api/migration/verify "{\"candidate\":\"$id\"}"
  expect_status 200
  expect_body '"mismatched"'
  pass "POST /api/migration/verify $id ran against the live CardDemo oracle"
done

request GET /api/no-such-route ""
expect_status 404
grep -Eq '"code" *: *"NOT_FOUND"' "$tmp" || fail "unknown route did not return code NOT_FOUND"
pass "unknown route returns NOT_FOUND"

echo "smoke checks against $base"
echo "$passed" | sed '1d'
echo "all checks passed"
