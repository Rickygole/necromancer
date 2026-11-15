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
  retry: { label: string; run: () => void } | null;
  showRetry: boolean;
}

const STEP_MARK: Record<DemoStep["state"], string | null> = {
  pending: null,
  active: "◆",
  done: "✓",
  failed: "✕",
  skipped: "○",
};

export function DemoStepper({ steps, started, run, busy, replayOnly, retry, showRetry }: Props) {
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
        ? "Finished"
        : `Step ${lastDone + 1} of ${steps.length} done`;

  return (
    <section className="stepper" aria-labelledby="demo-title">
      <div className="stepper__head">
        <h2 id="demo-title">Guided demo</h2>
        <p className="hint">
          {replayOnly ? "Recorded runs, in order" : "Real API calls, in order"}
          <span aria-hidden="true">{" · "}</span>
          <span className="stepper__where">{where}</span>
        </p>
      </div>
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
                  Step {i + 1}, {step.label}, {step.state}
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
