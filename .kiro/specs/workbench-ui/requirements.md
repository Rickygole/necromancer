# Requirements: workbench-ui

## Console
1. THE console SHALL show three panes: the legacy source, the live verification, and the Python twin.
2. THE console SHALL use exactly six states: NOT RUN, BUILD FAILED, MATCH, MISMATCH, RUNTIME ERROR and APPROVAL REQUIRED.
3. THE console SHALL show every count with its denominator.
4. THE console SHALL never convey status by color alone.

## Gates
1. WHEN a class of mismatch is shown, THE console SHALL offer preserve or correct and store the choice with reviewer and note.
2. WHEN a full run is green, THE console SHALL show the approval card with case count, seed, hashes and limitations.
3. THE console SHALL never deploy or overwrite anything on approval.

## Demo
1. WHEN the guided demo runs, THE console SHALL use real runs in a scripted order.
2. THE console SHALL label any active mutation INJECTED.
3. WHEN the oracle is unavailable, THE console SHALL replay the recorded snapshot and say so.
