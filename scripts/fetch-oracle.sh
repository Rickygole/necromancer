#!/bin/sh
root=$(cd "$(dirname "$0")/.." && pwd)
base=${ORACLE_RELEASE_BASE:-https://github.com/Rickygole/necromancer/releases/download/oracle-latest}
pin_file="$root/oracle/pinned-sha256.txt"
bin="$root/bin"

digest() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

snapshot_only() {
  rm -f "$bin/uicalc" "$bin/uicalc.download" "$bin/source.sha256" "$bin/ORACLE_VERSION"
  echo "oracle: $1"
  echo "oracle: snapshot-only mode, the hosted app will replay recorded evidence"
  exit 0
}

mkdir -p "$bin"
rm -f "$bin/uicalc" "$bin/uicalc.download" "$bin/source.sha256" "$bin/ORACLE_VERSION"

[ -s "$pin_file" ] || snapshot_only "no pinned hash in oracle/pinned-sha256.txt"
pinned=$(cut -d' ' -f1 "$pin_file" | tr -d '[:space:]')
case "$pinned" in
  *[!0-9a-f]*) snapshot_only "pinned hash is malformed" ;;
esac
[ "${#pinned}" -eq 64 ] || snapshot_only "pinned hash is malformed"

curl -fsSL --retry 2 -o "$bin/uicalc.download" "$base/uicalc-linux-x64" || snapshot_only "release binary not available"
curl -fsSL --retry 2 -o "$bin/source.sha256" "$base/uicalc-source.sha256" || snapshot_only "release source hash not available"

got=$(digest "$bin/uicalc.download")
if [ "$got" != "$pinned" ]; then
  snapshot_only "downloaded binary sha256 $got does not match the pinned $pinned, not executing it"
fi

want=$(cut -d' ' -f1 "$bin/source.sha256")
have=$(digest "$root/legacy/UICALC.cbl")
if [ "$want" != "$have" ]; then
  snapshot_only "verified binary was built from a different UICALC.cbl than this checkout"
fi

mv "$bin/uicalc.download" "$bin/uicalc"
chmod +x "$bin/uicalc"
rm -f "$bin/source.sha256"
echo "cobc (GnuCOBOL) 3.1.2.0 (prebuilt, sha256 $pinned)" > "$bin/ORACLE_VERSION"
echo "oracle: binary verified against the pinned sha256 and installed"
exit 0
