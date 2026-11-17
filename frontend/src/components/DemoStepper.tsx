import { useEffect, useState } from "react";
import { useMotion } from "../motion";
import type { RunState } from "../runner";
import { toneOf } from "../status";
import { seconds, useNow, type DemoStep } from "./Circle";
import { StatusBadge } from "./StatusBadge";

interface Props {
  steps: DemoStep[];
  started: boolean;
  run: RunState;
  busy: boolean;
  replayOnly: boolean;
  liveHosted: boolean;
  retry: { label: string; run: () => void } | null;
  showRetry: boolean;
  mutation: string | null;
}

const STEP_MARK: Record<DemoStep["state"], string | null> = {
  pending: null,
  active: "◆",
  waiting: "◐",
  done: "✓",
  failed: "✕",
  skipped: "○",
};

const STATE_TEXT: Record<DemoStep["state"], string> = {
  pending: "pending",
  active: "active",
  waiting: "waiting for a reviewer, not approved",
  done: "done",
  failed: "failed",
  skipped: "skipped",
};

function incantation(steps: DemoStep[], mutation: string | null): string {
  const [, inject, haunted, patch] = steps;
  if (!inject || !haunted) return "";
  const name = mutation ?? "the mutation";
  if (inject.state === "active") return "summoning the mutation…";
  if (inject.state !== "done") return "";
  if (haunted.state === "active") return `${name} is bound into the twin. the claims are walking…`;
  if (haunted.state === "done" && patch?.state === "pending") {
    return haunted.result === "MISMATCH" ? `${name} woke. the oracle disagrees.` : `${name} slept through it.`;
  }
  if (patch?.state === "active") return `banishing ${name} with the recorded patch…`;
  return "";
}

function useTyped(text: string): string {
  const motion = useMotion();
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (!motion.enabled || !text) {
      setShown(text);
      return;
    }
    let i = 0;
    setShown("");
    const timer = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(timer);
    }, 34);
    return () => window.clearInterval(timer);
  }, [text, motion.enabled]);
  return shown;
}

export function DemoStepper({ steps, started, run, busy, replayOnly, liveHosted, retry, showRetry, mutation }: Props) {
  const spell = incantation(steps, mutation);
  const typed = useTyped(spell);
  const activeIndex = steps.findIndex((step) => step.state === "active");
  const now = useNow(activeIndex !== -1);
  const running = run.phase !== "idle" && run.phase !== "finished";
  const waitingLive = run.live && run.phase === "starting";
  const runPercent = run.planned > 0 ? Math.min(100, Math.round((run.cases / run.planned) * 100)) : null;
  const lastDone = steps.reduce((last, step, i) => (step.state === "pending" ? last : i), -1);
  const finished = started && activeIndex === -1 && steps.every((step) => step.state !== "pending");

  const where = !started
    ? "Not started. Press guided demo above."
    : activeIndex !== -1
      ? `Step ${activeIndex + 1} of ${steps.length}`
      : finished
        ? steps.some((step) => step.state === "waiting")
        ? "Finished, waiting for a reviewer"
        : "Finished"
        : `Step ${lastDone + 1} of ${steps.length} done`;

  return (
    <section className="stepper" aria-labelledby="demo-title">
      <div className="stepper__head">
        <h2 id="demo-title">Guided demo</h2>
        <p className="hint">
          {replayOnly
            ? "Recorded runs, in order"
            : liveHosted
              ? "Live runs, with a simulated inject and a recorded rerun"
              : "Real API calls, in order"}
          <span aria-hidden="true">{" · "}</span>
          <span className="stepper__where">{where}</span>
        </p>
      </div>
      {started ? (
        <p className={`incant${spell ? " is-casting" : ""}`} aria-hidden="true">
          {typed}
        </p>
      ) : null}
      <ol className="stepper__list">
        {steps.map((step, i) => {
          const active = step.state === "active";
          const measured = active && running && !waitingLive && runPercent !== null;
          const fill =
            step.state === "done" || step.state === "failed" ? 100 : measured ? runPercent : 0;
          const tone = step.result ? toneOf(step.result) : step.state === "failed" ? "error" : "idle";
          return (
            <li
              key={i}
              className={`stepper__step step--${step.state} stepper__step--${tone}`}
              aria-current={active ? "step" : undefined}
            >
              <span className="stepper__rail" aria-hidden="true">
                <span
                  className={`stepper__fill${active && !measured ? " stepper__fill--wait" : ""}`}
                  style={{ width: active && !measured ? undefined : `${fill}%` }}
                />
              </span>
              <span className="stepper__top">
                <span className="step__mark" aria-hidden="true">
                  {STEP_MARK[step.state] ?? i + 1}
                </span>
                <span className="stepper__title" aria-hidden="true">
                  {step.short ?? step.label}
                </span>
                <span className="visually-hidden">
                  Step {i + 1}, {step.label}, {STATE_TEXT[step.state]}
                </span>
              </span>
              <span className="stepper__meta">
                {active && measured ? <span className="step__time num">{runPercent}%</span> : null}
                {active && step.startedAt ? <span className="step__time num">{seconds(step.startedAt, now)}</span> : null}
                {step.result ? <StatusBadge status={step.result} /> : null}
              </span>
              {step.note ? <span className="stepper__note">{step.note}</span> : null}
            </li>
          );
        })}
      </ol>
      {retry && !busy && showRetry && steps.some((step) => step.state === "failed") ? (
        <div className="button-row">
          <button type="button" className="button" onClick={retry.run}>
            {retry.label}
          </button>
        </div>
      ) : null}
    </section>
  );
}
