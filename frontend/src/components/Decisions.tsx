import { UNCONFIRMED_REVIEWER } from "../content";
import type { RunState } from "../runner";
import { count } from "../status";
import type { Decision } from "../types";
import { DecisionCard } from "./DecisionCard";

interface Props {
  run: RunState;
  decisions: Decision[];
  onDecide: (decision: Decision) => Promise<void>;
}

export function Decisions({ run, decisions, onDecide }: Props) {
  const classes = Array.from(new Set(run.counterexamples.map((cx) => cx.class)));
  const undecidedFromReport = run.report?.decision_coverage?.undecided ?? [];
  for (const klass of undecidedFromReport) if (!classes.includes(klass)) classes.push(klass);
  const mutationRun = run.report?.mutation ?? run.counterexamples.find((cx) => cx.mutation)?.mutation ?? null;

  return (
    <div className="lower__col">
      <div className="block" role="group" aria-labelledby="decisions-title">
        <div className="block__head">
          <h3 id="decisions-title">Human decisions</h3>
          <p className="hint">One per mismatch class</p>
        </div>
        {mutationRun && classes.length > 0 ? (
          <p className="notice notice--warn" role="note">
            These mismatches come from injected mutation <span className="mono">{mutationRun}</span>, a planted bug and
            not legacy behavior. No decision record covers a mutation run, so it never counts as decided. Remove the
            mutation instead.
          </p>
        ) : classes.length === 0 ? (
          <p className="empty">No mismatch classes, so nobody has to make a call. Enjoy it while it lasts.</p>
        ) : (
          <div className="stack">
            {classes.map((klass) => {
              const existing = decisions.filter((d) => d.class === klass).at(-1) ?? null;
              return (
                <DecisionCard
                  key={`${klass}-${existing ? existing.choice + existing.reviewer : "new"}`}
                  klass={klass}
                  examples={run.counterexamples.filter((cx) => cx.class === klass)}
                  existing={existing}
                  onSubmit={onDecide}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="block" role="group" aria-labelledby="recorded-decisions-title">
        <div className="block__head">
          <h3 id="recorded-decisions-title">Recorded decisions</h3>
          <p className="hint num">{count(decisions.length)} on file</p>
        </div>
        {decisions.length === 0 ? (
          <p className="empty">No decision records on file, or the server did not hand them over.</p>
        ) : (
          <ul className="records">
            {decisions.map((d, i) => (
              <li key={`${d.id ?? d.class}-${i}`} className="record-entry">
                <p className="record-entry__head">
                  <span className="mono">{d.id ?? "unsaved"}</span> covers class <span className="mono chip">{d.class}</span>{" "}
                  exactly
                </p>
                <dl className="record-entry__meta">
                  <div>
                    <dt>Field</dt>
                    <dd className="mono">{d.field}</dd>
                  </div>
                  <div>
                    <dt>Choice</dt>
                    <dd>{d.choice}</dd>
                  </div>
                  <div>
                    <dt>Reviewer</dt>
                    <dd className={d.reviewer ? undefined : "record-entry__pending"}>{d.reviewer || UNCONFIRMED_REVIEWER}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd className="mono">{d.date ?? "this session"}</dd>
                  </div>
                  <div>
                    <dt>Lists</dt>
                    <dd className="mono">{d.counterexample_ids.join(", ") || "none"}</dd>
                  </div>
                </dl>
                {d.note ? <p className="record-entry__note">{d.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
