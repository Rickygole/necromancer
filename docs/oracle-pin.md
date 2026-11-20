# Oracle binary pin

The hosted build installs the prebuilt oracle binary only if its sha256 equals the hash in `oracle/pinned-sha256.txt`. The `oracle-latest` release is mutable, the pin lives in the repository, so replacing the release asset cannot change what runs. On a mismatch, a failed download or a missing release, `scripts/fetch-oracle.sh` deletes both binaries and exits 1, so the build fails and the previous deployment keeps serving. There is no snapshot-only mode and no replay in its place. `bin/ORACLE_VERSION` is written only after both binaries have been verified. The same rule covers the CardDemo oracle binary `intwrap-linux-x64`, pinned in `oracle/pinned-intwrap-sha256.txt`, and the script also checks that it was built from the `INTWRAP.cbl` and vendored files in this checkout.

## Update the pin after the oracle-linux workflow rebuilds

The workflow runs when `legacy/UICALC.cbl` or the workflow file changes on main, and on manual dispatch. It publishes both binaries and their hash files to the `oracle-latest` release. Every rebuild changes the binary hash, so until both pins are updated the next build is refused and stops.

1. Check the workflow run is yours and finished: `gh run list --workflow oracle-linux.yml --limit 3`.
2. Read the published hash: `gh release download oracle-latest --pattern uicalc-linux-x64.sha256 --output -`.
3. Compute the hash of the asset yourself and compare it with step 2: `curl -fsSL https://github.com/Rickygole/necromancer/releases/download/oracle-latest/uicalc-linux-x64 | sha256sum`.
4. Write it to the pin: `printf '%s\n' "<hash>" > oracle/pinned-sha256.txt`. Do the same for `intwrap-linux-x64` and `oracle/pinned-intwrap-sha256.txt`.
5. Commit the pin and redeploy.

Current pins: UICALC `7fd2e8993bec78ee627b54caf04170759328591c164978aaa0ee936af61e62b3`, CardDemo `3dd18e4d12422d52a8db374c46cb9ae0722535f9eb00954dce1c8e9102a456ae`.

## Test the refusal path locally

`ORACLE_RELEASE_BASE` overrides the download location and accepts a `file://` URL, so a tampered binary can be tried without touching the release. The script deletes `bin/uicalc` and `bin/ORACLE_VERSION` before it starts, so run it in a scratch copy of the repository if you rely on a locally compiled binary.
