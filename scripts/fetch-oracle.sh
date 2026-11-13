#!/bin/sh
root=$(cd "$(dirname "$0")/.." && pwd)
base=https://github.com/Rickygole/necromancer/releases/download/oracle-latest
mkdir -p "$root/bin"
if curl -fsSL -o "$root/bin/uicalc.download" "$base/uicalc-linux-x64" && curl -fsSL -o "$root/bin/source.sha256" "$base/uicalc-source.sha256"; then
  want=$(cut -d' ' -f1 "$root/bin/source.sha256")
  have=$(sha256sum "$root/legacy/UICALC.cbl" | cut -d' ' -f1)
  if [ "$want" = "$have" ]; then
    mv "$root/bin/uicalc.download" "$root/bin/uicalc"
    chmod +x "$root/bin/uicalc"
    echo "cobc (GnuCOBOL) 3.1.2.0 (prebuilt)" > "$root/bin/ORACLE_VERSION"
    echo "oracle binary installed"
  else
    rm -f "$root/bin/uicalc.download"
    echo "oracle binary does not match the current source, skipping"
  fi
else
  echo "oracle binary not available, the hosted app will replay recorded evidence"
fi
exit 0
