import { useEffect, useRef, useState } from "react";
import { api, describeError } from "../api";
import { Blot, CoffeeRing, Stitches, Tally, WaxSeal } from "../components/Doodles";
import { OutputDiff, RecordFields } from "../components/RecordFields";
import { Reveal } from "../components/Reveal";
import { Stamp } from "../components/Stamp";
import { StatusBadge } from "../components/StatusBadge";
import { TiltCard } from "../components/TiltCard";
import { TraceTable } from "../components/TraceTable";
import { DEMO_SEED, HIDDEN_MUTANTS, MUTATIONS, useMutationScore } from "../content";
import { INPUT_FIELDS, OUTPUT_FIELDS, formatValue } from "../records";
import { count, toStatus } from "../status";
import type { Counterexample, Decision, Snapshot, StoryRun } from "../types";

const SLOW_AFTER_MS = 6000;

type Load = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; snapshot: Snapshot };

const STORY: { key: "baseline" | "injected" | "after_patch"; title: string; kicker: string; blurb: string }[] = [
  {
    key: "baseline",
    title: "baseline",
    kicker: "sheet 1",
    blurb: "The twin with the three preserved legacy behaviors, against the compiled COBOL. Every case agreed.",
  },
  {
    key: "injected",
    title: "mutation injected",
    kicker: "sheet 2",
    blurb: "A planted bug, on purpose, to check the harness notices. It noticed.",
  },
  {
    key: "after_patch",
    title: "after the patch",
    kicker: "sheet 3",
    blurb: "The recorded fix removes the planted bug, then a bigger rerun waits for a reviewer.",
  },
];

function storyRun(snapshot: Snapshot, key: "baseline" | "injected" | "after_patch"): StoryRun | null {
  const run = snapshot.runs?.[key];
  if (run) return run;
  return snapshot.story?.[key] ?? null;
}

function shrunk(snapshot: Snapshot): Counterexample | null {
  return snapshot.runs?.injected?.counterexamples?.[0] ?? snapshot.counterexamples?.[0] ?? null;
}

export function Evidence() {
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const score = useMutationScore();
  const cases = score.cases;
  const baseline = score.baseline_mismatches;
  const named = MUTATIONS.map((m) => ({ ...m, caught: score.named[m.id] ?? m.caught }));
  const hidden = HIDDEN_MUTANTS.map((h) => ({ ...h, caught: score.hidden[h.id] ?? h.caught }));

  useEffect(() => {
    let live = true;
    setLoad({ phase: "loading" });
    setSlow(false);
    const timer = window.setTimeout(() => live && setSlow(true), SLOW_AFTER_MS);
    api
      .snapshot()
      .then((snapshot) => live && setLoad({ phase: "ready", snapshot }))
      .catch((err) => live && setLoad({ phase: "error", message: describeError(err).message }))
      .finally(() => window.clearTimeout(timer));
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [attempt]);

  useEffect(() => {
    let live = true;
    api
      .decisions()
      .then((list) => live && setDecisions(list))
      .catch(() => live && setDecisions([]));
    return () => {
      live = false;
    };
  }, []);

  const retry = () => {
    setAttempt((n) => n + 1);
    statusRef.current?.focus();
  };

  const snapshot = load.phase === "ready" ? load.snapshot : null;
  const cx = snapshot ? shrunk(snapshot) : null;
  const maxCaught = Math.max(1, ...named.map((m) => m.caught), ...hidden.map((h) => h.caught));

  return (
    <article className="page evidence">
      <header className="page-head page-head--evidence">
        <p className="eyebrow mono">patient chart, recorded</p>
        <h1 tabIndex={-1}>the evidence</h1>
        <p className="page-head__lede">
          One recorded story, read off the snapshot the server keeps. Every count has its denominator, and none of it is
          a proof. It is what happened on the cases we counted, with seed{" "}
          <span className="mono">{snapshot?.seed ?? DEMO_SEED}</span>.
        </p>
        <Blot className="page-head__blot" />
      </header>

      <section className="evidence__story" aria-labelledby="story-title" aria-busy={load.phase === "loading"}>
        <h2 id="story-title" className="section-title">
          the recorded story
        </h2>
        <div className="evidence__status" ref={statusRef} tabIndex={-1} role="status" aria-live="polite">
          {load.phase === "loading" ? (
            <div className="evidence__loading">
              <span className="evidence__spinner" aria-hidden="true" />
              <p>
                {slow
                  ? "Still fetching the recorded snapshot. The server is slow to answer; it may be waking up."
                  : "Fetching the recorded snapshot from the server."}
              </p>
              {slow ? (
                <button type="button" className="button button--small" onClick={retry}>
                  Try again
                </button>
              ) : null}
            </div>
          ) : load.phase === "ready" ? (
            <p className="visually-hidden">Recorded snapshot loaded.</p>
          ) : null}
        </div>
        {load.phase === "error" ? (
          <div className="notice notice--error evidence__error" role="alert">
            <p>
              The snapshot at <span className="mono">/api/snapshot</span> could not be loaded. {load.message} The story
              needs the server. The mutation score further down is part of the page and still reads fine.
            </p>
            <button type="button" className="button button--small" onClick={retry}>
              Try again
            </button>
          </div>
        ) : null}
        <ol className="sheets">
          {STORY.map((item, i) => {
            const run = snapshot ? storyRun(snapshot, item.key) : null;
            const status = run ? toStatus(run.verdict) : "NOT RUN";
            const mismatched = run ? run.mismatched ?? Math.max(0, run.cases - run.matched) : 0;
            return (
              <Reveal as="li" key={item.key} className={`sheet-slot sheet-slot--${i + 1}`} depth={i === 1 ? "near" : "far"}>
                <TiltCard className={`sheet paper${i === 1 ? " sheet--feature" : ""}`} max={4}>
                  <p className="sheet__kicker mono">{item.kicker}</p>
                  <h3 className="sheet__title">{item.title}</h3>
                  {load.phase === "loading" ? (
                    <div className="sheet__skeleton">
                      <span aria-hidden="true" />
                      <span aria-hidden="true" />
                      <p className="sheet__skeleton-text">Loading this sheet</p>
                    </div>
                  ) : run ? (
                    <>
                      <p className="sheet__badge">
                        <StatusBadge status={status} />
                        <span className="tag tag--ink">Recorded</span>
                      </p>
                      <p className="sheet__count num">
                        <span className="sheet__big">{count(run.matched)}</span>
                        <span className="sheet__of">of {count(run.cases)}</span>
                      </p>
                      <p className="sheet__unit">cases matched</p>
                      <dl className="sheet__meta">
                        <div>
                          <dt>mismatched</dt>
                          <dd className="num">
                            {count(mismatched)} of {count(run.cases)}
                          </dd>
                        </div>
                        <div>
                          <dt>profile</dt>
                          <dd className="mono">{run.profile ?? snapshot?.profile}</dd>
                        </div>
                        <div>
                          <dt>mutation</dt>
                          <dd className="mono">
                            {run.mutation ? `${run.mutation}, ${snapshot?.mutation_label ?? "injected"}` : "none"}
                          </dd>
                        </div>
                        <div>
                          <dt>run</dt>
                          <dd className="mono sheet__run">{run.run_id}</dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <p className="sheet__missing">Not in this snapshot.</p>
                  )}
                  <p className="sheet__blurb">{item.blurb}</p>
                  {i === 1 && run ? (
                    <Stamp tone="red" tilt={-11} className="sheet__stamp">
                      verdict
                    </Stamp>
                  ) : null}
                </TiltCard>
              </Reveal>
            );
          })}
        </ol>
        <p className="evidence__aside">
          Sheet 2 is a demonstration. Mutation M4 clamps a negative net payout to zero, which is what rule R8 asks for
          and exactly what the legacy program does not do. So the twin, which copies the legacy behavior, disagrees with
          it the moment the clamp goes in.
        </p>
      </section>

      <section className="specimen" aria-labelledby="specimen-title">
        <Reveal className="specimen__sheet paper">
          <Stitches className="specimen__stitch" />
          <header className="specimen__head">
            <p className="sheet__kicker mono">specimen</p>
            <h2 id="specimen-title" className="section-title">
              the shrunk counterexample
            </h2>
            {cx ? (
              <p className="specimen__ids">
                <span className="mono chip">{cx.id}</span> class <span className="mono chip">{cx.class}</span>
                {cx.family ? (
                  <>
                    {" "}
                    family <span className="mono chip">{cx.family}</span>
                  </>
                ) : null}{" "}
                seed <span className="mono">{cx.seed}</span>
              </p>
            ) : null}
          </header>
          {load.phase === "loading" ? (
            <div className="specimen__skeleton">
              <p className="sheet__skeleton-text">Loading the counterexample</p>
            </div>
          ) : cx ? (
            <>
              {cx.mutation ? (
                <p className="tag tag--danger">injected mutation {cx.mutation}, not a legacy finding</p>
              ) : null}
              <p className="specimen__lede">
                The harness found a disagreement and kept shaving the claimant down until nothing more could go without
                the disagreement going too. This is what was left. Ids starting with mx_ come from injected mutations,
                ids starting with cx_ are legacy findings.
              </p>
              <p className="record mono specimen__raw" role="group" aria-label="Raw 80 byte input record">
                {cx.input_record.replace(/ /g, "·")}
              </p>
              <div className="specimen__grid">
                <RecordFields record={cx.input_record} fields={INPUT_FIELDS} caption="Input record, field by field" hideFiller />
                <div className="specimen__right">
                  <OutputDiff oracle={cx.oracle_output} twin={cx.twin_output} fields={OUTPUT_FIELDS} />
                  <div className="specimen__diff">
                    <h3>field diff</h3>
                    <ul>
                      {cx.diff.map((d) => {
                        const kind = d.field === "trace" ? "trace" : "money";
                        return (
                          <li key={d.field}>
                            <span className="mono">{d.field}</span>: oracle{" "}
                            <strong className="mono">{formatValue(d.oracle, kind)}</strong>, twin{" "}
                            <strong className="mono">{formatValue(d.twin, kind)}</strong>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <TraceTable oracle={cx.trace_diff.oracle} twin={cx.trace_diff.twin} caption="Rule trace bits" mismatch />
                </div>
              </div>
            </>
          ) : (
            <p className="empty">
              {load.phase === "error" ? "No snapshot, so no specimen." : "This snapshot has no counterexample."}
            </p>
          )}
        </Reveal>
      </section>

      <section className="ledger" aria-labelledby="score-title">
        <Reveal className="ledger__head">
          <h2 id="score-title" className="section-title">
            mutation score
          </h2>
          <p>
            Five bugs planted on purpose, one at a time, each run against the same {count(cases)} cases. A mutation
            counts as caught when at least one case disagrees. The unmutated twin disagreed on{" "}
            {baseline === 0 ? "none" : count(baseline)} of them.
          </p>
          <WaxSeal text={`${score.named_caught} of ${score.named_total}`} className="ledger__seal" />
        </Reveal>
        <Reveal className="ledger__wrap">
          <table className="ledger__table">
            <caption className="visually-hidden">
              Mismatches caught per mutation, out of {count(cases)} cases each
            </caption>
            <thead>
              <tr>
                <th scope="col">id</th>
                <th scope="col">what it breaks</th>
                <th scope="col">mismatches caught</th>
                <th scope="col">result</th>
              </tr>
            </thead>
            <tbody>
              <tr className="ledger__baseline">
                <th scope="row" className="mono">
                  none
                </th>
                <td>The twin with the three preserved legacy behaviors.</td>
                <td className="num">
                  {count(baseline)} of {count(cases)}
                </td>
                <td>
                  <span className="ledger__result ledger__result--clean">
                    <span aria-hidden="true">{"="}</span> clean
                  </span>
                </td>
              </tr>
              {named.map((m) => (
                <tr key={m.id}>
                  <th scope="row" className="mono">
                    {m.id}
                  </th>
                  <td>
                    <strong>{m.label}</strong>
                    <span className="ledger__desc">{m.description}</span>
                  </td>
                  <td className="num">
                    <span className="ledger__count">
                      {count(m.caught)} of {count(cases)}
                    </span>
                    <span className="ledger__bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(2, (m.caught / maxCaught) * 100)}%` }} />
                    </span>
                  </td>
                  <td>
                    {m.caught > 0 ? (
                      <span className="ledger__result">
                        <span aria-hidden="true">{"◆"}</span> caught
                      </span>
                    ) : (
                      <span className="ledger__result ledger__result--clean">
                        <span aria-hidden="true">{"○"}</span> missed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ledger__note">
            M3 is the one to stare at. It only changes anything for a claimant who is exactly 62 with retirement code M.{" "}
            {count(named.find((m) => m.id === "M3")?.caught ?? 0)} of {count(cases)} cases landed there.
          </p>
          <Tally count={5} className="ledger__tally" />
          <div className="hidden-mutants">
            <h3>five hidden mutants, added late</h3>
            <p>
              A review found gaps in the first corpus, so five more mutants went in afterwards. They are listed here
              because leaving them out would make the score above look tidier than the history was.{" "}
              {score.hidden_caught} of {score.hidden_total} hidden mutants caught, over the same {count(cases)} cases.
            </p>
            <table className="ledger__table">
              <caption className="visually-hidden">
                Mismatches caught per hidden mutant, out of {count(cases)} cases each
              </caption>
              <thead>
                <tr>
                  <th scope="col">id</th>
                  <th scope="col">what it breaks</th>
                  <th scope="col">mismatches caught</th>
                  <th scope="col">result</th>
                </tr>
              </thead>
              <tbody>
                {hidden.map((h) => (
                  <tr key={h.id}>
                    <th scope="row" className="mono">
                      {h.id}
                    </th>
                    <td>{h.description}</td>
                    <td className="num">
                      <span className="ledger__count">
                        {count(h.caught)} of {count(cases)}
                      </span>
                      <span className="ledger__bar" aria-hidden="true">
                        <span style={{ width: `${Math.max(2, (h.caught / maxCaught) * 100)}%` }} />
                      </span>
                    </td>
                    <td>
                      {h.caught > 0 ? (
                        <span className="ledger__result">
                          <span aria-hidden="true">{"◆"}</span> caught
                        </span>
                      ) : (
                        <span className="ledger__result ledger__result--clean">
                          <span aria-hidden="true">{"○"}</span> missed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>

      <section className="notes" aria-labelledby="notes-title">
        <Reveal className="notes__sheet paper paper--torn">
          <CoffeeRing className="notes__coffee" />
          <h2 id="notes-title" className="section-title">
            known limitations
          </h2>
          <p className="notes__intro">Copied straight from the snapshot report. They ship with every run.</p>
          {snapshot?.limitations?.length ? (
            <ol className="notes__list">
              {snapshot.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : (
            <p className="empty">
              {load.phase === "loading"
                ? "Fetching the report."
                : load.phase === "error"
                  ? "The limitations live in the snapshot, which did not load."
                  : "This report lists no limitations, which is itself suspicious."}
            </p>
          )}
          {snapshot ? (
            <dl className="notes__meta">
              <div>
                <dt>compiler</dt>
                <dd className="mono">{snapshot.compiler}</dd>
              </div>
              <div>
                <dt>source hash</dt>
                <dd className="mono">{snapshot.source_hash.slice(0, 16)}</dd>
              </div>
              <div>
                <dt>twin hash</dt>
                <dd className="mono">{snapshot.twin_hash.slice(0, 16)}</dd>
              </div>
            </dl>
          ) : null}
        </Reveal>

        <Reveal className="notes__decisions" depth="far">
          <h2 className="section-title">decision records</h2>
          <p>
            Each class of legacy behavior gets a written decision. A decision covers a counterexample only when the class
            matches exactly.
          </p>
          {decisions === null ? (
            <p className="hint">Fetching decisions.</p>
          ) : decisions.length === 0 ? (
            <p className="hint">The server did not return any decision records.</p>
          ) : (
            <ul className="decision-list">
              {decisions.map((d, i) => (
                <li key={`${d.id ?? d.class}-${i}`}>
                  <p>
                    <span className="mono">{d.id}</span> <span className="mono chip">{d.class}</span>
                  </p>
                  <p className="hint">
                    {d.choice}, field {d.field}, {d.reviewer}
                    {d.date ? `, ${d.date}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </section>
    </article>
  );
}
