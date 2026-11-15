export interface PatchState {
  phase: "idle" | "applying" | "applied" | "error";
  diff: string | null;
  runId: string | null;
  error: string | null;
  recorded?: boolean;
}

interface Props {
  patch: PatchState;
  busy: boolean;
  onExorcise: () => void;
}

function DiffText({ text }: { text: string }) {
  const lines = text.replace(/\n$/, "").split("\n");
  return (
    <pre className="patch" tabIndex={0} role="region" aria-label="Patch diff">
      <code>
        {lines.map((line, i) => {
          let cls = "patch__line";
          if (line.startsWith("+++") || line.startsWith("---")) cls += " is-file";
          else if (line.startsWith("@@")) cls += " is-hunk";
          else if (line.startsWith("+")) cls += " is-add";
          else if (line.startsWith("-")) cls += " is-del";
          return (
            <span key={i} className={cls}>
              {line || " "}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

export function PatchPanel({ patch, busy, onExorcise }: Props) {
  return (
    <div className="block" role="group" aria-labelledby="patch-title">
      <div className="block__head">
        <h3 id="patch-title">Recorded patch</h3>
        <p className="hint mono">fix_mutation</p>
      </div>
      <p className="body-copy">
        Applies the recorded fix to the twin, then reruns the same cases. Exorcise removes the injected
        mutation; it does not write new code.
      </p>
      <div className="button-row">
        <button
          type="button"
          className="button button--ghost"
          onClick={onExorcise}
          disabled={busy || patch.phase === "applying"}
        >
          <span>{patch.phase === "applying" ? "Exorcising" : "Exorcise"}</span>
          <span className="tag">Recorded patch</span>
        </button>
      </div>
      <div aria-live="polite">
        {patch.phase === "error" ? (
          <p className="notice notice--error" role="alert">
            Patch not applied. {patch.error}
          </p>
        ) : null}
        {patch.phase === "applied" && patch.recorded ? (
          <p className="hint">
            {patch.runId ? (
              <>
                Recorded patch shown. Recorded rerun <span className="mono">{patch.runId}</span> started.
              </>
            ) : (
              "Recorded patch shown. Recorded rerun started."
            )}
          </p>
        ) : patch.phase === "applied" ? (
          <p className="hint">
            {patch.runId ? (
              <>
                Applied. Rerun <span className="mono">{patch.runId}</span> started.
              </>
            ) : (
              "Applied. Rerun started."
            )}
          </p>
        ) : null}
      </div>
      {patch.diff ? (
        <DiffText text={patch.diff} />
      ) : patch.phase === "applied" ? (
        <p className="empty">The server did not return diff text for this patch.</p>
      ) : (
        <p className="empty">No patch applied yet. The twin is as written, warts and all.</p>
      )}
    </div>
  );
}
