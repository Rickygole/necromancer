import { Crack, PencilLine } from "../components/Doodles";
import { Reveal } from "../components/Reveal";
import { Stamp } from "../components/Stamp";
import { TiltCard } from "../components/TiltCard";
import { PICTURES, QUIRKS, RULES } from "../content";
import { INPUT_FIELDS, OUTPUT_FIELDS, TRACE_POSITIONS, type FieldSpec } from "../records";

function Layout({ fields, caption, bytes }: { fields: FieldSpec[]; caption: string; bytes: number }) {
  return (
    <div className="crt">
      <table className="crt__table">
        <caption>
          {caption}
          <span className="crt__bytes">{bytes} bytes</span>
        </caption>
        <thead>
          <tr>
            <th scope="col">field</th>
            <th scope="col">cols</th>
            <th scope="col">width</th>
            <th scope="col">picture</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key}>
              <th scope="row">{f.label}</th>
              <td>{f.start === f.end ? f.start : `${f.start} to ${f.end}`}</td>
              <td>{f.end - f.start + 1}</td>
              <td>{PICTURES[f.key] ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Legacy() {
  return (
    <article className="page legacy">
      <header className="page-head page-head--legacy">
        <p className="eyebrow mono">exhumation report, UICALC.cbl</p>
        <h1 tabIndex={-1}>the legacy program</h1>
        <p className="page-head__lede">
          UICALC works out a weekly unemployment benefit. It reads one 80 byte claim per line, writes one 40 byte answer
          per line, and has never once explained itself. We compile it with GnuCOBOL 3.1.2 and treat it as the oracle.
        </p>
        <div className="synthetic" role="note">
          <Stamp tone="red" tilt={-4}>
            synthetic
          </Stamp>
          <p>
            All data here is synthetic. The program was written for this project and the rules are not any state's law.
            Please do not file for benefits using this page.
          </p>
        </div>
      </header>

      <section className="rules" aria-labelledby="rules-title">
        <Reveal className="rules__intro">
          <h2 id="rules-title" className="section-title">
            the rules, as written
          </h2>
          <p>
            R0 to R8. This table is all the twin was allowed to read. Keep it in mind when the COBOL starts disagreeing
            with it.
          </p>
        </Reveal>
        <Reveal className="rules__sheet paper">
          <table className="rules__table">
            <caption className="visually-hidden">Business rules R0 to R8</caption>
            <thead>
              <tr>
                <th scope="col">rule</th>
                <th scope="col">name</th>
                <th scope="col">what it says</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="mono">
                    {r.id}
                  </th>
                  <td className="rules__name">{r.name}</td>
                  <td>{r.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      <section className="quirks" aria-labelledby="quirks-title">
        <Reveal className="quirks__intro">
          <h2 id="quirks-title" className="section-title">
            three things it does that the rules never mention
          </h2>
          <p>
            Planted on purpose when the program was written, then measured on the real compiler. Each one showed up as a
            class of mismatches between the oracle and the rules based twin and has a decision record: preserve,
            delegated by the reviewer during the build and not yet confirmed. The twin copies each bug on purpose.
          </p>
        </Reveal>
        <ol className="quirks__list">
          {QUIRKS.map((q, i) => (
            <Reveal as="li" key={q.id} className={`quirk quirk--${i + 1}`} depth={i === 1 ? "near" : "far"}>
              <TiltCard className="quirk__card" max={3}>
                <Crack className="quirk__crack" />
                <p className="quirk__num mono" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="quirk__name">{q.name}</h3>
                <p className="quirk__cause">{q.cause}</p>
                <pre className="crt crt--code" tabIndex={0} role="region" aria-label={`COBOL behind ${q.name}`}>
                  <code>{q.code}</code>
                </pre>
                <ol className="quirk__steps">
                  {q.steps.map((s) => (
                    <li key={s} className="mono">
                      {s}
                    </li>
                  ))}
                </ol>
                <dl className="quirk__result">
                  <div>
                    <dt>{q.rulesLabel ?? "the rules say"}</dt>
                    <dd className="mono">{q.rules}</dd>
                  </div>
                  <div className="quirk__legacy">
                    <dt>{q.legacyLabel ?? "the program pays"}</dt>
                    <dd className="mono">
                      {q.legacy}
                      <PencilLine className="quirk__underline" />
                    </dd>
                  </div>
                </dl>
                <p className="quirk__note">{q.note}</p>
                <p className="quirk__decision mono">
                  {q.decision}, field {q.field}, preserve
                </p>
              </TiltCard>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="layouts" aria-labelledby="layouts-title">
        <Reveal className="layouts__intro">
          <h2 id="layouts-title" className="section-title">
            record layouts
          </h2>
          <p>
            Fixed width, no delimiters, amounts with two implied decimals. 0009600 in the base field means 96.00, and you
            are expected to just know that.
          </p>
        </Reveal>
        <div className="layouts__grid">
          <Reveal>
            <Layout fields={INPUT_FIELDS} caption="CLAIM-REC, input" bytes={80} />
          </Reveal>
          <Reveal depth="far" className="layouts__col">
            <Layout fields={OUTPUT_FIELDS} caption="RESULT-REC, output" bytes={40} />
            <div className="crt">
              <table className="crt__table">
                <caption>
                  RS-TRACE, one bit per rule
                  <span className="crt__bytes">10 positions</span>
                </caption>
                <thead>
                  <tr>
                    <th scope="col">bit</th>
                    <th scope="col">meaning</th>
                    <th scope="col">paragraph</th>
                  </tr>
                </thead>
                <tbody>
                  {TRACE_POSITIONS.map((p) => (
                    <tr key={p.pos}>
                      <th scope="row">{p.pos}</th>
                      <td>{p.label}</td>
                      <td>{p.paragraph}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>
    </article>
  );
}
