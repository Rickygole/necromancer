import { useEffect, useState } from "react";
import { SAMPLE_CLAIMS } from "../data";
import { TRACE_POSITIONS } from "../records";
import type { RunState } from "../runner";
import { casesOf, count, toneOf } from "../status";
import type { Counterexample, Profile, Snapshot, Status } from "../types";
import { CounterexampleCard } from "./CounterexampleCard";
import { StatusIcon } from "./StatusBadge";

export interface DemoStep {
  label: string;
  short?: string;
  state: "pending" | "active" | "waiting" | "done" | "failed" | "skipped";
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
  recorded?: Snapshot | null;
  demo: DemoStep[] | null;
  seed: number | null;
  profile: string | null;
  focusedId: string | null;
  runLabel: string;
  note: string | null;
  onDemo: () => void;
  retry: { label: string; run: () => void } | null;
  onStop: () => void;
  onFocusCx: (cx: Counterexample) => void;
  onRerun: (cx: Counterexample) => void;
  onShowMore: () => void;
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

const SAMPLE = SAMPLE_CLAIMS[0];
const SAMPLE_TRACE = SAMPLE.output.slice(30, 40);
const SAMPLE_FIRED = TRACE_POSITIONS.filter((p) => SAMPLE_TRACE[p.pos - 1] === "1").map((p) => p.label);

const WATCH = [
  { who: "oracle", text: "runs the real UICALC.cbl, compiled COBOL. Whatever it prints is the truth." },
  { who: "twin", text: "runs the Python rewrite on the same 80 byte records, field for field." },
  { who: "shrink", text: "every disagreement is cut down to the smallest claimant that still breaks, and lands here." },
];

function IdleSide() {
  return (
    <>
      <div className="block__head">
        <h3 id="cx-title">What you are about to watch</h3>
        <p className="hint">Nothing compared yet</p>
      </div>
      <ol className="watch">
        {WATCH.map((line, i) => (
          <li key={line.who} className="watch__line">
            <span className="watch__n mono" aria-hidden="true">
              {i + 1}
            </span>
            <p>
              <strong className="watch__who mono">{line.who}</strong> {line.text}
            </p>
          </li>
        ))}
      </ol>
      <figure className="sample-trace">
        <figcaption>
          <span className="sample-trace__kicker mono">rule trace, sample claim {SAMPLE.id}</span>
          <span className="sample-trace__title">{SAMPLE.title}</span>
        </figcaption>
        <ol className="sample-trace__bits" aria-hidden="true">
          {TRACE_POSITIONS.map((p) => {
            const on = SAMPLE_TRACE[p.pos - 1] === "1";
            return (
              <li key={p.pos} className={on ? "bit is-on" : "bit"} title={`${p.label}, ${on ? "fired" : "not fired"}`}>
                <span className="bit__n">{p.pos}</span>
                <span className="bit__v">{on ? "1" : "0"}</span>
              </li>
            );
          })}
        </ol>
        <p className="sample-trace__fired">
          <span className="mono">fired</span> {SAMPLE_FIRED.join(", ")}. Ten bits, one per rule, printed by both programs
          and compared bit for bit.
        </p>
      </figure>
    </>
  );
}

export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

export function seconds(since: number | null | undefined, now: number): string | null {
  if (!since) return null;
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return `${s} s elapsed`;
}

export function Circle(props: Props) {
  const { run, busy, demo } = props;
  const running = run.phase !== "idle" && run.phase !== "finished";
  const glow = run.planned > 0 ? Math.min(1, run.matched / run.planned) : run.status === "MATCH" ? 1 : 0;
  const tone = toneOf(run.status);
  const percent = run.planned > 0 ? Math.round((run.cases / run.planned) * 100) : 0;
  const compared = run.matched + run.mismatched;
  const total = Math.max(run.planned, run.cases, compared);

  const activeStep = demo?.find((step) => step.state === "active") ?? null;
  const now = useNow(running);
  const elapsed = running ? seconds(run.startedAt, now) : null;
  const waitingLive = run.live && run.phase === "starting";
  const failed = run.phase === "finished" && run.error !== null && run.status !== "BUILD FAILED";
  const activeIndex = demo && activeStep ? demo.indexOf(activeStep) : -1;
  const announce =
    demo && activeStep
      ? `Guided demo step ${activeIndex + 1} of ${demo.length}, ${activeStep.label}`
      : running
        ? `${PHASE_TEXT[run.phase]}${run.replay ? ", replaying recorded evidence" : ""}`
        : run.phase === "finished" && !failed
          ? `Run finished. Verdict ${run.status}. ${run.error ? run.error.message : VERDICT_TEXT[run.status]}`
          : "";

  const showCount = !failed && run.cases > 0;
  const idle = run.phase === "idle" && run.status === "NOT RUN";
  const first = run.counterexamples[0] ?? null;
  const more = run.counterexamples.length - 1;
  const context = [props.seed !== null ? `seed ${props.seed}` : null, props.profile ? `${props.profile} profile` : null]
    .filter(Boolean)
    .join(", ");

  return (
    <section
      className={`verdict verdict--${tone}${running ? " is-running" : ""}`}
      aria-labelledby="circle-title"
      id="circle"
      style={{ "--glow": glow.toFixed(3) } as React.CSSProperties}
    >
      <div className="verdict__glow" aria-hidden="true" />
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
      <p className="visually-hidden" role="status">
        {announce}
      </p>

      <div className="verdict__main">
        <div className="verdict__candle" aria-hidden="true" data-candle>
          <span className="verdict__flame" />
          <span className="verdict__wick" />
        </div>
        <div className="verdict__body">
          <div className="verdict__title">
            <h2 id="circle-title" className="verdict__label">
              Verdict
            </h2>
            <p className="verdict__where">the summoning circle, oracle against twin</p>
          </div>
          <p className="verdict__stamp-row">
            <span key={run.status} className={`verdict-stamp verdict-stamp--${tone}`}>
              <StatusIcon status={run.status} />
              <span>{run.status}</span>
            </span>
            {run.replay ? <span className="tag tag--warn">Recorded</span> : null}
            {props.note ? <span className="tag">{props.note}</span> : null}
          </p>

          {failed && run.error ? (
            <div className="run-failed" role="alert">
              <p className="run-failed__title">{run.error.busy ? "The oracle is busy" : "The run did not finish"}</p>
              <p className="verdict__text">{run.error.message}</p>
              <p className="hint mono">
                {run.error.code}
                {compared === 0
                  ? ", no cases were compared"
                  : `, ${count(compared)} compared so far of ${count(total)} planned`}
              </p>
              {props.retry && run.error.retry ? (
                <button type="button" className="button button--primary" disabled={busy} onClick={props.retry.run}>
                  {props.retry.label}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="verdict__figure">
              {showCount ? (
                <>
                  <p className="verdict__count num">
                    <span className="verdict__big">{count(run.mismatched)}</span>{" "}
                    <span className="verdict__unit">{run.mismatched === 1 ? "disagrees" : "disagree"}</span>
                  </p>
                  <p className="verdict__of num">
                    {running
                      ? `out of ${count(compared)} compared so far, ${count(total)} planned`
                      : `out of ${count(compared)} cases compared`}
                    {context ? `, ${context}` : ""}
                  </p>
                </>
              ) : (
                <p className="verdict__headline">
                  {waitingLive
                    ? "Comparing on the hosted oracle"
                    : running
                      ? "Comparing, the first cases are on their way."
                      : VERDICT_TEXT[run.status]}
                </p>
              )}
              {idle && !run.error ? (
                <p className="verdict__text">
                  Guided demo runs five steps: a clean baseline, an injected bug, the run that catches it, the
                  recorded patch, and the approval card.
                </p>
              ) : null}
              {showCount || run.error ? (
                <p className="verdict__text">
                  {run.error
                    ? `${run.error.message} (${run.error.code})`
                    : running
                      ? "Disagreements count up here as they are found."
                      : VERDICT_TEXT[run.status]}
                </p>
              ) : null}
            </div>
          )}

          <div className="progress">
            <div
              className="progress__bar"
              role="progressbar"
              aria-label="Cases compared"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={waitingLive ? undefined : run.cases}
              aria-valuetext={waitingLive ? "Waiting for the hosted oracle" : casesOf(run.cases, run.planned)}
            >
              <span
                className={`progress__fill${waitingLive ? " progress__fill--wait" : ""}`}
                style={{ width: waitingLive ? undefined : `${percent}%` }}
              />
            </div>
            <p className="verdict__phase">
              {waitingLive
                ? "Results arrive together when the hosted oracle finishes"
                : running
                  ? PHASE_TEXT[run.phase]
                  : run.phase === "finished"
                    ? PHASE_TEXT.finished
                    : PHASE_TEXT.idle}
              {run.replay ? ", replaying recorded evidence" : ""}
              {elapsed ? <span className="num">, {elapsed}</span> : null}
              {run.replay && typeof props.recorded?.seconds === "number" ? (
                <span className="num">, recorded run took {props.recorded.seconds.toFixed(1)} s</span>
              ) : null}
            </p>
            {run.cases > 0 ? (
              <p className="progress__sum num">
                {count(run.matched)} matched + {count(run.mismatched)} mismatched = {count(compared)}{" "}
                compared
              </p>
            ) : null}
            <dl className="progress__stats">
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

          <div className="button-row verdict__actions">
            <button id="guided-demo-button" type="button" className="button button--primary" onClick={props.onDemo} disabled={busy}>
              Guided demo
            </button>
            <button type="submit" form="run-controls" className="button" disabled={busy}>
              {props.runLabel}
            </button>
            {busy ? (
              <button type="button" className="button button--danger" onClick={props.onStop}>
                Stop
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className={`verdict__side${idle && !first ? " verdict__side--idle" : ""}`} role="group" aria-labelledby="cx-title">
        {idle && !first ? (
          <IdleSide />
        ) : (
          <>
            <div className="block__head">
              <h3 id="cx-title">Smallest failing claimant</h3>
              <p className="hint num">
                {run.replay && run.counterexamples.length ? "Recorded, " : ""}
                {count(run.counterexamples.length)} shrunk
              </p>
            </div>
            {first ? (
              <>
                <CounterexampleCard
                  key={first.id}
                  cx={first}
                  busy={busy}
                  compact
                  focused={props.focusedId === first.id}
                  onFocus={() => props.onFocusCx(first)}
                  onRerun={() => props.onRerun(first)}
                />
                {more > 0 ? (
                  <button type="button" className="button button--ghost button--small" onClick={props.onShowMore}>
                    See {count(more)} more {more === 1 ? "counterexample" : "counterexamples"}
                  </button>
                ) : null}
              </>
            ) : (
              <p className="empty">
                {run.status === "MATCH" || (run.status === "APPROVAL REQUIRED" && run.phase === "finished")
                  ? `No disagreements in ${casesOf(compared, compared)}. That is evidence over this run, not proof.`
                  : run.phase === "shrinking"
                    ? "Shrinking the failing input to its smallest form."
                    : running
                      ? "None yet. Disagreements appear here as they are found."
                      : "Nothing dug up yet. Run a comparison and any disagreement lands here, shrunk to the smallest claimant that still breaks."}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
