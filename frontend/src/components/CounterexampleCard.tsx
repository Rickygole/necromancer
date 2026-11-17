import { epitaph } from "../epitaph";
import { useRise } from "../rise";
import { INPUT_FIELDS, OUTPUT_FIELDS } from "../records";
import type { Counterexample } from "../types";
import { OutputDiff, RecordFields } from "./RecordFields";
import { TraceTable } from "./TraceTable";

interface Props {
  cx: Counterexample;
  focused: boolean;
  busy: boolean;
  onFocus: () => void;
  onRerun: () => void;
  compact?: boolean;
}

export function CounterexampleCard({ cx, focused, busy, onFocus, onRerun, compact = false }: Props) {
  const fields = cx.diff.filter((d) => d.field !== "trace").map((d) => d.field);
  const [riseRef, rise] = useRise<HTMLElement>();
  return (
    <article
      ref={riseRef}
      className={`card cx cx--stone${focused ? " is-focused" : ""}${rise}`}
      aria-labelledby={`cx-${cx.id}`}
    >
      <header className="card__head">
        <div className="cx__name">
          <p className="cx__lies mono">
            r.i.p.
          </p>
          <h4 id={`cx-${cx.id}`} className="mono">
            {cx.id}
          </h4>
          <p className="hint">
            Class <span className="mono chip">{cx.class}</span>
            {cx.family ? (
              <>
                {" "}
                Family <span className="mono chip">{cx.family}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="card__actions">
          <button type="button" className="button button--small button--ghost" onClick={onFocus} aria-pressed={focused}>
            {focused ? "Shown in source" : "Show in source"}
          </button>
          <button type="button" className="button button--small" onClick={onRerun} disabled={busy}>
            Rerun seed {cx.seed}
          </button>
        </div>
      </header>

      <p className="cx__epitaph">{epitaph(cx)}</p>

      {cx.mutation ? (
        <p className="tag tag--danger cx__origin">injected mutation {cx.mutation}, not a legacy finding</p>
      ) : null}

      <p className="cx__summary">
        Disagrees on {fields.length ? fields.join(", ") : "trace only"}.
      </p>

      <OutputDiff oracle={cx.oracle_output} twin={cx.twin_output} fields={OUTPUT_FIELDS} />

      {compact ? null : <TraceTable oracle={cx.trace_diff.oracle} twin={cx.trace_diff.twin} caption="Trace bits" mismatch />}

      <details className="disclosure">
        <summary>{compact ? "Trace bits and input record" : "Input record, split into fields"}</summary>
        {compact ? <TraceTable oracle={cx.trace_diff.oracle} twin={cx.trace_diff.twin} caption="Trace bits" mismatch /> : null}
        <p className="record mono">{cx.input_record.replace(/ /g, "·")}</p>
        <RecordFields record={cx.input_record} fields={INPUT_FIELDS} caption="Shrunk input" hideFiller />
      </details>
    </article>
  );
}
