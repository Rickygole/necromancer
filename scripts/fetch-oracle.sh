#!/bin/sh
root=$(cd "$(dirname "$0")/.." && pwd)
base=${ORACLE_RELEASE_BASE:-https://github.com/Rickygole/necromancer/releases/download/oracle-latest}
bin="$root/bin"

digest() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

die() {
  rm -f "$bin/uicalc" "$bin/intwrap" "$bin"/*.download "$bin/ORACLE_VERSION"
  echo "oracle: $1" >&2
  echo "oracle: the build is stopped, a deploy without a verified oracle is not made" >&2
  exit 1
}

pin_for() {
  [ -s "$1" ] || die "no pinned hash in $1"
  value=$(cut -d' ' -f1 "$1" | tr -d '[:space:]')
  case "$value" in
    *[!0-9a-f]*) die "pinned hash in $1 is malformed" ;;
  esac
  [ "${#value}" -eq 64 ] || die "pinned hash in $1 is malformed"
  echo "$value"
}

fetch_verified() {
  name=$1
  pin=$2
  curl -fsSL --retry 2 -o "$bin/$name.download" "$base/$name-linux-x64" || die "release binary $name-linux-x64 not available"
  got=$(digest "$bin/$name.download")
  [ "$got" = "$pin" ] || die "$name-linux-x64 sha256 $got does not match the pinned $pin, not executing it"
}

mkdir -p "$bin"
rm -f "$bin/uicalc" "$bin/intwrap" "$bin"/*.download "$bin/ORACLE_VERSION"

uicalc_pin=$(pin_for "$root/oracle/pinned-sha256.txt")
intwrap_pin=$(pin_for "$root/oracle/pinned-intwrap-sha256.txt")

fetch_verified uicalc "$uicalc_pin"
fetch_verified intwrap "$intwrap_pin"

curl -fsSL --retry 2 -o "$bin/source.sha256" "$base/uicalc-source.sha256" || die "release source hash not available"
want=$(cut -d' ' -f1 "$bin/source.sha256")
have=$(digest "$root/legacy/UICALC.cbl")
[ "$want" = "$have" ] || die "verified UICALC binary was built from a different UICALC.cbl than this checkout"

curl -fsSL --retry 2 -o "$bin/intwrap-source.sha256" "$base/intwrap-source.sha256" || die "release CardDemo source hashes not available"
checked=0
while read -r hash file; do
  [ -n "$file" ] || continue
  checked=$((checked + 1))
  have=$(digest "$root/case_studies/carddemo_interest/$file")
  [ "$hash" = "$have" ] || die "verified CardDemo binary was built from a different $file than this checkout"
done < "$bin/intwrap-source.sha256"
[ "$checked" -gt 0 ] || die "release CardDemo source hash list is empty"

mv "$bin/uicalc.download" "$bin/uicalc"
mv "$bin/intwrap.download" "$bin/intwrap"
chmod +x "$bin/uicalc" "$bin/intwrap"
rm -f "$bin/source.sha256" "$bin/intwrap-source.sha256"
echo "cobc (GnuCOBOL) 3.1.2.0 (prebuilt, sha256 $uicalc_pin)" > "$bin/ORACLE_VERSION"
echo "cobc (GnuCOBOL) 3.1.2.0 (prebuilt, sha256 $intwrap_pin)" > "$bin/INTWRAP_VERSION"
echo "oracle: both binaries verified against their pinned sha256 and installed"
exit 0
