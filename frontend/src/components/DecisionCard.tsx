import { useId, useState } from "react";
import type { Counterexample, Decision } from "../types";

interface Props {
  klass: string;
  examples: Counterexample[];
  existing: Decision | null;
  onSubmit: (decision: Decision) => Promise<void>;
}

export function DecisionCard({ klass, examples, existing, onSubmit }: Props) {
  const id = useId();
  const [choice, setChoice] = useState<"preserve" | "correct" | "">("");
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Decision | null>(null);

  const fields = Array.from(
    new Set(examples.flatMap((cx) => cx.diff.map((d) => d.field)).filter((f) => f !== "trace")),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!choice) {
      setError("Choose whether to preserve or correct the legacy behavior.");
      return;
    }
    if (!reviewer.trim()) {
      setError("Add a reviewer name.");
      return;
    }
    setSaving(true);
    setError(null);
    const decision: Decision = {
      class: klass,
      field: fields.join(",") || "trace",
      counterexample_ids: examples.map((cx) => cx.id),
      options_considered: ["preserve", "correct"],
      choice,
      reviewer: reviewer.trim(),
      note: note.trim(),
    };
    try {
      await onSubmit(decision);
      setSaved(decision);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (existing) {
    return (
      <article className="card decision decision--recorded" aria-labelledby={`${id}-title`}>
        <header className="card__head">
          <div>
            <h4 id={`${id}-title`}>
              Class <span className="mono">{klass}</span>
            </h4>
            <p className="hint">
              {examples.length} {examples.length === 1 ? "counterexample" : "counterexamples"} in this run
              {fields.length ? `, fields ${fields.join(", ")}` : ""}
            </p>
          </div>
          <p className="decided">
            <span aria-hidden="true">{"✓"}</span> Recorded decision
          </p>
        </header>
        <dl className="kvs">
          <div className="kv">
            <dt>Choice</dt>
            <dd>{existing.choice === "preserve" ? "Preserve legacy behavior" : "Correct it"}</dd>
          </div>
          <div className="kv">
            <dt>Reviewer</dt>
            <dd>{existing.reviewer || "Not recorded"}</dd>
          </div>
          <div className="kv">
            <dt>Date</dt>
            <dd className="mono">{existing.date ?? "this session"}</dd>
          </div>
          {existing.id ? (
            <div className="kv">
              <dt>Record</dt>
              <dd className="mono">{existing.id}</dd>
            </div>
          ) : null}
        </dl>
        <p className="body-copy">
          {existing.id ?? "This decision"} covers class <span className="mono chip">{existing.class}</span> by exact
          match and lists{" "}
          <span className="mono">{existing.counterexample_ids.join(", ") || "no counterexample ids"}</span>. This run
          shows <span className="mono">{examples.map((cx) => cx.id).join(", ") || "none"}</span> in the same class.
        </p>
        {examples.some((cx) => cx.mutation) ? (
          <p className="notice notice--warn">
            The counterexamples in this run come from injected mutation{" "}
            {Array.from(new Set(examples.map((cx) => cx.mutation).filter(Boolean))).join(", ")}. They demonstrate that the
            harness has teeth. They are not legacy findings.
          </p>
        ) : null}
        {existing.note ? <p className="body-copy">{existing.note}</p> : null}
        <p className="hint">Read only. Decisions live in decisions/ and are changed by a person, not from this screen.</p>
      </article>
    );
  }

  return (
    <article className="card decision" aria-labelledby={`${id}-title`}>
      <header className="card__head">
        <div>
          <h4 id={`${id}-title`}>
            Class <span className="mono">{klass}</span>
          </h4>
          <p className="hint">
            {examples.length} {examples.length === 1 ? "counterexample" : "counterexamples"}
            {fields.length ? `, fields ${fields.join(", ")}` : ""}
          </p>
        </div>
        {saved ? (
          <p className="decided">
            <span aria-hidden="true">{"✓"}</span> {saved.choice === "preserve" ? "Preserve" : "Correct"}, by{" "}
            {saved.reviewer}
          </p>
        ) : (
          <p className="undecided">
            <span aria-hidden="true">{"◇"}</span> Undecided
          </p>
        )}
      </header>
      <form onSubmit={submit} noValidate>
        <fieldset className="choices">
          <legend>What should the twin do?</legend>
          <label className="choice">
            <input
              type="radio"
              name={`${id}-choice`}
              value="preserve"
              checked={choice === "preserve"}
              onChange={() => setChoice("preserve")}
            />
            <span>
              <strong>Preserve legacy behavior</strong>
              <span className="hint">Match the oracle exactly, quirks included.</span>
            </span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name={`${id}-choice`}
              value="correct"
              checked={choice === "correct"}
              onChange={() => setChoice("correct")}
            />
            <span>
              <strong>Correct it</strong>
              <span className="hint">Accept the difference and record why.</span>
            </span>
          </label>
        </fieldset>
        <div className="row">
          <div className="field">
            <label htmlFor={`${id}-reviewer`}>Reviewer</label>
            <input
              id={`${id}-reviewer`}
              className="input"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              autoComplete="name"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${id}-note`}>Note</label>
          <textarea id={`${id}-note`} className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error ? (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="button" disabled={saving}>
          {saving ? "Recording" : saved ? "Update decision" : "Record decision"}
        </button>
      </form>
    </article>
  );
}
