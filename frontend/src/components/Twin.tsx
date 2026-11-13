import { useMemo } from "react";
import { TRACE_POSITIONS, firedBits } from "../records";
import type { FocusTrace } from "../types";
import { useText } from "../useText";
import { SourceViewer } from "./SourceViewer";
import { TraceTable } from "./TraceTable";

export interface PatchState {
  phase: "idle" | "applying" | "applied" | "error";
  diff: string | null;
  runId: string | null;
  error: string | null;
  recorded?: boolean;
}

interface Props {
  focus: FocusTrace | null;
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

export function Twin({ focus, patch, busy, onExorcise }: Props) {
  const { text, error } = useText("/modern/calculator.py");
  const fired = useMemo(() => firedBits(focus?.twin), [focus]);

  const lit = useMemo(() => {
    const map = new Map<number, string>();
    if (!text) return map;
    const names = new Map<string, string[]>();
    for (const p of TRACE_POSITIONS) {
      if (!fired.has(p.pos)) continue;
      const list = names.get(p.python) ?? [];
      list.push(p.label);
      names.set(p.python, list);
    }
    text.split("\n").forEach((line, index) => {
      const def = /^def (\w+)\(/.exec(line);
      if (def && names.has(def[1])) map.set(index, names.get(def[1])!.join(", "));
    });
    return map;
  }, [text, fired]);

  return (
    <section className="pane pane--twin" aria-labelledby="twin-title">
      <header className="pane__head">
        <h2 id="twin-title">The Resurrected Twin</h2>
        <p className="pane__sub">Python twin, calculator.py</p>
      </header>

      <div className="block">
        <div className="block__head">
          <h3>Trace comparison</h3>
          <p className="hint">{focus ? focus.source : "No trace selected"}</p>
        </div>
        {focus ? (
          <TraceTable oracle={focus.oracle} twin={focus.twin} caption="Oracle and twin rule trace" />
        ) : (
          <p className="empty">No trace picked. Run a comparison or choose a sample claim and both traces line up here.</p>
        )}
      </div>

      <div className="block">
        <div className="block__head">
          <h3>Source</h3>
          <p className="hint">{lit.size ? `${lit.size} functions lit` : "Nothing lit"}</p>
        </div>
        <SourceViewer label="calculator.py source" text={text} error={error} lit={lit} />
      </div>

      <div className="block">
        <div className="block__head">
          <h3 id="patch-title">Recorded patch</h3>
          <p className="hint mono">fix_mutation</p>
        </div>
        <p className="body-copy">
          Applies the recorded fix to the twin, then reruns the same cases. Exorcise removes the injected
          mutation; it does not write new code.
        </p>
        <button
          type="button"
          className="button button--ghost"
          onClick={onExorcise}
          disabled={busy || patch.phase === "applying"}
        >
          <span>{patch.phase === "applying" ? "Exorcising" : "Exorcise"}</span>
          <span className="tag">Recorded patch</span>
        </button>
        <div aria-live="polite">
          {patch.phase === "error" ? (
            <p className="notice notice--error" role="alert">
              Patch not applied. {patch.error}
            </p>
          ) : null}
          {patch.phase === "applied" && patch.recorded ? (
            <p className="hint">
              <span className="tag tag--warn">Recorded</span> Patch text shown as recorded. Replaying rerun{" "}
              <span className="mono">{patch.runId}</span>.
            </p>
          ) : patch.phase === "applied" ? (
            <p className="hint">
              Applied. Rerun <span className="mono">{patch.runId}</span> started.
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
    </section>
  );
}
