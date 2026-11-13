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
}

export function CounterexampleCard({ cx, focused, busy, onFocus, onRerun }: Props) {
  const fields = cx.diff.filter((d) => d.field !== "trace").map((d) => d.field);
  return (
    <article className={focused ? "card cx is-focused" : "card cx"} aria-labelledby={`cx-${cx.id}`}>
      <header className="card__head">
        <div>
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
            {focused ? "Trace shown" : "Show trace"}
          </button>
          <button type="button" className="button button--small" onClick={onRerun} disabled={busy}>
            Rerun seed {cx.seed}
          </button>
        </div>
      </header>

      {cx.mutation ? (
        <p className="tag tag--danger cx__origin">injected mutation {cx.mutation}, not a legacy finding</p>
      ) : null}

      <p className="cx__summary">
        Disagrees on {fields.length ? fields.join(", ") : "trace only"}.
      </p>

      <OutputDiff oracle={cx.oracle_output} twin={cx.twin_output} fields={OUTPUT_FIELDS} />

      <TraceTable oracle={cx.trace_diff.oracle} twin={cx.trace_diff.twin} caption="Trace bits" mismatch />

      <details className="disclosure">
        <summary>Input record, split into fields</summary>
        <p className="record mono">{cx.input_record.replace(/ /g, "·")}</p>
        <RecordFields record={cx.input_record} fields={INPUT_FIELDS} caption="Shrunk input" hideFiller />
      </details>
    </article>
  );
}
