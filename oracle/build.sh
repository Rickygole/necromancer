#!/bin/sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cobc_bin=${COBC:-cobc}
mkdir -p "$root/bin"
"$cobc_bin" -x -free -o "$root/bin/uicalc" "$root/legacy/UICALC.cbl"
