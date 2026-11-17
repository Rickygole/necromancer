import { useEffect, useRef } from "react";
import {
  CARDDEMO_COMMIT,
  CARDDEMO_FINDINGS,
  CARDDEMO_OUTPUTS,
  CARDDEMO_PARAGRAPH,
  CARDDEMO_README_URL,
  CARDDEMO_REPORT,
  CARDDEMO_ROUNDED,
  CARDDEMO_SOURCE_URL,
  CARDDEMO_TREE_URL,
  CARDDEMO_TWIN_URL,
  graveLine,
  isSizeError,
  money,
  rate,
  signed,
  slot,
  type Finding,
} from "../carddemo";
import { bringIntoView } from "../scroll";
import { count } from "../status";
import { Crack } from "./Doodles";
import { Reveal } from "./Reveal";
import { TiltCard } from "./TiltCard";

const report = CARDDEMO_REPORT;
const FAMILIES = Object.entries(report.families);

function wantsCaseStudy(): boolean {
  return typeof window !== "undefined" && /\?(.*&)?carddemo(&|=|$)/.test(window.location.hash);
}

function Grave({ finding, n }: { finding: Finding; n: number }) {
  const { cx } = finding;
  const v = cx.input_values;
  const rows = CARDDEMO_OUTPUTS.map((f) => {
    const oracle = slot(cx.oracle_output, f);
    const twin = slot(cx.twin_output, f);
    return { f, oracle, twin, differs: oracle !== twin };
  });
  return (
    <TiltCard className="grave__stone" max={3}>
      <Crack className="grave__crack" />
      <p className="grave__lies mono">here lies finding {n}</p>
      <h3 className="grave__name">{finding.title}</h3>
      <p className="grave__epitaph">{graveLine(cx)}</p>
      <div className="grave__body">
        <dl className="grave__input">
          <div>
            <dt>earlier total</dt>
            <dd className="mono">{money(v.initial_total_cents)}</dd>
          </div>
          <div>
            <dt>balance</dt>
            <dd className="mono">{money(v.balance_cents)}</dd>
          </div>
          <div>
            <dt>annual rate</dt>
            <dd className="mono">{rate(v.annual_rate_hundredths_of_percent)}</dd>
          </div>
        </dl>
        <table className="grave__out">
          <caption>
            smallest input found, <span className="mono">{cx.id}</span>
          </caption>
          <thead>
            <tr>
              <th scope="col">field</th>
              <th scope="col">program</th>
              <th scope="col">rewrite</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.f.key} className={r.differs ? "is-diff" : undefined}>
                <th scope="row">
                  {r.f.label}
                  {r.differs ? <span className="grave__mark"> differs</span> : null}
                </th>
                <td className="mono">{signed(r.oracle)}</td>
                <td className="mono">{isSizeError(r.twin) ? "size error" : signed(r.twin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="grave__cause">
          <strong className="mono">{finding.clause}.</strong> {finding.cause}
        </p>
        {finding.probe.length ? (
          <pre className="crt crt--code grave__probe" role="region" aria-label={`Compiler probe output for finding ${n}`}>
            <code>{finding.probe.join("\n")}</code>
          </pre>
        ) : null}
        {finding.key === "truncation" ? (
          <p className="grave__check">
            Check on the cause: rebuilt with ROUNDED added to that one COMPUTE, {count(CARDDEMO_ROUNDED.mismatches_with_rounded_added)}{" "}
            of {count(CARDDEMO_ROUNDED.cases)} cases still differ, all of them overflow cases. {count(CARDDEMO_ROUNDED.of_which_without_size_error)}{" "}
            remain that are not.
          </p>
        ) : null}
        <p className="grave__scope">{finding.scope}</p>
      </div>
      <p className="grave__count mono">
        {count(finding.cases)} of {count(report.cases)} cases have this cause
      </p>
    </TiltCard>
  );
}

export function CaseStudy() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!wantsCaseStudy()) return;
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        bringIntoView(document.getElementById("carddemo"));
        titleRef.current?.focus({ preventScroll: true });
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, []);

  return (
    <section id="carddemo" className="carddemo" aria-labelledby="carddemo-title">
      <Reveal className="carddemo__intro">
        <p className="eyebrow mono">second case study, code we did not write</p>
        <h2 id="carddemo-title" className="section-title" tabIndex={-1} ref={titleRef}>
          a program we did not write
        </h2>
        <p>
          Everything above is UICALC, which we wrote. This is one paragraph from AWS CardDemo, a public sample mainframe
          application: <span className="mono">1300-COMPUTE-INTEREST</span> in{" "}
          <a href={CARDDEMO_SOURCE_URL}>CBACT04C.cbl</a>, which works out one month of interest on one transaction
          category balance. It is vendored unmodified under Apache-2.0 from{" "}
          <a href={CARDDEMO_TREE_URL}>
            commit <span className="mono">{CARDDEMO_COMMIT.slice(0, 7)}</span>
          </a>
          .
        </p>
        <p>
          The twin is a Python reading of what the paragraph says it does, written and{" "}
          <a href={CARDDEMO_TWIN_URL}>committed before the run</a> against the compiled COBOL. It is evidence over the
          cases counted here. It is not a proof, and it says nothing about the rest of CardDemo.
        </p>
      </Reveal>

      <div className="carddemo__grid">
        <Reveal className="carddemo__code">
          <pre className="crt crt--code" tabIndex={0} role="region" aria-label="The CardDemo paragraph, verbatim">
            <code>{CARDDEMO_PARAGRAPH}</code>
          </pre>
          <p className="carddemo__caption">
            Verbatim from CBACT04C.cbl, margins trimmed. The balance and both results are{" "}
            <span className="mono">PIC S9(09)V99</span>, the rate is <span className="mono">S9(04)V99</span>. No{" "}
            <span className="mono">ROUNDED</span>, no{" "}
            <span className="mono">ON SIZE ERROR</span>.
          </p>
        </Reveal>
        <Reveal className="carddemo__run paper" depth="far">
          <h3>how it was run</h3>
          <p className="carddemo__tally num">
            <span className="carddemo__big">{count(report.cases)}</span> cases
          </p>
          <dl className="carddemo__meta">
            <div>
              <dt>matched</dt>
              <dd className="num">{count(report.matched)}</dd>
            </div>
            <div>
              <dt>mismatched</dt>
              <dd className="num">{count(report.mismatched)}</dd>
            </div>
            <div>
              <dt>unexplained</dt>
              <dd className="num">{count(report.unexplained)}</dd>
            </div>
            <div>
              <dt>seed</dt>
              <dd className="mono">{report.seed}</dd>
            </div>
            <div className="carddemo__wide">
              <dt>compiler</dt>
              <dd className="mono">{report.compiler}</dd>
            </div>
          </dl>
          <table className="carddemo__families">
            <caption className="visually-hidden">Cases and mismatches per family</caption>
            <thead>
              <tr>
                <th scope="col">family</th>
                <th scope="col">cases</th>
                <th scope="col">mismatched</th>
              </tr>
            </thead>
            <tbody>
              {FAMILIES.map(([name, f]) => (
                <tr key={name}>
                  <th scope="row" className="mono">
                    {name}
                  </th>
                  <td className="num">{count(f.cases)}</td>
                  <td className="num">{count(f.mismatches)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="carddemo__note">
            The paragraph runs inside a small wrapper that loads the three fields, performs it, and prints both results.
            The random cases deliberately reach huge values, so the counts say how often this generator reached them,
            not how often a real bank would.
          </p>
        </Reveal>
      </div>

      <ol className="graves">
        {CARDDEMO_FINDINGS.map((finding, i) => (
          <Reveal as="li" key={finding.key} className={`grave grave--${i + 1}`} depth={i === 1 ? "near" : "far"}>
            <Grave finding={finding} n={i + 1} />
          </Reveal>
        ))}
      </ol>
      <p className="carddemo__aside">A case can have more than one cause, so the three counts overlap.</p>

      <Reveal className="carddemo__limits">
        <h3>what this does not say</h3>
        <ul>
          <li>
            The source documents no rounding rule. The twin rounds half up by assumption, so finding 1 is a defect only if
            rounding was intended.
          </li>
          <li>
            The overflow counts are partly by construction. The twin has no number for a result that does not fit, so
            every overflowing case is a mismatch, and the generator reaches those values on purpose.
          </li>
          <li>
            Only the paragraph ran, through a small wrapper. The file reads, account breaks and the transaction write of
            the full program were not exercised.
          </li>
          <li>
            One compiler, <span className="mono">{report.compiler}</span>. Findings 2 and 3 are about how it behaves
            when no size error clause is given. Other compilers were not measured.
          </li>
        </ul>
        <p>
          Counts, minimal inputs, probes and the full reasoning are in the{" "}
          <a href={CARDDEMO_README_URL}>case study README</a>.
        </p>
      </Reveal>
    </section>
  );
}
