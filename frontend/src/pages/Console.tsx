import { useCallback, useEffect, useRef, useState } from "react";
import { api, describeError } from "../api";
import { ApiTester } from "../components/ApiTester";
import { Circle, type Controls, type DemoStep } from "../components/Circle";
import { Crypt } from "../components/Crypt";
import { Twin, type PatchState } from "../components/Twin";
import { SAMPLE_CLAIMS } from "../data";
import { useRunner } from "../runner";
import type { Counterexample, Decision, FocusTrace, Health, Mutation, RunRequest, Snapshot, Status } from "../types";

const DEMO_LABELS = [
  "Baseline run, twin as written",
  "Inject mutation M4",
  "Run with demo config",
  "Apply recorded patch and rerun",
  "Approval card",
];

const RECORDED_LABELS = [
  "Recorded baseline, twin as written",
  "Recorded injection of mutation M4",
  "Recorded run with M4 injected",
  "Recorded patch and full rerun",
  "Approval card",
];

const DEFAULT_PATCH_MUTATION = "M4";
const RECORDED_MUTATION = "M4";
const HOLD_SHORT = 1200;
const HOLD_LONG = 4000;

type RecordedKey = "baseline" | "injected" | "after_patch";

const RECORDED_NAMES: Record<RecordedKey, string> = {
  baseline: "baseline",
  injected: "injected mutation",
  after_patch: "after patch",
};

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
  const [recorded, setRecorded] = useState<Snapshot | null>(null);

  const replayOnly = health !== null ? !health.oracle_available : healthError !== null;
  const hosted = Boolean(health?.hosted);
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
        setRecorded(recorded);
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
      const body: RunRequest = { profile: controls.profile };
      if (controls.seed) body.seed = Number(controls.seed);
      if (controls.mutation) body.mutation = controls.mutation;
      if (controls.useDemoConfig) body.use_demo_config = true;
      return { ...body, ...overrides };
    },
    [controls],
  );

  const onRun = useCallback(() => {
    setFocusedCx(null);
    if (replayOnly) void replaySnapshot();
    else void runner.start(buildRequest());
  }, [replayOnly, replaySnapshot, runner, buildRequest]);

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
      void runner.start(body);
    },
    [replayOnly, replayRecorded, runner, controls, injected],
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
    setRecorded(after);
    return runner.replay(after);
  }, [loadSnapshot, recordedDiff, runner]);

  const onExorcise = useCallback(async () => {
    if (replayOnly) {
      await exorciseRecorded();
      return;
    }
    try {
      const runId = await applyPatch(injected ?? DEFAULT_PATCH_MUTATION);
      if (runId) await runner.follow(runId);
      else await runner.start({ profile: "full", seed: controls.seed ? Number(controls.seed) : undefined });
    } catch (err) {
      setPatch({ phase: "error", diff: null, runId: null, error: describeError(err).message });
    }
  }, [replayOnly, exorciseRecorded, applyPatch, runner, injected, controls.seed]);

  const focusApproval = () => {
    window.setTimeout(() => {
      const heading = document.querySelector<HTMLElement>("#approval h3");
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      heading?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      heading?.focus({ preventScroll: true });
    }, 50);
  };

  const onDemo = useCallback(async () => {
    setDemoRunning(true);
    const labels = replayOnly ? RECORDED_LABELS : DEMO_LABELS;
    const steps: DemoStep[] = labels.map((label) => ({ label, state: "pending" }));
    const update = (i: number, patchStep: Partial<DemoStep>) => {
      steps[i] = { ...steps[i], ...patchStep };
      setDemo([...steps]);
    };
    setDemo([...steps]);
    setFocusedCx(null);
    let current = 0;
    try {
      if (replayOnly) {
        update(0, { state: "active" });
        const baseline = await replayRecorded("baseline");
        if (baseline === "RUNTIME ERROR") throw new Error("The recorded baseline could not be replayed.");
        update(0, { state: "done", result: baseline, note: `Recorded run ${snapshotRef.current?.runs?.baseline?.run_id ?? ""}`.trim() });
        await hold(HOLD_SHORT);

        current = 1;
        update(1, { state: "active" });
        setInjected(RECORDED_MUTATION);
        setControls((c) => ({ ...c, mutation: RECORDED_MUTATION }));
        update(1, { state: "done", note: "Recorded. Nothing on this server was changed." });

        current = 2;
        update(2, { state: "active" });
        const broken = await replayRecorded("injected");
        if (broken === "RUNTIME ERROR") throw new Error("The recorded M4 run could not be replayed.");
        update(2, { state: "done", result: broken, note: broken === "MISMATCH" ? "Recorded counterexample, already shrunk" : "Recorded" });
        await hold(HOLD_LONG);

        current = 3;
        update(3, { state: "active" });
        const healed = await exorciseRecorded();
        if (healed === "NOT RUN") throw new Error("The recorded rerun after the patch is missing.");
        update(3, { state: "done", result: healed, note: "Recorded full profile rerun" });

        current = 4;
        update(4, { state: "done", result: "APPROVAL REQUIRED", note: "Recorded evidence, waiting for a reviewer" });
        focusApproval();
        return;
      }
      const seed = controls.seed ? Number(controls.seed) : Math.floor(Math.random() * 900000) + 100000;
      setControls((c) => ({ ...c, seed: String(seed), mutation: "", profile: "demo" }));

      update(0, { state: "active" });
      const baseline = await runner.start({ profile: "demo", seed });
      update(0, { state: "done", result: baseline, note: baseline === "MATCH" ? undefined : "Baseline was not green" });
      await hold(HOLD_SHORT);

      current = 1;
      update(1, { state: "active" });
      await api.inject("M4");
      setInjected("M4");
      setControls((c) => ({ ...c, useDemoConfig: true }));
      update(1, { state: "done", note: "POST /api/demo/inject" });

      current = 2;
      update(2, { state: "active" });
      const broken = await runner.start({ profile: "demo", seed, mutation: "M4", use_demo_config: true });
      update(2, { state: "done", result: broken, note: broken === "MISMATCH" ? "Counterexample shrunk" : undefined });
      await hold(HOLD_LONG);

      current = 3;
      update(3, { state: "active" });
      const rerunId = await applyPatch("M4");
      const healed = rerunId ? await runner.follow(rerunId) : await runner.start({ profile: "full", seed });
      update(3, { state: "done", result: healed });

      current = 4;
      update(4, { state: "done", result: "APPROVAL REQUIRED" });
      focusApproval();
    } catch (err) {
      const { code, message } = describeError(err);
      update(current, { state: "failed", note: `${message} (${code})` });
      if (current === 3 && !replayOnly) setPatch({ phase: "error", diff: null, runId: null, error: message });
    } finally {
      setDemoRunning(false);
    }
  }, [replayOnly, replayRecorded, exorciseRecorded, controls.seed, runner, applyPatch]);

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
  };

  return (
    <div className="console-page">
      <header className="console-head">
        <div className="console-head__title">
          <p className="eyebrow mono">bench no. 1, oracle against twin</p>
          <h1 tabIndex={-1}>the console</h1>
          <p className="console-head__lede">
            Legacy source on the left, the verdict in the middle, the twin on the right. Press guided demo for the
            whole story, or poke at it yourself.
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

      <div className="console">
        <Crypt focus={focus} claimId={claimId} onPickClaim={onPickClaim} />
        <Circle
          run={run}
          busy={busy}
          controls={controls}
          onControls={setControls}
          mutations={mutations}
          injected={injected}
          replayOnly={replayOnly}
          simulated={hosted}
          recorded={run.replay ? recorded : null}
          demo={demo}
          focusedId={focusedCx}
          decisions={decisions}
          onRun={onRun}
          onDemo={onDemo}
          onFocusCx={onFocusCx}
          onRerun={onRerun}
          onDecide={onDecide}
          onApprove={onApprove}
        />
        <Twin focus={focus} patch={patch} busy={busy} onExorcise={onExorcise} />
      </div>

      <ApiTester runId={run.runId} />
    </div>
  );
}
