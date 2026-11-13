import { useCallback, useEffect, useRef, useState } from "react";
import { api, describeError } from "./api";
import { ApiTester } from "./components/ApiTester";
import { Circle, type Controls, type DemoStep } from "./components/Circle";
import { Crypt } from "./components/Crypt";
import { Twin, type PatchState } from "./components/Twin";
import { SAMPLE_CLAIMS } from "./data";
import { setLiveMode, useRunner } from "./runner";
import type { Counterexample, Decision, FocusTrace, Health, Mutation, RunRequest, Status } from "./types";

const DEMO_LABELS = [
  "Baseline run, twin as written",
  "Inject mutation M4",
  "Run with demo config",
  "Apply recorded patch and rerun",
  "Approval card",
];

const DEFAULT_PATCH_MUTATION = "M4";
const HOLD_SHORT = 1200;
const HOLD_LONG = 4000;

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

export function App() {
  const runner = useRunner();
  const { state: run } = runner;
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
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

  const replayOnly = health !== null ? !health.oracle_available : healthError !== null;
  const running = run.phase !== "idle" && run.phase !== "finished";
  const busy = running || demoRunning;

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setLiveMode(Boolean(h.hosted && h.oracle_available));
        setHealth(h);
      })
      .catch((err) => setHealthError(describeError(err).message));
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

  const replaySnapshot = useCallback(async (): Promise<Status> => {
    runner.starting();
    try {
      const snapshot = await api.snapshot();
      return await runner.replay(snapshot);
    } catch (err) {
      const { message } = describeError(err);
      runner.fail("SNAPSHOT_UNAVAILABLE", `No recorded evidence to replay. ${message}`);
      return "RUNTIME ERROR";
    }
  }, [runner]);

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
        void replaySnapshot();
        return;
      }
      const body: RunRequest = { profile: controls.profile, seed: cx.seed };
      if (cx.mutation) body.mutation = cx.mutation;
      else if (controls.mutation) body.mutation = controls.mutation;
      if (controls.useDemoConfig || injected) body.use_demo_config = true;
      void runner.start(body);
    },
    [replayOnly, replaySnapshot, runner, controls, injected],
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

  const onExorcise = useCallback(async () => {
    try {
      const runId = await applyPatch(injected ?? DEFAULT_PATCH_MUTATION);
      if (runId) await runner.follow(runId);
      else await runner.start({ profile: "full", seed: controls.seed ? Number(controls.seed) : undefined });
    } catch (err) {
      setPatch({ phase: "error", diff: null, runId: null, error: describeError(err).message });
    }
  }, [applyPatch, runner, injected, controls.seed]);

  const onDemo = useCallback(async () => {
    setDemoRunning(true);
    const steps: DemoStep[] = DEMO_LABELS.map((label) => ({ label, state: "pending" }));
    const update = (i: number, patchStep: Partial<DemoStep>) => {
      steps[i] = { ...steps[i], ...patchStep };
      setDemo([...steps]);
    };
    setDemo([...steps]);
    setFocusedCx(null);
    let current = 0;
    try {
      if (replayOnly) {
        for (let i = 1; i < steps.length; i += 1) update(i, { note: "Needs the live oracle" });
        update(0, { state: "active", label: "Replay recorded evidence", note: "The live story needs the oracle" });
        const result = await replaySnapshot();
        update(0, { state: "done", result, note: "Recorded from an earlier real run" });
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
      window.setTimeout(() => {
        const heading = document.querySelector<HTMLElement>("#approval h3");
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        heading?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
        heading?.focus({ preventScroll: true });
      }, 50);
    } catch (err) {
      const { code, message } = describeError(err);
      update(current, { state: "failed", note: `${message} (${code})` });
      if (current === 3) setPatch({ phase: "error", diff: null, runId: null, error: message });
    } finally {
      setDemoRunning(false);
    }
  }, [replayOnly, replaySnapshot, controls.seed, runner, applyPatch]);

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
    <>
      <a className="skip" href="#circle">
        Skip to the Summoning Circle
      </a>
      <header className="masthead">
        <div className="masthead__title">
          <h1>Necromancer</h1>
          <p>Verification workbench for legacy COBOL migration. The compiled program is the oracle.</p>
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
              <dd>Hosted demo</dd>
            </div>
          ) : null}
        </dl>
      </header>

      {replayOnly ? (
        <div className="banner" role="status">
          <span aria-hidden="true">{"◇"}</span>{" "}
          {healthError
            ? "The server could not be reached. Runs replay recorded evidence from the snapshot when it is available."
            : "The COBOL oracle is not available here. Runs replay recorded evidence from a real earlier run, not live comparisons."}
        </div>
      ) : null}

      <main className="console">
        <Crypt focus={focus} claimId={claimId} onPickClaim={onPickClaim} />
        <Circle
          run={run}
          busy={busy}
          controls={controls}
          onControls={setControls}
          mutations={mutations}
          injected={injected}
          replayOnly={replayOnly}
          simulated={Boolean(health?.hosted)}
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
      </main>

      <ApiTester runId={run.runId} />

      <footer className="footer">
        <p>
          Every verdict is evidence over the cases counted, never a proof of equivalence. All claims are synthetic.
        </p>
      </footer>
    </>
  );
}
