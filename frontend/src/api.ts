import type {
  Counterexample,
  Decision,
  Health,
  Mutation,
  Report,
  RunEvent,
  RunRequest,
  Snapshot,
} from "./types";

export class ApiError extends Error {
  code: string;
  detail: unknown;
  status: number;

  constructor(code: string, message: string, detail: unknown, status: number) {
    super(message);
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

export interface RawResponse {
  status: number;
  ok: boolean;
  body: unknown;
  ms: number;
}

export async function rawRequest(method: string, path: string, body?: unknown): Promise<RawResponse> {
  const started = performance.now();
  const response = await fetch(path, {
    method,
    headers: body === undefined ? { Accept: "application/json" } : { "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  } else {
    parsed = null;
  }
  return { status: response.status, ok: response.ok, body: parsed, ms: Math.round(performance.now() - started) };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let raw: RawResponse;
  try {
    raw = await rawRequest(method, path, body);
  } catch (error) {
    throw new ApiError("NETWORK", "Could not reach the server.", String(error), 0);
  }
  if (!raw.ok) {
    const envelope = raw.body as { error?: { code?: string; message?: string; detail?: unknown } } | null;
    const err = envelope && typeof envelope === "object" ? envelope.error : undefined;
    throw new ApiError(
      err?.code ?? `HTTP_${raw.status}`,
      err?.message ?? `Request failed with status ${raw.status}.`,
      err?.detail ?? null,
      raw.status,
    );
  }
  return raw.body as T;
}

function listOf<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as Record<string, unknown>)[key])) {
    return (value as Record<string, T[]>)[key];
  }
  return [];
}

export const api = {
  health: () => request<Health>("GET", "/api/health"),
  mutations: async () => listOf<Mutation>(await request<unknown>("GET", "/api/mutations"), "mutations"),
  startRun: (body: RunRequest) => request<{ run_id: string }>("POST", "/api/runs", body),
  report: (id: string) => request<Report>("GET", `/api/runs/${encodeURIComponent(id)}`),
  counterexamples: async (id: string) =>
    listOf<Counterexample>(
      await request<unknown>("GET", `/api/runs/${encodeURIComponent(id)}/counterexamples`),
      "counterexamples",
    ),
  decisions: async () => listOf<Decision>(await request<unknown>("GET", "/api/decisions"), "decisions"),
  decide: (body: Decision) => request<unknown>("POST", "/api/decisions", body),
  approve: (id: string, body: { approved: boolean; reviewer: string; note: string }) =>
    request<unknown>("POST", `/api/runs/${encodeURIComponent(id)}/approval`, body),
  inject: (mutation: string) => request<unknown>("POST", "/api/demo/inject", { mutation }),
  applyPatch: (id: string) =>
    request<{ run_id?: string; diff?: string; patch?: string }>("POST", `/api/patches/${encodeURIComponent(id)}/apply`),
  snapshot: () => request<Snapshot>("GET", "/api/snapshot"),
  liveRun: (body: RunRequest) => request<Snapshot>("POST", "/api/live", body),
};

const EVENT_TYPES = ["build", "built", "progress", "mismatch", "shrinking", "counterexample", "verdict", "error"];

export function streamRun(
  id: string,
  onEvent: (event: RunEvent) => void,
  onBroken: () => void,
): () => void {
  const source = new EventSource(`/api/runs/${encodeURIComponent(id)}/events`);
  let closed = false;
  const handle = (name: string | null) => (message: MessageEvent) => {
    if (closed) return;
    let data: unknown;
    try {
      data = JSON.parse(message.data);
    } catch {
      return;
    }
    if (!data || typeof data !== "object") return;
    const event = data as RunEvent;
    if (!event.type && name) event.type = name;
    if (!event.type) return;
    onEvent(event);
  };
  source.onmessage = handle(null);
  for (const type of EVENT_TYPES) {
    source.addEventListener(type, handle(type) as EventListener);
  }
  source.onerror = (event: Event) => {
    if (closed) return;
    if (event instanceof MessageEvent && event.data) return;
    closed = true;
    source.close();
    onBroken();
  };
  return () => {
    closed = true;
    source.close();
  };
}

export function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof ApiError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: "CLIENT", message: error.message };
  return { code: "CLIENT", message: String(error) };
}
