# Oracle binary pin

The hosted build installs the prebuilt oracle binary only if its sha256 equals the hash in `oracle/pinned-sha256.txt`. The `oracle-latest` release is mutable, the pin lives in the repository, so replacing the release asset cannot change what runs. On a mismatch, a failed download or a missing release, `scripts/fetch-oracle.sh` deletes the binary and the site runs in snapshot-only mode, replaying recorded evidence. The script always exits 0 so the site build does not fail. `bin/ORACLE_VERSION` is written only after the binary has been verified.

## Update the pin after the oracle-linux workflow rebuilds

The workflow runs when `legacy/UICALC.cbl` or the workflow file changes on main, and on manual dispatch. It publishes `uicalc-linux-x64`, `uicalc-linux-x64.sha256` and `uicalc-source.sha256` to the `oracle-latest` release. Until the pin is updated, the new binary is refused and the site is in snapshot-only mode.

1. Check the workflow run is yours and finished: `gh run list --workflow oracle-linux.yml --limit 3`.
2. Read the published hash: `gh release download oracle-latest --pattern uicalc-linux-x64.sha256 --output -`.
3. Compute the hash of the asset yourself and compare it with step 2: `curl -fsSL https://github.com/Rickygole/necromancer/releases/download/oracle-latest/uicalc-linux-x64 | sha256sum`.
4. Write it to the pin: `printf '%s\n' "<hash>" > oracle/pinned-sha256.txt`.
5. Commit the pin and redeploy.

Current pin: `9b4e4c984ab3045b839bbd82f00f34f6eeadba0b435c0632c769e1ea42094266`.

## Test the refusal path locally

`ORACLE_RELEASE_BASE` overrides the download location and accepts a `file://` URL, so a tampered binary can be tried without touching the release. The script deletes `bin/uicalc` and `bin/ORACLE_VERSION` before it starts, so run it in a scratch copy of the repository if you rely on a locally compiled binary.
