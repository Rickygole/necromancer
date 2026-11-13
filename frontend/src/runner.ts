import { useCallback, useEffect, useReducer, useRef } from "react";
import { api, describeError, streamRun } from "./api";
import { toStatus } from "./status";
import type { Counterexample, Report, RunEvent, RunRequest, Snapshot, Status } from "./types";

let liveMode = false;

export function setLiveMode(value: boolean) {
  liveMode = value;
}

export type Phase = "idle" | "starting" | "building" | "comparing" | "shrinking" | "finished";

export interface RunState {
  runId: string | null;
  status: Status;
  phase: Phase;
  cases: number;
  matched: number;
  planned: number;
  mismatched: number;
  family: string | null;
  counterexamples: Counterexample[];
  report: Report | null;
  error: { code: string; message: string } | null;
  replay: boolean;
}

const initial: RunState = {
  runId: null,
  status: "NOT RUN",
  phase: "idle",
  cases: 0,
  matched: 0,
  planned: 0,
  mismatched: 0,
  family: null,
  counterexamples: [],
  report: null,
  error: null,
  replay: false,
};

type Action =
  | { type: "starting" }
  | { type: "start"; runId: string; replay: boolean }
  | { type: "event"; event: RunEvent }
  | { type: "report"; report: Report }
  | { type: "counterexamples"; list: Counterexample[] }
  | { type: "fail"; status: Status; code: string; message: string };

function mergeCounterexamples(current: Counterexample[], incoming: Counterexample[]): Counterexample[] {
  const seen = new Map(current.map((cx) => [cx.id, cx]));
  for (const cx of incoming) seen.set(cx.id, cx);
  return Array.from(seen.values());
}

function asCounterexample(event: RunEvent): Counterexample | null {
  const candidate = (event.payload ?? event) as Partial<Counterexample>;
  if (!candidate || typeof candidate.input_record !== "string") return null;
  return candidate as Counterexample;
}

function reducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "starting":
      return { ...initial, phase: "starting" };
    case "start":
      return { ...initial, runId: action.runId, replay: action.replay, phase: "building" };
    case "event": {
      const event = action.event;
      switch (event.type) {
        case "build":
          return { ...state, phase: "building" };
        case "built":
          return { ...state, phase: "comparing" };
        case "progress":
          return {
            ...state,
            phase: state.phase === "shrinking" ? "shrinking" : "comparing",
            cases: event.cases ?? state.cases,
            matched: event.matched ?? state.matched,
            planned: event.planned ?? state.planned,
            mismatched: event.mismatched ?? state.mismatched,
            family: event.family ?? state.family,
          };
        case "mismatch":
          return { ...state, status: "MISMATCH" };
        case "shrinking":
          return { ...state, phase: "shrinking", status: "MISMATCH" };
        case "counterexample": {
          const cx = asCounterexample(event);
          if (!cx) return state;
          return { ...state, status: "MISMATCH", counterexamples: mergeCounterexamples(state.counterexamples, [cx]) };
        }
        case "verdict": {
          const cases = event.cases ?? state.cases;
          const matched = event.matched ?? state.matched;
          return {
            ...state,
            phase: "finished",
            status: toStatus(event.verdict),
            cases,
            matched,
            planned: Math.max(state.planned, cases),
            mismatched: Math.max(0, cases - matched),
          };
        }
        case "error":
          return {
            ...state,
            phase: "finished",
            status: event.code === "BUILD_FAILED" ? "BUILD FAILED" : "RUNTIME ERROR",
            error: { code: event.code ?? "RUNTIME_ERROR", message: event.message ?? "The run stopped with an error." },
          };
        default:
          return state;
      }
    }
    case "report":
      return { ...state, report: action.report };
    case "counterexamples":
      return { ...state, counterexamples: mergeCounterexamples(state.counterexamples, action.list) };
    case "fail":
      return { ...state, phase: "finished", status: action.status, error: { code: action.code, message: action.message } };
    default:
      return state;
  }
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useRunner() {
  const [state, dispatch] = useReducer(reducer, initial);
  const closeRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<number[]>([]);

  const stop = useCallback(() => {
    closeRef.current?.();
    closeRef.current = null;
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  }, []);

  useEffect(() => stop, [stop]);

  const collect = useCallback(async (runId: string) => {
    let report: Report | null = null;
    try {
      report = await api.report(runId);
      dispatch({ type: "report", report });
    } catch {
      report = null;
    }
    try {
      const list = await api.counterexamples(runId);
      if (list.length) dispatch({ type: "counterexamples", list });
    } catch {
      return report;
    }
    return report;
  }, []);

  const refreshReport = useCallback(async (runId: string) => {
    try {
      const report = await api.report(runId);
      dispatch({ type: "report", report });
    } catch {
      return;
    }
  }, []);

  const follow = useCallback(
    (runId: string): Promise<Status> =>
      new Promise<Status>((resolve) => {
        stop();
        dispatch({ type: "start", runId, replay: false });
        let done = false;
        const finish = async (status: Status) => {
          if (done) return;
          done = true;
          stop();
          await collect(runId);
          resolve(status);
        };
        closeRef.current = streamRun(
          runId,
          (event) => {
            dispatch({ type: "event", event });
            if (event.type === "verdict") void finish(toStatus(event.verdict));
            if (event.type === "error") void finish(event.code === "BUILD_FAILED" ? "BUILD FAILED" : "RUNTIME ERROR");
          },
          async () => {
            if (done) return;
            done = true;
            const report = await collect(runId);
            if (report && report.verdict) {
              const status = toStatus(report.verdict);
              dispatch({ type: "event", event: { type: "verdict", verdict: report.verdict, cases: report.cases, matched: report.matched } });
              resolve(status);
            } else {
              dispatch({ type: "fail", status: "RUNTIME ERROR", code: "STREAM_LOST", message: "Lost the event stream before a verdict arrived." });
              resolve("RUNTIME ERROR");
            }
          },
        );
      }),
    [collect, stop],
  );

  const replay = useCallback(
    (snapshot: Snapshot, live = false): Promise<Status> =>
      new Promise<Status>((resolve) => {
        stop();
        dispatch({ type: "start", runId: snapshot.run_id, replay: !live });
        const events = Array.isArray(snapshot.events) ? snapshot.events : [];
        const step = reducedMotion() ? 0 : Math.min(120, Math.max(12, 3600 / Math.max(events.length, 1)));
        events.forEach((event, index) => {
          timersRef.current.push(window.setTimeout(() => dispatch({ type: "event", event }), step * (index + 1)));
        });
        timersRef.current.push(
          window.setTimeout(() => {
            const { counterexamples, events: _events, ...report } = snapshot;
            void _events;
            dispatch({ type: "report", report });
            if (Array.isArray(counterexamples)) dispatch({ type: "counterexamples", list: counterexamples });
            dispatch({
              type: "event",
              event: { type: "verdict", verdict: snapshot.verdict, cases: snapshot.cases, matched: snapshot.matched },
            });
            resolve(toStatus(snapshot.verdict));
          }, step * (events.length + 1)),
        );
      }),
    [stop],
  );

  const start = useCallback(
    async (body: RunRequest): Promise<Status> => {
      stop();
      dispatch({ type: "starting" });
      try {
        if (liveMode) {
          const snapshot = await api.liveRun(body);
          return await replay(snapshot, true);
        }
        const { run_id } = await api.startRun(body);
        return await follow(run_id);
      } catch (error) {
        const { code, message } = describeError(error);
        const status: Status = code === "BUILD_FAILED" ? "BUILD FAILED" : "RUNTIME ERROR";
        dispatch({ type: "fail", status, code, message });
        return status;
      }
    },
    [follow, replay, stop],
  );

  const fail = useCallback((code: string, message: string) => {
    dispatch({ type: "fail", status: "RUNTIME ERROR", code, message });
  }, []);

  return { state, start, follow, replay, refreshReport, fail, starting: () => dispatch({ type: "starting" }) };
}
