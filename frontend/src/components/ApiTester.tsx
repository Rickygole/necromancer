import { useState } from "react";
import { rawRequest, type RawResponse } from "../api";

interface Endpoint {
  key: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

const ENDPOINTS: Endpoint[] = [
  { key: "health", method: "GET", path: "/api/health" },
  { key: "mutations", method: "GET", path: "/api/mutations" },
  { key: "runs", method: "POST", path: "/api/runs", body: { profile: "dev", seed: 731942 } },
  { key: "report", method: "GET", path: "/api/runs/{id}" },
  { key: "cx", method: "GET", path: "/api/runs/{id}/counterexamples" },
  { key: "decisions", method: "GET", path: "/api/decisions" },
  {
    key: "decide",
    method: "POST",
    path: "/api/decisions",
    body: {
      class: "net",
      field: "net",
      counterexample_ids: ["cx_0002"],
      options_considered: ["preserve", "correct"],
      choice: "preserve",
      reviewer: "",
      note: "",
    },
  },
  { key: "approval", method: "POST", path: "/api/runs/{id}/approval", body: { approved: true, reviewer: "", note: "" } },
  { key: "inject", method: "POST", path: "/api/demo/inject", body: { mutation: "M4" } },
  { key: "patch", method: "POST", path: "/api/patches/{id}/apply" },
  { key: "snapshot", method: "GET", path: "/api/snapshot" },
];

export function ApiTester({ runId }: { runId: string | null }) {
  const [key, setKey] = useState(ENDPOINTS[0].key);
  const endpoint = ENDPOINTS.find((e) => e.key === key) ?? ENDPOINTS[0];
  const [param, setParam] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<RawResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsParam = endpoint.path.includes("{id}");
  const defaultParam = endpoint.key === "patch" ? "fix_mutation" : runId ?? "";

  const choose = (next: string) => {
    const found = ENDPOINTS.find((e) => e.key === next) ?? ENDPOINTS[0];
    setKey(found.key);
    setBody(found.body === undefined ? "" : JSON.stringify(found.body, null, 2));
    setParam(found.key === "patch" ? "fix_mutation" : runId ?? "");
    setResponse(null);
    setError(null);
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    let parsed: unknown = undefined;
    if (endpoint.method === "POST" && body.trim()) {
      try {
        parsed = JSON.parse(body);
      } catch (err) {
        setError(`Body is not valid JSON. ${err instanceof Error ? err.message : ""}`);
        return;
      }
    }
    const id = (param || defaultParam).trim();
    if (needsParam && !id) {
      setError("This endpoint needs an id.");
      return;
    }
    setSending(true);
    try {
      setResponse(await rawRequest(endpoint.method, endpoint.path.replace("{id}", encodeURIComponent(id)), parsed));
    } catch (err) {
      setResponse(null);
      setError(`Could not reach the server. ${err instanceof Error ? err.message : ""}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="tester" aria-labelledby="tester-title">
      <details>
        <summary>
          <h2 id="tester-title">API tester</h2>
          <span className="hint">Send a request to any endpoint and read the raw answer</span>
        </summary>
        <form className="tester__form" onSubmit={send}>
          <div className="row">
            <div className="field">
              <label htmlFor="tester-endpoint">Endpoint</label>
              <select id="tester-endpoint" className="input mono" value={key} onChange={(e) => choose(e.target.value)}>
                {ENDPOINTS.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.method} {e.path}
                  </option>
                ))}
              </select>
            </div>
            {needsParam ? (
              <div className="field">
                <label htmlFor="tester-id">id</label>
                <input
                  id="tester-id"
                  className="input mono"
                  value={param}
                  placeholder={defaultParam || "run id"}
                  onChange={(e) => setParam(e.target.value)}
                />
              </div>
            ) : null}
          </div>
          {endpoint.method === "POST" ? (
            <div className="field">
              <label htmlFor="tester-body">JSON body</label>
              <textarea
                id="tester-body"
                className="input mono"
                rows={8}
                spellCheck={false}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          ) : null}
          <div className="button-row">
            <button type="submit" className="button button--primary" disabled={sending}>
              {sending ? "Sending" : "Send"}
            </button>
          </div>
        </form>
        <div aria-live="polite">
          {error ? (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          ) : null}
          {response ? (
            <div className="tester__response">
              <p className="hint">
                <span className={response.ok ? "decided" : "rejected"}>
                  <span aria-hidden="true">{response.ok ? "✓" : "✕"}</span> HTTP {response.status}
                </span>{" "}
                in {response.ms} ms
              </p>
              <pre className="tester__body mono" tabIndex={0} role="region" aria-label="Response body">
                {typeof response.body === "string" ? response.body : JSON.stringify(response.body, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
