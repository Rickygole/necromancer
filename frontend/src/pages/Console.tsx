import { useCallback, useEffect, useRef, useState } from "react";
import { api, describeError } from "../api";
import { ApiTester } from "../components/ApiTester";
import { ApprovalCard } from "../components/ApprovalCard";
import { Circle, type Controls, type DemoStep } from "../components/Circle";
import { CounterexampleCard } from "../components/CounterexampleCard";
import { Crypt } from "../components/Crypt";
import { Decisions } from "../components/Decisions";
import { DemoStepper } from "../components/DemoStepper";
import { PatchPanel, type PatchState } from "../components/PatchPanel";
import { RunControls } from "../components/RunControls";
import { Twin } from "../components/Twin";
import { DEMO_SEED } from "../content";
import { SAMPLE_CLAIMS } from "../data";
import { RECORDED_FULL_LABEL, useRunner } from "../runner";
import type { Counterexample, Decision, FocusTrace, Health, Mutation, RunRequest, Snapshot, Status } from "../types";

const DEMO_LABELS = [
  "Baseline run, twin with the three preserved legacy behaviors",
  "Inject mutation M4",
  "Run with demo config",
  "Apply recorded patch and rerun",
  "Approval card",
];

const RECORDED_LABELS = [
  "Recorded baseline, twin with the three preserved legacy behaviors",
  "Recorded injection of mutation M4",
  "Recorded run with M4 injected",
  "Recorded patch and full rerun",
  "Approval card",
];

const DEMO_SHORT = ["Baseline", "Inject M4", "Run with M4", "Patch and rerun", "Approval"];

const RECORDED_SHORT = ["Recorded baseline", "Recorded M4 injection", "Recorded M4 run", "Recorded patch and rerun", "Approval"];

const DEFAULT_PATCH_MUTATION = "M4";
const RECORDED_MUTATION = "M4";
const HOLD_SHORT = 700;
const HOLD_LONG = 900;

type RecordedKey = "baseline" | "injected" | "after_patch";

const RECORDED_NAMES: Record<RecordedKey, string> = {
  baseline: "baseline",
  injected: "injected mutation",
  after_patch: "after patch",
};

const APPROVABLE: Status[] = ["APPROVAL REQUIRED", "MATCH"];

function scrollToHeading(id: string) {
  window.setTimeout(() => {
    const heading = document.getElementById(id);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    heading?.focus({ preventScroll: true });
  }, 50);
}

function hold(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function claimFocus(id: string): FocusTrace {
  const claim = SAMPLE_CLAIMS.find((c) => c.id === id) ?? SAMPLE_CLAIMS[0];
  const trace = claim.output.slice(30, 40);
  return { oracle: trace, twin: trace, source: `sample claim ${claim.id}` };
}

function cxFocus(cx: Counterexample): FocusTrace {
  return { oracle: cx.trace_diff.oracle, twin: cx.trace_diff.twin, source: `counterexample ${cx.id}` };
}

function recordedRun(snapshot: Snapshot, key: RecordedKey): Snapshot | null {
  const run = snapshot.runs?.[key];
  if (run && Array.isArray(run.events)) return run;
  if (key === "injected") return snapshot;
  return null;
}

async function staticPatch(id: string): Promise<string | null> {
  try {
    const response = await fetch(`/patches/${encodeURIComponent(id)}.patch`);
    if (!response.ok) return null;
    const text = await response.text();
    if (/^\s*<!doctype/i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

interface Props {
  health: Health | null;
  healthError: string | null;
}

export function Console({ health, healthError }: Props) {
  const runner = useRunner();
  const { state: run } = runner;
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [controls, setControls] = useState<Controls>({ profile: "demo", seed: "", mutation: "", useDemoConfig: false });
  const [injected, setInjected] = useState<string | null>(null);
  const [claimId, setClaimId] = useState(SAMPLE_CLAIMS[0].id);
  const [focus, setFocus] = useState<FocusTrace | null>(() => claimFocus(SAMPLE_CLAIMS[0].id));
  const [focusedCx, setFocusedCx] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoStep[] | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [patch, setPatch] = useState<PatchState>({ phase: "idle", diff: null, runId: null, error: null });
  const snapshotRef = useRef<Snapshot | null>(null);
  const demoGenRef = useRef(0);
  const [retry, setRetry] = useState<{ label: string; run: () => void } | null>(null);
  const [requested, setRequested] = useState<{ seed: number | null; profile: string | null }>({ seed: null, profile: null });
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const replayOnly = health !== null ? !health.oracle_available : healthError !== null;
  const hosted = Boolean(health?.hosted);
  const liveHosted = hosted && !replayOnly;
  const running = run.phase !== "idle" && run.phase !== "finished";
  const busy = running || demoRunning;

  useEffect(() => {
    api
      .mutations()
      .then(setMutations)
      .catch(() => setMutations([]));
    api
      .decisions()
      .then(setDecisions)
      .catch(() => setDecisions([]));
  }, []);

  const focusedCxRef = useRef(focusedCx);
  focusedCxRef.current = focusedCx;
  useEffect(() => {
    if (focusedCxRef.current !== null) {
      setFocus(claimFocus(claimId));
      setFocusedCx(null);
    }
  }, [run.runId]);

  const firstCxId = run.counterexamples[0]?.id ?? null;
  useEffect(() => {
    const first = run.counterexamples.find((cx) => cx.id === firstCxId);
    if (first) {
      setFocus(cxFocus(first));
      setFocusedCx(first.id);
    }
  }, [firstCxId]);

  const launch = useCallback(
    (body: RunRequest) => {
      setRequested({ seed: body.seed ?? null, profile: body.profile });
      return runner.start(body);
    },
    [runner],
  );

  const loadSnapshot = useCallback(async (): Promise<Snapshot> => {
    if (!snapshotRef.current) snapshotRef.current = await api.snapshot();
    return snapshotRef.current;
  }, []);

  const replayRecorded = useCallback(
    async (key: RecordedKey): Promise<Status> => {
      runner.starting();
      try {
        const snapshot = await loadSnapshot();
        const recorded = recordedRun(snapshot, key);
        if (!recorded) throw new Error(`The snapshot has no recorded ${RECORDED_NAMES[key]} run.`);
        return await runner.replay(recorded);
      } catch (err) {
        const { message } = describeError(err);
        runner.fail("SNAPSHOT_UNAVAILABLE", `No recorded evidence to replay. ${message}`);
        return "RUNTIME ERROR";
      }
    },
    [runner, loadSnapshot],
  );

  const replaySnapshot = useCallback(
    () => replayRecorded(controls.mutation === RECORDED_MUTATION ? "injected" : "baseline"),
    [replayRecorded, controls.mutation],
  );

  const recordedDiff = useCallback(
    async (mutationId: string): Promise<string | null> => {
      const id = "fix-" + mutationId;
      if (hosted) {
        try {
          const result = await api.applyPatch(id);
          if (typeof result.diff === "string") return result.diff;
        } catch {
          return staticPatch(id);
        }
      }
      return staticPatch(id);
    },
    [hosted],
  );

  const buildRequest = useCallback(
    (overrides: Partial<RunRequest> = {}): RunRequest => {
      const body: RunRequest = { profile: controls.profile, seed: controls.seed ? Number(controls.seed) : DEMO_SEED };
      if (controls.mutation) body.mutation = controls.mutation;
      if (controls.useDemoConfig) body.use_demo_config = true;
      return { ...body, ...overrides };
    },
    [controls],
  );

  const onRun = useCallback(() => {
    setFocusedCx(null);
    if (replayOnly) {
      setRetry({ label: "Retry the replay", run: () => void replaySnapshot() });
      void replaySnapshot();
      return;
    }
    const body = buildRequest();
    setRetry({ label: "Retry this run", run: () => void launch(body) });
    void launch(body);
  }, [replayOnly, replaySnapshot, launch, buildRequest]);

  const onRerun = useCallback(
    (cx: Counterexample) => {
      if (replayOnly) {
        void replayRecorded(cx.mutation === RECORDED_MUTATION ? "injected" : "baseline");
        return;
      }
      const body: RunRequest = { profile: controls.profile, seed: cx.seed };
      if (cx.mutation) body.mutation = cx.mutation;
      else if (controls.mutation) body.mutation = controls.mutation;
      if (controls.useDemoConfig || injected) body.use_demo_config = true;
      setRetry({ label: "Retry this run", run: () => void launch(body) });
      void launch(body);
    },
    [replayOnly, replayRecorded, launch, controls, injected],
  );

  const applyPatch = useCallback(async (mutationId: string) => {
    setPatch({ phase: "applying", diff: null, runId: null, error: null });
    const result = await api.applyPatch("fix-" + mutationId);
    const diff = typeof result.diff === "string" ? result.diff : typeof result.patch === "string" ? result.patch : null;
    setPatch({ phase: "applied", diff, runId: result.run_id ?? null, error: null });
    setInjected(null);
    setControls((c) => ({ ...c, mutation: "" }));
    return result.run_id ?? null;
  }, []);

  const exorciseRecorded = useCallback(async (): Promise<Status> => {
    setPatch({ phase: "applying", diff: null, runId: null, error: null, recorded: true });
    let after: Snapshot | null = null;
    try {
      after = recordedRun(await loadSnapshot(), "after_patch");
    } catch (err) {
      setPatch({
        phase: "error",
        diff: null,
        runId: null,
        error: `The recorded rerun could not be loaded. ${describeError(err).message}`,
        recorded: true,
      });
      return "NOT RUN";
    }
    if (!after) {
      setPatch({ phase: "error", diff: null, runId: null, error: "This snapshot has no recorded rerun after the patch.", recorded: true });
      return "NOT RUN";
    }
    const diff = await recordedDiff(RECORDED_MUTATION);
    setPatch({ phase: "applied", diff, runId: after.run_id, error: null, recorded: true });
    setInjected(null);
    setControls((c) => ({ ...c, mutation: "" }));
    return runner.replay(after);
  }, [loadSnapshot, recordedDiff, runner]);

  const onExorcise = useCallback(async () => {
    setRetry(null);
    if (replayOnly) {
      await exorciseRecorded();
      return;
    }
    try {
      const runId = await applyPatch(injected ?? DEFAULT_PATCH_MUTATION);
      const full = { profile: "full" as const, seed: controls.seed ? Number(controls.seed) : undefined };
      setRetry({ label: "Retry the rerun", run: () => void launch(full) });
      if (runId && !liveHosted) {
        setRequested({ seed: full.seed ?? null, profile: "full" });
        await runner.follow(runId);
      }
      else await launch(full);
    } catch (err) {
      setPatch({ phase: "error", diff: null, runId: null, error: describeError(err).message });
    }
  }, [replayOnly, liveHosted, exorciseRecorded, applyPatch, runner, launch, injected, controls.seed]);

  const focusApproval = () => {
    window.setTimeout(() => {
      const heading = document.querySelector<HTMLElement>("#approval h3");
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      heading?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      heading?.focus({ preventScroll: true });
    }, 50);
  };

  const onDemo = useCallback(async () => {
    setRetry(null);
    const gen = ++demoGenRef.current;
    const cancelled = () => gen !== demoGenRef.current;
    setDemoRunning(true);
    const labels = replayOnly ? RECORDED_LABELS : DEMO_LABELS;
    const shorts = replayOnly ? RECORDED_SHORT : DEMO_SHORT;
    const steps: DemoStep[] = labels.map((label, i) => ({ label, short: shorts[i], state: "pending" }));
    const update = (i: number, patchStep: Partial<DemoStep>) => {
      const next = { ...steps[i], ...patchStep };
      if (patchStep.state === "active") next.startedAt = Date.now();
      else if (patchStep.state) next.startedAt = undefined;
      steps[i] = next;
      if (!cancelled()) setDemo([...steps]);
    };
    const guard = () => {
      if (cancelled()) throw new Error("CANCELLED");
    };
    const finishApproval = (healed: Status, recordedNote: boolean) => {
      if (APPROVABLE.includes(healed)) {
        update(4, {
          state: "done",
          result: "APPROVAL REQUIRED",
          note: recordedNote ? "Recorded evidence, waiting for a reviewer" : "Waiting for a reviewer",
        });
        focusApproval();
      } else {
        update(4, {
          state: "skipped",
          note: `Skipped: step 4 ended in ${healed}, so there is no candidate to approve.`,
        });
      }
    };
    setDemo([...steps]);
    setFocusedCx(null);
    let current = 0;
    try {
      if (replayOnly) {
        update(0, { state: "active" });
        const baseline = await replayRecorded("baseline");
        guard();
        if (baseline === "RUNTIME ERROR") throw new Error("The recorded baseline could not be replayed.");
        update(0, { state: "done", result: baseline, note: `Recorded run ${snapshotRef.current?.runs?.baseline?.run_id ?? ""}`.trim() });
        await hold(HOLD_SHORT);
      guard();

        current = 1;
        update(1, { state: "active" });
        setInjected(RECORDED_MUTATION);
        setControls((c) => ({ ...c, mutation: RECORDED_MUTATION }));
        update(1, { state: "done", note: "Recorded. Nothing on this server was changed." });

        current = 2;
        update(2, { state: "active" });
        const broken = await replayRecorded("injected");
        guard();
        if (broken === "RUNTIME ERROR") throw new Error("The recorded M4 run could not be replayed.");
        update(2, { state: "done", result: broken, note: broken === "MISMATCH" ? "Recorded counterexample, already shrunk" : "Recorded" });
        await hold(HOLD_LONG);
      guard();

        current = 3;
        update(3, { state: "active" });
        const healed = await exorciseRecorded();
        guard();
        if (healed === "NOT RUN") throw new Error("The recorded rerun after the patch is missing.");
        update(3, { state: healed === "RUNTIME ERROR" ? "failed" : "done", result: healed, note: "Recorded full profile rerun" });

        current = 4;
        finishApproval(healed, true);
        return;
      }
      const seed = controls.seed ? Number(controls.seed) : DEMO_SEED;
      setControls((c) => ({ ...c, seed: String(seed), mutation: "", profile: "demo" }));
      const stepFailed = (status: Status) => status === "RUNTIME ERROR" || status === "BUILD FAILED";

      update(0, { state: "active" });
      const baseline = await launch({ profile: "demo", seed });
      guard();
      if (stepFailed(baseline)) throw new Error("The baseline run did not finish.");
      update(0, { state: "done", result: baseline, note: baseline === "MATCH" ? undefined : "Baseline was not green" });
      await hold(HOLD_SHORT);
      guard();

      current = 1;
      update(1, { state: "active" });
      await api.inject("M4");
      guard();
      setInjected("M4");
      setControls((c) => ({ ...c, useDemoConfig: true }));
      update(1, { state: "done", note: liveHosted ? "POST /api/demo/inject, simulated on the hosted build" : "POST /api/demo/inject" });

      current = 2;
      update(2, { state: "active" });
      const broken = await launch({ profile: "demo", seed, mutation: "M4", use_demo_config: true });
      guard();
      if (stepFailed(broken)) throw new Error("The run with M4 injected did not finish.");
      update(2, { state: "done", result: broken, note: broken === "MISMATCH" ? "Counterexample shrunk" : undefined });
      await hold(HOLD_LONG);
      guard();

      current = 3;
      update(3, { state: "active" });
      const rerunId = await applyPatch("M4");
      if (rerunId && !liveHosted) setRequested({ seed: null, profile: "full" });
      const healed = rerunId && !liveHosted ? await runner.follow(rerunId) : await launch({ profile: "full", seed });
      guard();
      if (stepFailed(healed)) throw new Error("The rerun after the patch did not finish.");
      update(3, { state: "done", result: healed, note: liveHosted ? RECORDED_FULL_LABEL : undefined });

      current = 4;
      finishApproval(healed, liveHosted);
    } catch (err) {
      if (cancelled()) return;
      const { code, message } = describeError(err);
      update(current, { state: "failed", note: code === "CLIENT" ? message : `${message} (${code})` });
      for (let i = current + 1; i < steps.length; i++) {
        update(i, { state: "skipped", note: `Skipped: step ${current + 1} did not finish.` });
      }
      if (current === 3 && !replayOnly) setPatch({ phase: "error", diff: null, runId: null, error: message });
      setRetry({ label: "Retry the guided demo", run: () => void onDemoRef.current() });
    } finally {
      if (!cancelled()) setDemoRunning(false);
    }
  }, [replayOnly, liveHosted, replayRecorded, exorciseRecorded, controls.seed, runner, launch, applyPatch]);

  const onStop = useCallback(() => {
    demoGenRef.current += 1;
    runner.cancel();
    setDemo(null);
    setDemoRunning(false);
  }, [runner]);

  const onDemoRef = useRef(onDemo);
  onDemoRef.current = onDemo;

  const onDecide = useCallback(
    async (decision: Decision) => {
      try {
        await api.decide(decision);
      } catch (err) {
        throw new Error(describeError(err).message);
      }
      setDecisions((list) => [...list, decision]);
      if (run.runId && !run.replay) await runner.refreshReport(run.runId);
    },
    [run.runId, run.replay, runner],
  );

  const onApprove = useCallback(
    async (approved: boolean, reviewer: string, note: string) => {
      if (!run.runId) throw new Error("There is no run to approve.");
      try {
        await api.approve(run.runId, { approved, reviewer, note });
      } catch (err) {
        throw new Error(describeError(err).message);
      }
    },
    [run.runId],
  );

  const onPickClaim = (id: string) => {
    setClaimId(id);
    setFocus(claimFocus(id));
    setFocusedCx(null);
  };

  const onFocusCx = (cx: Counterexample) => {
    setFocus(cxFocus(cx));
    setFocusedCx(cx.id);
    setSourcesOpen(true);
    scrollToHeading("sources-title");
  };

  const stepLabels = replayOnly ? RECORDED_LABELS : DEMO_LABELS;
  const stepShorts = replayOnly ? RECORDED_SHORT : DEMO_SHORT;
  const steps: DemoStep[] = demo ?? stepLabels.map((label, i) => ({ label, short: stepShorts[i], state: "pending" }));
  const runLabel = replayOnly ? (controls.mutation === "M4" ? "Replay recorded M4 run" : "Replay recorded baseline") : "Run comparison";
  const failedRun = run.phase === "finished" && run.error !== null && run.status !== "BUILD FAILED";
  const shownSeed = run.report?.seed ?? run.source?.seed ?? requested.seed;
  const shownProfile = run.report?.profile ?? run.source?.profile ?? requested.profile;
  const moreCx = run.counterexamples.slice(1);

  return (
    <div className="console-page">
      <header className="console-head">
        <div className="console-head__title">
          <p className="eyebrow mono">bench no. 1, oracle against twin</p>
          <h1 tabIndex={-1}>the console</h1>
          <p className="console-head__lede">
            One verdict, oracle against twin. Press guided demo for the whole story, or open run settings and poke at
            it yourself.
          </p>
        </div>
        <dl className="health" aria-label="Server health">
          <div>
            <dt>Oracle</dt>
            <dd>
              {health ? (
                health.oracle_available ? (
                  <span className="decided">
                    <span aria-hidden="true">{"✓"}</span> Available
                  </span>
                ) : (
                  <span className="rejected">
                    <span aria-hidden="true">{"✕"}</span> Unavailable
                  </span>
                )
              ) : healthError ? (
                <span className="rejected">
                  <span aria-hidden="true">{"✕"}</span> Unreachable
                </span>
              ) : (
                "Checking"
              )}
            </dd>
          </div>
          <div>
            <dt>Compiler</dt>
            <dd className="mono">{health?.compiler_version ?? "unknown"}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd className="mono">{health?.app_version ?? "unknown"}</dd>
          </div>
          {health?.hosted ? (
            <div>
              <dt>Mode</dt>
              <dd>{replayOnly ? "Hosted, recorded" : "Hosted, live"}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      {replayOnly ? (
        <div className="banner" role="status">
          <span aria-hidden="true">{"◇"}</span>{" "}
          {healthError
            ? "The server could not be reached. Runs replay recorded evidence from the snapshot when it is available."
            : "The COBOL oracle is not available here. Everything below replays recorded runs from a real earlier session, and each one is labeled Recorded. Nothing is compared live."}
        </div>
      ) : null}

      <Circle
        run={run}
        busy={busy}
        recorded={run.replay ? run.source : null}
        demo={demo}
        seed={shownSeed}
        profile={shownProfile}
        focusedId={sourcesOpen ? focusedCx : null}
        runLabel={runLabel}
        onDemo={onDemo}
        retry={retry}
        onStop={onStop}
        onFocusCx={onFocusCx}
        onRerun={onRerun}
        onShowMore={() => scrollToHeading("more-cx-title")}
      />

      <DemoStepper
        steps={steps}
        started={demo !== null}
        run={run}
        busy={busy}
        replayOnly={replayOnly}
        retry={retry}
        showRetry={!(failedRun && run.error?.retry)}
      />

      <div className="console-tools">
        <RunControls
          controls={controls}
          onControls={setControls}
          mutations={mutations}
          injected={injected}
          replayOnly={replayOnly}
          liveHosted={liveHosted}
          busy={busy}
          runLabel={runLabel}
          onRun={onRun}
        />
        <details
          className="drawer drawer--sources"
          open={sourcesOpen}
          onToggle={(e) => setSourcesOpen(e.currentTarget.open)}
        >
          <summary id="sources-title">
            <span className="drawer__title">Legacy and twin source</span>
            <span className="drawer__hint mono">UICALC.cbl beside calculator.py, rule trace lit</span>
          </summary>
          <div className="console-sources">
            <Crypt focus={focus} claimId={claimId} onPickClaim={onPickClaim} open={sourcesOpen} />
            <Twin focus={focus} open={sourcesOpen} />
          </div>
        </details>
      </div>

      <section className="lower" aria-labelledby="lower-title">
        <div className="lower__head">
          <h2 id="lower-title">Decide and sign</h2>
          <p className="hint">Human decisions, the recorded patch and the final approval</p>
        </div>

        {run.report && run.phase === "finished" ? (
          <ApprovalCard
            key={run.report.run_id}
            report={run.report}
            verdict={run.status}
            simulated={hosted}
            replay={run.replay}
            onSubmit={onApprove}
          />
        ) : null}

        {moreCx.length > 0 ? (
          <div className="block" role="group" aria-labelledby="more-cx-title">
            <div className="block__head">
              <h3 id="more-cx-title" tabIndex={-1}>
                More counterexamples
              </h3>
              <p className="hint num">
                {run.replay ? "Recorded, " : ""}
                {moreCx.length} after the first
              </p>
            </div>
            <div className="lower__cx">
              {moreCx.map((cx) => (
                <CounterexampleCard
                  key={cx.id}
                  cx={cx}
                  busy={busy}
                  focused={sourcesOpen && focusedCx === cx.id}
                  onFocus={() => onFocusCx(cx)}
                  onRerun={() => onRerun(cx)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="lower__grid">
          <Decisions run={run} decisions={decisions} onDecide={onDecide} />
          <PatchPanel patch={patch} busy={busy} onExorcise={onExorcise} />
        </div>
      </section>

      <ApiTester runId={run.runId} />
    </div>
  );
}
