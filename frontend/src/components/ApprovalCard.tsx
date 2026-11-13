import { useEffect, useId, useRef, useState } from "react";
import { api } from "../api";
import { casesOf, count } from "../status";
import type { MutationScore, Report, Status } from "../types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  report: Report;
  verdict: Status;
  simulated: boolean;
  replay: boolean;
  onSubmit: (approved: boolean, reviewer: string, note: string) => Promise<void>;
}

function recordedSweep(value: MutationScore | null): string | null {
  if (!value || typeof value.cases !== "number") return null;
  if (typeof value.named_caught !== "number" || typeof value.hidden_caught !== "number") return null;
  return `${value.named_caught} of ${value.named_total} named mutants and ${value.hidden_caught} of ${value.hidden_total} hidden mutants caught, over ${count(value.cases)} cases (recorded sweep, not part of this run)`;
}

function Hash({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv">
      <dt>{label}</dt>
      <dd className="mono hash" title={value}>
        {value ? `${value.slice(0, 16)}…` : "Not recorded"}
      </dd>
    </div>
  );
}

export function ApprovalCard({ report, verdict, simulated, replay, onSubmit }: Props) {
  const id = useId();
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<"reviewer" | "note" | null>(null);
  const reviewerRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [outcome, setOutcome] = useState<{ approved: boolean; reviewer: string } | null>(null);
  const [sweep, setSweep] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .mutationScore()
      .then((value) => live && setSweep(recordedSweep(value)))
      .catch(() => live && setSweep(null));
    return () => {
      live = false;
    };
  }, []);

  const undecided = report.decision_coverage?.undecided ?? [];
  const mutation = report.mutation || null;
  const blockReason = mutation
    ? `This run has mutation ${mutation} injected. A mutated twin is a planted bug, never a candidate, so its mismatches never count as decided and it cannot be approved. Reject it, or remove the mutation and rerun.`
    : verdict === "MISMATCH"
      ? undecided.length > 0
        ? `The verdict is MISMATCH and ${undecided.length} mismatch ${undecided.length === 1 ? "class has" : "classes have"} no human decision yet: ${undecided.join(", ")}. A run that disagrees with the oracle cannot be approved.`
        : "The verdict is MISMATCH. A run that disagrees with the oracle cannot be approved, whatever the decisions say. Reject it, or fix the twin and rerun."
      : verdict !== "MATCH" && verdict !== "APPROVAL REQUIRED"
        ? `The verdict is ${verdict}, so there is nothing to approve.`
        : null;
  const canApprove = blockReason === null;
  const score =
    report.mutation_score === undefined || report.mutation_score === null
      ? sweep ?? "Not measured in this run"
      : typeof report.mutation_score === "number"
        ? `${Math.round(report.mutation_score * (report.mutation_score <= 1 ? 100 : 1))}% of mutations caught`
        : report.mutation_score;

  const send = async (approved: boolean) => {
    if (!reviewer.trim()) {
      setError("Add a reviewer name before signing.");
      setInvalid("reviewer");
      reviewerRef.current?.focus();
      return;
    }
    if (!approved && !note.trim()) {
      setError("Say why in the note when rejecting.");
      setInvalid("note");
      noteRef.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    setInvalid(null);
    try {
      await onSubmit(approved, reviewer.trim(), note.trim());
      setOutcome({ approved, reviewer: reviewer.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card approval" aria-labelledby={`${id}-title`} id="approval">
      <header className="card__head">
        <div>
          <h3 id={`${id}-title`} tabIndex={-1}>
            Final approval
          </h3>
          {simulated ? (
            <p className="tag tag--warn">Simulated: hosted demo, nothing is signed for real</p>
          ) : null}
          {replay ? <p className="tag tag--warn">Recorded evidence replay</p> : null}
        </div>
        {outcome ? (
          <p className={outcome.approved ? "decided" : "rejected"}>
            <span aria-hidden="true">{outcome.approved ? "✓" : "✕"}</span>{" "}
            {outcome.approved ? "Approved" : "Rejected"} by {outcome.reviewer}
          </p>
        ) : canApprove ? (
          <StatusBadge status="APPROVAL REQUIRED" />
        ) : (
          <p className="rejected">
            <span aria-hidden="true">{"✕"}</span> Not approvable
          </p>
        )}
      </header>

      <p className="claim">
        Evidence over {casesOf(report.cases, report.cases)}, seed {report.seed}. This is a record of what was tested,
        not a proof of equivalence.
      </p>

      <dl className="kvs">
        <div className="kv">
          <dt>Verdict</dt>
          <dd>
            <StatusBadge status={verdict} />
          </dd>
        </div>
        <div className="kv">
          <dt>Cases</dt>
          <dd className="num">{casesOf(report.matched, report.cases).replace("cases", "matched")}</dd>
        </div>
        <div className="kv">
          <dt>Seed</dt>
          <dd className="mono">{report.seed}</dd>
        </div>
        <div className="kv">
          <dt>Profile</dt>
          <dd className="mono">{report.profile}</dd>
        </div>
        <div className="kv">
          <dt>Mutation</dt>
          <dd className="mono">{report.mutation ?? "none"}</dd>
        </div>
        <div className="kv">
          <dt>Mutation score</dt>
          <dd>{score}</dd>
        </div>
        <div className="kv">
          <dt>Compiler</dt>
          <dd className="mono">{report.compiler || "Not recorded"}</dd>
        </div>
        <Hash label="Source hash" value={report.source_hash} />
        <Hash label="Twin hash" value={report.twin_hash} />
      </dl>

      <h4 className="subhead">Limitations</h4>
      {report.limitations?.length ? (
        <ul className="limits">
          {report.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty">No limitations were recorded with this report.</p>
      )}

      {blockReason ? (
        <p className="notice notice--warn" role="note" id={`${id}-why`}>
          {blockReason}
        </p>
      ) : null}

      <div className="row">
        <div className="field">
          <label htmlFor={`${id}-reviewer`}>Reviewer</label>
          <input
            id={`${id}-reviewer`}
            ref={reviewerRef}
            className="input"
            aria-invalid={invalid === "reviewer" ? true : undefined}
            aria-describedby={invalid === "reviewer" ? `${id}-error` : undefined}
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            autoComplete="name"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-note`}>Note</label>
        <textarea
          id={`${id}-note`}
          ref={noteRef}
          className="input"
          rows={2}
          value={note}
          aria-invalid={invalid === "note" ? true : undefined}
          aria-describedby={invalid === "note" ? `${id}-error` : undefined}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error ? (
        <p className="notice notice--error" role="alert" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
      <div className="button-row">
        <button
          type="button"
          className="button button--match"
          disabled={saving || !canApprove}
          aria-describedby={blockReason ? `${id}-why` : undefined}
          onClick={() => send(true)}
        >
          Approve
        </button>
        <button type="button" className="button button--danger" disabled={saving} onClick={() => send(false)}>
          Reject
        </button>
      </div>
    </section>
  );
}
