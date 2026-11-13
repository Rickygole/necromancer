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
  const [choice, setChoice] = useState<"preserve" | "correct" | "">(existing?.choice ?? "");
  const [reviewer, setReviewer] = useState(existing?.reviewer ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Decision | null>(existing);

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
