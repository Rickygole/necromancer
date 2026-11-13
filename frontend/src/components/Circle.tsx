import { useState } from "react";
import type { RunState } from "../runner";
import { casesOf, count, toneOf } from "../status";
import type { Counterexample, Decision, Mutation, Profile, Status } from "../types";
import { ApprovalCard } from "./ApprovalCard";
import { CounterexampleCard } from "./CounterexampleCard";
import { DecisionCard } from "./DecisionCard";
import { StatusBadge } from "./StatusBadge";

export interface DemoStep {
  label: string;
  state: "pending" | "active" | "done" | "failed";
  result?: Status;
  note?: string;
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
  demo: DemoStep[] | null;
  focusedId: string | null;
  decisions: Decision[];
  onRun: () => void;
  onDemo: () => void;
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
  "NOT RUN": "Nothing has been compared yet.",
  "BUILD FAILED": "The legacy program did not compile. No cases were compared.",
  MATCH: "Oracle and twin agreed on every case in this run.",
  MISMATCH: "Oracle and twin disagree. Each counterexample below needs a human decision.",
  "RUNTIME ERROR": "The run stopped before a verdict.",
  "APPROVAL REQUIRED": "Evidence is complete and waits for a reviewer.",
};

const CX_LIMIT = 5;

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
        <div className="verdict__candle" aria-hidden="true">
          <span className="verdict__flame" />
          <span className="verdict__wick" />
        </div>
        <div className="verdict__body" aria-live="polite" aria-atomic="true">
          <p className="verdict__label">Verdict</p>
          <StatusBadge status={run.status} size="lg" />
          <p className="verdict__text">
            {run.error ? `${run.error.message} (${run.error.code})` : VERDICT_TEXT[run.status]}
          </p>
          <p className="verdict__phase">
            {running ? PHASE_TEXT[run.phase] : run.phase === "finished" ? PHASE_TEXT.finished : PHASE_TEXT.idle}
            {run.replay ? ", replaying recorded evidence" : ""}
          </p>
        </div>
        <div className="progress">
          <p className="progress__count num">{casesOf(run.cases, run.planned)}</p>
          <div
            className="progress__bar"
            role="progressbar"
            aria-label="Cases compared"
            aria-valuemin={0}
            aria-valuemax={Math.max(run.planned, run.cases)}
            aria-valuenow={run.cases}
            aria-valuetext={casesOf(run.cases, run.planned)}
          >
            <span className="progress__fill" style={{ width: `${percent}%` }} />
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
          {replayOnly ? <p className="tag tag--warn">Replay only</p> : null}
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="profile">Profile</label>
            <select
              id="profile"
              className="input"
              value={controls.profile}
              onChange={(e) => set({ profile: e.target.value as Profile })}
            >
              <option value="dev">dev, quick</option>
              <option value="demo">demo, stage sized</option>
              <option value="full">full, thorough</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="seed">Seed</label>
            <input
              id="seed"
              className="input mono"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="random"
              value={controls.seed}
              onChange={(e) => set({ seed: e.target.value.replace(/[^0-9]/g, "") })}
            />
          </div>
        </div>
        <fieldset className="mutations">
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
              <span className="mutation__label">Twin as written</span>
            </label>
            {mutations.map((m) => {
              const active = controls.mutation === m.id || injected === m.id;
              return (
                <label key={m.id} className={active ? "mutation is-active" : "mutation"} title={m.description}>
                  <input
                    type="radio"
                    name="mutation"
                    value={m.id}
                    checked={controls.mutation === m.id}
                    onChange={() => set({ mutation: m.id })}
                  />
                  <span className="mutation__id mono">{m.id}</span>
                  <span className="mutation__label">{m.label}</span>
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
            checked={controls.useDemoConfig}
            onChange={(e) => set({ useDemoConfig: e.target.checked })}
          />
          <span>Use demo config{injected ? `, currently injects ${injected}` : ""}</span>
        </label>
        <div className="button-row">
          <button type="submit" className="button button--primary" disabled={busy}>
            {replayOnly ? "Replay recorded run" : "Run comparison"}
          </button>
          <button type="button" className="button" onClick={props.onDemo} disabled={busy}>
            Guided demo
          </button>
        </div>
      </form>

      {demo ? (
        <div className="block" aria-labelledby="demo-title">
          <div className="block__head">
            <h3 id="demo-title">Guided demo</h3>
            <p className="hint">Real API calls, in order</p>
          </div>
          <ol className="steps">
            {demo.map((step, i) => (
              <li key={i} className={`step step--${step.state}`} aria-current={step.state === "active" ? "step" : undefined}>
                <span className="step__mark" aria-hidden="true">
                  {step.state === "done" ? "✓" : step.state === "failed" ? "✕" : step.state === "active" ? "◆" : i + 1}
                </span>
                <span className="step__label">
                  {step.label}
                  <span className="visually-hidden">, {step.state}</span>
                </span>
                {step.result ? <StatusBadge status={step.result} /> : null}
                {step.note ? <span className="step__note">{step.note}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="block" aria-labelledby="cx-title">
        <div className="block__head">
          <h3 id="cx-title">Counterexamples</h3>
          <p className="hint num">{count(run.counterexamples.length)} shrunk</p>
        </div>
        {run.counterexamples.length === 0 ? (
          <p className="empty">
            {run.status === "MATCH"
              ? `No disagreements in ${casesOf(run.cases, run.planned)}. That is evidence over this run, not proof.`
              : run.phase === "shrinking"
                ? "Shrinking the failing input to its smallest form."
                : running
                  ? "None yet. Disagreements appear here as they are found."
                  : "None yet. Run a comparison to look for disagreements."}
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

      <div className="block" aria-labelledby="decisions-title">
        <div className="block__head">
          <h3 id="decisions-title">Human decisions</h3>
          <p className="hint">One per mismatch class</p>
        </div>
        {classes.length === 0 ? (
          <p className="empty">No mismatch classes to decide.</p>
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
