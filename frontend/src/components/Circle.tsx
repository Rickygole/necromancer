import { useEffect, useState } from "react";
import type { RunState } from "../runner";
import { casesOf, count, toneOf } from "../status";
import type { Counterexample, Decision, Mutation, Profile, Snapshot, Status } from "../types";
import { ApprovalCard } from "./ApprovalCard";
import { CounterexampleCard } from "./CounterexampleCard";
import { DecisionCard } from "./DecisionCard";
import { StatusBadge } from "./StatusBadge";

export interface DemoStep {
  label: string;
  state: "pending" | "active" | "done" | "failed" | "skipped";
  result?: Status;
  note?: string;
  startedAt?: number;
}

export interface Controls {
  profile: Profile;
  seed: string;
  mutation: string;
  useDemoConfig: boolean;
}

interface Props {
  run: RunState;
  busy: boolean;
  controls: Controls;
  onControls: (next: Controls) => void;
  mutations: Mutation[];
  injected: string | null;
  replayOnly: boolean;
  simulated: boolean;
  recorded?: Snapshot | null;
  demo: DemoStep[] | null;
  focusedId: string | null;
  decisions: Decision[];
  onRun: () => void;
  onDemo: () => void;
  retry: { label: string; run: () => void } | null;
  onStop: () => void;
  liveHosted: boolean;
  onFocusCx: (cx: Counterexample) => void;
  onRerun: (cx: Counterexample) => void;
  onDecide: (decision: Decision) => Promise<void>;
  onApprove: (approved: boolean, reviewer: string, note: string) => Promise<void>;
}

const PHASE_TEXT: Record<RunState["phase"], string> = {
  idle: "Waiting for a run",
  starting: "Starting run",
  building: "Compiling the oracle",
  comparing: "Comparing oracle and twin",
  shrinking: "Shrinking the counterexample",
  finished: "Run finished",
};

const VERDICT_TEXT: Record<Status, string> = {
  "NOT RUN": "Nothing has been compared yet. The candle is waiting.",
  "BUILD FAILED": "The legacy program did not compile. No cases were compared.",
  MATCH: "Oracle and twin agreed on every case in this run.",
  MISMATCH: "Oracle and twin disagree. Each counterexample below needs a human decision.",
  "RUNTIME ERROR": "The run stopped before a verdict.",
  "APPROVAL REQUIRED": "Evidence is complete and waits for a reviewer.",
};

const STEP_MARK: Record<DemoStep["state"], string | null> = {
  pending: null,
  active: "◆",
  done: "✓",
  failed: "✕",
  skipped: "○",
};

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function seconds(since: number | null | undefined, now: number): string | null {
  if (!since) return null;
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return `${s} s elapsed`;
}

const CX_LIMIT = 5;
const RECORDED_MUTATIONS = new Set(["", "M4"]);

export function Circle(props: Props) {
  const { run, busy, controls, onControls, mutations, injected, replayOnly, demo } = props;
  const [showAll, setShowAll] = useState(false);
  const running = run.phase !== "idle" && run.phase !== "finished";
  const glow = run.planned > 0 ? Math.min(1, run.matched / run.planned) : run.status === "MATCH" ? 1 : 0;
  const tone = toneOf(run.status);
  const classes = Array.from(new Set(run.counterexamples.map((cx) => cx.class)));
  const undecidedFromReport = run.report?.decision_coverage?.undecided ?? [];
  for (const klass of undecidedFromReport) if (!classes.includes(klass)) classes.push(klass);
  const shown = showAll ? run.counterexamples : run.counterexamples.slice(0, CX_LIMIT);
  const percent = run.planned > 0 ? Math.round((run.cases / run.planned) * 100) : 0;

  const set = (patch: Partial<Controls>) => onControls({ ...controls, ...patch });
  const activeStep = demo?.find((step) => step.state === "active") ?? null;
  const now = useNow(running || activeStep !== null);
  const elapsed = running ? seconds(run.startedAt, now) : null;
  const waitingLive = run.live && run.phase === "starting";
  const failed = run.phase === "finished" && run.error !== null && run.status !== "BUILD FAILED";
  const mutationRun = run.report?.mutation ?? run.counterexamples.find((cx) => cx.mutation)?.mutation ?? null;

  return (
    <section className="pane pane--circle" aria-labelledby="circle-title" id="circle">
      <header className="pane__head">
        <h2 id="circle-title">The Summoning Circle</h2>
        <p className="pane__sub">Oracle against twin, case by case</p>
      </header>

      <div
        className={`verdict verdict--${tone}${running ? " is-running" : ""}`}
        style={{ "--glow": glow.toFixed(3) } as React.CSSProperties}
      >
        <div className="verdict__glow" aria-hidden="true" />
        <div className="verdict__candle" aria-hidden="true" data-candle>
          <span className="verdict__flame" />
          <span className="verdict__wick" />
        </div>
        {run.replay && props.recorded ? (
          <div className="run-head">
            <p className="run-head__title">
              <span className="tag tag--warn">Recorded</span>{" "}
              {run.label ? (
                run.label
              ) : props.recorded.mutation ? (
                <>
                  Recorded run, <strong className="mono">{props.recorded.mutation} INJECTED</strong>
                </>
              ) : props.recorded.verdict === "APPROVAL REQUIRED" ? (
                "Recorded run, after the patch"
              ) : (
                "Recorded run, twin with the three preserved legacy behaviors"
              )}
            </p>
            <dl className="run-head__meta">
              <div>
                <dt>Profile</dt>
                <dd className="mono">{props.recorded.profile}</dd>
              </div>
              <div>
                <dt>Mutation</dt>
                <dd className="mono">{props.recorded.mutation ?? "none"}</dd>
              </div>
              <div>
                <dt>Seed</dt>
                <dd className="mono">{props.recorded.seed}</dd>
              </div>
            </dl>
          </div>
        ) : null}
        <div className="verdict__body" aria-live="polite" aria-atomic="true">
          <p className="verdict__label">Verdict</p>
          <p className="verdict__badges">
            <StatusBadge status={run.status} size="lg" />
            {run.replay ? <span className="tag tag--warn">Recorded</span> : null}
          </p>
          {failed && run.error ? (
            <div className="run-failed" role="alert">
              <p className="run-failed__title">
                {run.error.busy ? "The oracle is busy" : "The run did not finish"}
              </p>
              <p className="verdict__text">{run.error.message}</p>
              <p className="hint mono">
                {run.error.code}
                {run.cases === 0 ? ", no cases were compared" : `, stopped after ${casesOf(run.cases, run.planned)}`}
              </p>
              {props.retry && run.error.retry ? (
                <button type="button" className="button button--primary" disabled={busy} onClick={props.retry.run}>
                  {props.retry.label}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="verdict__text">
              {run.error
                ? `${run.error.message} (${run.error.code})`
                : running
                  ? run.planned > 0 || run.cases > 0
                    ? `Comparing, ${count(run.cases)} of ${count(Math.max(run.planned, run.cases))} cases so far.`
                    : "Comparing, the first cases are on their way."
                  : VERDICT_TEXT[run.status]}
            </p>
          )}
          <p className="verdict__phase">
            {waitingLive
              ? "Comparing on the hosted oracle. Results arrive together when it finishes"
              : running
                ? PHASE_TEXT[run.phase]
                : run.phase === "finished"
                  ? PHASE_TEXT.finished
                  : PHASE_TEXT.idle}
            {run.replay ? ", replaying recorded evidence" : ""}
            {elapsed ? <span className="num">, {elapsed}</span> : null}
          </p>
        </div>
        <div className="progress">
          <p className="progress__count num">
            {failed && run.cases === 0 ? "No cases compared" : waitingLive ? "Waiting for the hosted oracle" : casesOf(run.cases, run.planned)}
          </p>
          {run.cases > 0 ? (
            <p className="progress__sum num">
              {count(run.matched)} matched + {count(run.mismatched)} mismatched = {count(run.matched + run.mismatched)}{" "}
              compared
            </p>
          ) : null}
          <div
            className="progress__bar"
            role="progressbar"
            aria-label="Cases compared"
            aria-valuemin={0}
            aria-valuemax={Math.max(run.planned, run.cases)}
            aria-valuenow={waitingLive ? undefined : run.cases}
            aria-valuetext={waitingLive ? "Waiting for the hosted oracle" : casesOf(run.cases, run.planned)}
          >
            <span
              className={`progress__fill${waitingLive ? " progress__fill--wait" : ""}`}
              style={{ width: waitingLive ? undefined : `${percent}%` }}
            />
          </div>
          <dl className="progress__stats">
            <div>
              <dt>Matched</dt>
              <dd className="num">{count(run.matched)}</dd>
            </div>
            <div>
              <dt>Mismatched</dt>
              <dd className="num">{count(run.mismatched)}</dd>
            </div>
            <div>
              <dt>Family</dt>
              <dd className="mono">{run.family ?? "none yet"}</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd className="mono run-id">{run.runId ?? "none yet"}</dd>
            </div>
          </dl>
        </div>
      </div>

      <form
        className="block controls"
        aria-labelledby="controls-title"
        onSubmit={(e) => {
          e.preventDefault();
          props.onRun();
        }}
      >
        <div className="block__head">
          <h3 id="controls-title">Run controls</h3>
          {replayOnly ? <p className="tag tag--warn">Recorded only</p> : null}
        </div>
        {replayOnly ? (
          <p className="notice notice--warn" id="replay-note">
            Mutations run on the live oracle. This build replays the recorded M4 story. None replays the recorded
            baseline and M4 replays the recorded injected run. Profile, seed and the demo config apply to live runs only.
          </p>
        ) : null}
        <div className="row">
          <div className="field">
            <label htmlFor="profile">Profile</label>
            <select
              id="profile"
              className="input"
              disabled={replayOnly}
              aria-describedby={replayOnly ? "replay-note" : undefined}
              value={controls.profile}
              onChange={(e) => set({ profile: e.target.value as Profile })}
            >
              <option value="dev">dev, quick</option>
              <option value="demo">demo, stage sized</option>
              <option value="full">{props.liveHosted ? "full (recorded replay on the hosted build)" : "full, thorough"}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="seed">Seed</label>
            <input
              id="seed"
              className="input mono"
              disabled={replayOnly}
              aria-describedby={replayOnly ? "replay-note" : undefined}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="731942, the recorded seed"
              value={controls.seed}
              onChange={(e) => set({ seed: e.target.value.replace(/[^0-9]/g, "") })}
            />
          </div>
        </div>
        <fieldset className="mutations" aria-describedby={replayOnly ? "replay-note" : undefined}>
          <legend>Mutation</legend>
          <div className="mutations__grid">
            <label className="mutation">
              <input
                type="radio"
                name="mutation"
                value=""
                checked={controls.mutation === ""}
                onChange={() => set({ mutation: "" })}
              />
              <span className="mutation__id">None</span>
              <span className="mutation__label">Twin with the three preserved legacy behaviors</span>
            </label>
            {mutations.map((m) => {
              const active = controls.mutation === m.id || injected === m.id;
              const unavailable = replayOnly && !RECORDED_MUTATIONS.has(m.id);
              return (
                <label
                  key={m.id}
                  className={`mutation${active ? " is-active" : ""}${unavailable ? " is-unavailable" : ""}`}
                  title={unavailable ? `${m.description} Needs the live oracle.` : m.description}
                >
                  <input
                    type="radio"
                    name="mutation"
                    disabled={unavailable}
                    value={m.id}
                    checked={controls.mutation === m.id}
                    onChange={() => set({ mutation: m.id })}
                  />
                  <span className="mutation__id mono">{m.id}</span>
                  <span className="mutation__label">
                    {m.label}
                    {unavailable ? <span className="visually-hidden">, needs the live oracle</span> : null}
                  </span>
                  {active ? <span className="tag tag--danger">INJECTED</span> : null}
                </label>
              );
            })}
          </div>
          {mutations.length === 0 ? <p className="hint">Mutation list unavailable.</p> : null}
        </fieldset>
        <label className="check">
          <input
            type="checkbox"
            disabled={replayOnly}
            checked={controls.useDemoConfig}
            onChange={(e) => set({ useDemoConfig: e.target.checked })}
          />
          <span>Use demo config{injected ? `, currently injects ${injected}` : ""}</span>
        </label>
        <div className="button-row">
          <button type="submit" className="button button--primary" disabled={busy}>
            {replayOnly ? (controls.mutation === "M4" ? "Replay recorded M4 run" : "Replay recorded baseline") : "Run comparison"}
          </button>
          <button type="button" className="button" onClick={props.onDemo} disabled={busy}>
            Guided demo
          </button>
          {busy ? (
            <button type="button" className="button button--danger" onClick={props.onStop}>
              Stop
            </button>
          ) : null}
        </div>
      </form>

      {demo ? (
        <div className="block" role="group" aria-labelledby="demo-title">
          <div className="block__head">
            <h3 id="demo-title">Guided demo</h3>
            <p className="hint">{replayOnly ? "Recorded runs, in order" : "Real API calls, in order"}</p>
          </div>
          <ol className="steps">
            {demo.map((step, i) => (
              <li key={i} className={`step step--${step.state}`} aria-current={step.state === "active" ? "step" : undefined}>
                <span className="step__mark" aria-hidden="true">
                  {STEP_MARK[step.state] ?? i + 1}
                </span>
                <span className="step__label">
                  {step.label}
                  <span className="visually-hidden">, {step.state}</span>
                </span>
                {step.state === "active" && step.startedAt ? (
                  <span className="step__time num">{seconds(step.startedAt, now)}</span>
                ) : null}
                {step.result ? <StatusBadge status={step.result} /> : null}
                {step.note ? <span className="step__note">{step.note}</span> : null}
              </li>
            ))}
          </ol>
          {props.retry && !busy && !(failed && run.error?.retry) && demo.some((step) => step.state === "failed") ? (
            <div className="button-row">
              <button type="button" className="button" onClick={props.retry.run}>
                {props.retry.label}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="block" role="group" aria-labelledby="cx-title">
        <div className="block__head">
          <h3 id="cx-title">Counterexamples</h3>
          <p className="hint num">
            {run.replay && run.counterexamples.length ? "Recorded, " : ""}
            {count(run.counterexamples.length)} shrunk
          </p>
        </div>
        {run.counterexamples.length === 0 ? (
          <p className="empty">
            {run.status === "MATCH"
              ? `No disagreements in ${casesOf(run.cases, run.planned)}. That is evidence over this run, not proof.`
              : run.phase === "shrinking"
                ? "Shrinking the failing input to its smallest form."
                : running
                  ? "None yet. Disagreements appear here as they are found."
                  : "Nothing dug up yet. Run a comparison and any disagreement lands here, shrunk to the smallest claimant that still breaks."}
          </p>
        ) : (
          <div className="stack">
            {shown.map((cx) => (
              <CounterexampleCard
                key={cx.id}
                cx={cx}
                busy={busy}
                focused={props.focusedId === cx.id}
                onFocus={() => props.onFocusCx(cx)}
                onRerun={() => props.onRerun(cx)}
              />
            ))}
            {run.counterexamples.length > CX_LIMIT ? (
              <button type="button" className="button button--ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? `Show first ${CX_LIMIT}` : `Show all ${count(run.counterexamples.length)}`}
              </button>
            ) : null}
          </div>
        )}
      </div>

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
              const existing = props.decisions.filter((d) => d.class === klass).at(-1) ?? null;
              return (
                <DecisionCard
                  key={`${klass}-${existing ? existing.choice + existing.reviewer : "new"}`}
                  klass={klass}
                  examples={run.counterexamples.filter((cx) => cx.class === klass)}
                  existing={existing}
                  onSubmit={props.onDecide}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="block" role="group" aria-labelledby="recorded-decisions-title">
        <div className="block__head">
          <h3 id="recorded-decisions-title">Recorded decisions</h3>
          <p className="hint num">{count(props.decisions.length)} on file</p>
        </div>
        {props.decisions.length === 0 ? (
          <p className="empty">No decision records on file, or the server did not hand them over.</p>
        ) : (
          <ul className="records">
            {props.decisions.map((d, i) => (
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
                    <dd>{d.reviewer}</dd>
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

      {run.report && run.phase === "finished" ? (
        <ApprovalCard
          key={run.report.run_id}
          report={run.report}
          verdict={run.status}
          simulated={props.simulated}
          replay={run.replay}
          onSubmit={props.onApprove}
        />
      ) : null}
    </section>
  );
}
