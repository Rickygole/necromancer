import { useEffect, useState } from "react";
import { describeError, rawRequest } from "../api";
import { Reveal } from "./Reveal";

interface Candidate {
  id: string;
  label: string;
  note: string;
  sha256: string;
  source: string;
}

interface Listing {
  candidates: Candidate[];
}

interface Cx {
  id: string;
  class: string;
  explanation: string;
  cases_in_class: number;
  input: Record<string, string>;
  oracle_output: string;
  candidate_output: string;
}

interface Result {
  candidate: string;
  cases: number;
  matched: number;
  mismatched: number;
  classes: Record<string, number>;
  counterexamples: Cx[];
  compiler?: string | null;
  seed: number;
}

type Load = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; list: Listing };
type Run = { phase: "idle" } | { phase: "running" } | { phase: "error"; message: string } | { phase: "done"; result: Result };

const COBOL = `COMPUTE WS-MONTHLY-INT
 = ( TRAN-CAT-BAL * DIS-INT-RATE) / 1200

ADD WS-MONTHLY-INT  TO WS-TOTAL-INT`;

function errorText(body: unknown, status: number): string {
  const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
  return error?.message ? `${error.message} (${error.code ?? status})` : `The server answered ${status}.`;
}

export function Migration() {
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [picked, setPicked] = useState(0);
  const [run, setRun] = useState<Run>({ phase: "idle" });

  useEffect(() => {
    let live = true;
    rawRequest("GET", "/api/migration")
      .then((raw) => {
        if (!live) return;
        if (!raw.ok) setLoad({ phase: "error", message: errorText(raw.body, raw.status) });
        else setLoad({ phase: "ready", list: raw.body as Listing });
      })
      .catch((err) => live && setLoad({ phase: "error", message: describeError(err).message }));
    return () => {
      live = false;
    };
  }, []);

  const verify = async (id: string) => {
    setRun({ phase: "running" });
    try {
      const raw = await rawRequest("POST", "/api/migration/verify", { candidate: id });
      if (!raw.ok) setRun({ phase: "error", message: errorText(raw.body, raw.status) });
      else setRun({ phase: "done", result: raw.body as Result });
    } catch (err) {
      setRun({ phase: "error", message: describeError(err).message });
    }
  };

  return (
    <section id="migration" className="carddemo migration" aria-labelledby="migration-title">
      <Reveal className="carddemo__intro">
        <p className="eyebrow mono">kiro translates, necromancer checks</p>
        <h2 id="migration-title" className="section-title">
          an AI translation, against the real program
        </h2>
        <p>
          Kiro was given the CardDemo paragraph below and a short task file, and asked to write a Python function for it
          through the spec workflow. Its code is shown as it was written. Press the button and it runs against the
          compiled COBOL on this server, live, with no recorded result in its place.
        </p>
      </Reveal>

      <div className="carddemo__grid">
        <Reveal>
          <h3 className="migration__head">the COBOL, paragraph 1300-COMPUTE-INTEREST</h3>
          <pre className="crt crt--code migration__code" tabIndex={0}>
            {COBOL}
          </pre>
        </Reveal>
        <Reveal depth="far">
          {load.phase === "loading" && <p>Loading the recorded translations.</p>}
          {load.phase === "error" && <p role="alert">Could not load the translations. {load.message}</p>}
          {load.phase === "ready" && (
            <>
              <h3 className="migration__head">{load.list.candidates[picked].label}</h3>
              <pre className="crt crt--code migration__code" tabIndex={0}>
                {load.list.candidates[picked].source}
              </pre>
              <p className="carddemo__caption">{load.list.candidates[picked].note}</p>
            </>
          )}
        </Reveal>
      </div>

      {load.phase === "ready" && (
        <div className="migration__controls">
          {load.list.candidates.length > 1 && (
            <div role="group" aria-label="Choose a translation" className="migration__tabs">
              {load.list.candidates.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className="slab-button slab-button--small"
                  aria-pressed={picked === i}
                  onClick={() => {
                    setPicked(i);
                    setRun({ phase: "idle" });
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="slab-button"
            disabled={run.phase === "running"}
            onClick={() => verify(load.list.candidates[picked].id)}
          >
            {run.phase === "running" ? "comparing against the COBOL…" : "verify against the compiled COBOL"}
          </button>
        </div>
      )}

      <div aria-live="polite" className="migration__result">
        {run.phase === "error" && <p role="alert">The run did not happen. {run.message}</p>}
        {run.phase === "done" && <MigrationResult result={run.result} />}
      </div>
    </section>
  );
}

function MigrationResult({ result }: { result: Result }) {
  const clean = result.mismatched === 0;
  return (
    <div className="paper migration__paper">
      <h3>
        {clean ? "no mismatch found" : "mismatch"}: {result.matched.toLocaleString("en-US")} of{" "}
        {result.cases.toLocaleString("en-US")} cases agree
      </h3>
      <p className="carddemo__caption">
        Live run on this server, seed {result.seed}
        {result.compiler ? `, ${result.compiler}` : ""}. Counts over the cases run, not a proof of equivalence.
      </p>
      {clean ? (
        <p>Every case in this run gave the same answer as the compiled COBOL.</p>
      ) : (
        <>
          <ul className="migration__classes">
            {Object.entries(result.classes).map(([name, count]) => (
              <li key={name}>
                <span className="mono">{name}</span> {count.toLocaleString("en-US")} cases
              </li>
            ))}
          </ul>
          {result.counterexamples.map((cx) => (
            <article key={cx.id} className="migration__cx">
              <h4 className="mono">
                {cx.id}, {cx.class}
              </h4>
              <p>{cx.explanation}</p>
              <dl className="migration__fields">
                <div>
                  <dt>input</dt>
                  <dd className="mono">
                    balance {cx.input.balance}, rate {cx.input.annual_rate_percent}%, running total {cx.input.total_interest}
                  </dd>
                </div>
                <div>
                  <dt>COBOL</dt>
                  <dd className="mono">{cx.oracle_output}</dd>
                </div>
                <div>
                  <dt>translation</dt>
                  <dd className="mono">{cx.candidate_output}</dd>
                </div>
              </dl>
            </article>
          ))}
          <p className="carddemo__caption">
            Where the translation raises, it chose to. Where the COBOL wraps, it never fails. Necromancer cannot say which is
            right. A person decides, and the decision is written down.
          </p>
        </>
      )}
    </div>
  );
}
