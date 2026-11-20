import { PencilLine, Stitches, WaxSeal } from "../components/Doodles";
import { Reveal } from "../components/Reveal";
import { Stamp } from "../components/Stamp";
import { MUTATIONS, PROPERTIES, REPO_TREE, REPO_URL, STAGED } from "../content";

export function Build() {
  return (
    <article className="page build">
      <header className="page-head page-head--build">
        <p className="eyebrow mono">autopsy notes</p>
        <h1 tabIndex={-1}>how it was built</h1>
        <p className="page-head__lede">
          The short version: a COBOL program, a Python copy, a harness that makes them argue, and a rule that a person
          settles every argument. The long version is the repository.
        </p>
        <a className="slab-button slab-button--small" href={REPO_URL} rel="noreferrer">
          github.com/Rickygole/necromancer
        </a>
      </header>

      <section className="build__tree" aria-labelledby="tree-title">
        <Reveal className="build__tree-intro">
          <h2 id="tree-title" className="section-title">
            where things live
          </h2>
          <p>Every folder has one job. The decision records in decisions/ are where a reviewer's choice is written down.</p>
        </Reveal>
        <Reveal className="crt crt--tree" depth="far">
          <p className="crt__prompt" aria-hidden="true">
            $ ls necromancer
          </p>
          <dl className="tree">
            {REPO_TREE.map((row) => (
              <div key={row.path}>
                <dt>{row.path}</dt>
                <dd>{row.text}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      <section className="protocol" aria-labelledby="protocol-title">
        <Reveal className="protocol__sheet paper paper--torn">
          <h2 id="protocol-title" className="section-title">
            the blind twin protocol
          </h2>
          <p>
            The twin was written from the rules table only, and committed before the first oracle run. So there is a
            record of what it looked like before anything had a chance to tell it it was wrong.
          </p>
          <p>
            That matters because the interesting findings are the places where an honest reading of the rules gives a
            different answer from the program. Peek at the COBOL first and you copy the bugs without noticing them.
          </p>
          <Stamp tone="ink" tilt={5} className="protocol__stamp">
            committed first
          </Stamp>
        </Reveal>
      </section>

      <section className="build__mutations" aria-labelledby="mutations-title">
        <Reveal>
          <h2 id="mutations-title" className="section-title">
            five planted bugs
          </h2>
          <p className="build__lede">
            A test suite that never fails proves nothing about the test suite. So we break the twin on purpose, five
            named ways, and check that the harness catches each one.
          </p>
        </Reveal>
        <ol className="mutation-tags">
          {MUTATIONS.map((m, i) => (
            <Reveal as="li" key={m.id} className={`mutation-tag mutation-tag--${i + 1}`} depth={i % 2 ? "far" : "near"}>
              <span className="mutation-tag__id mono">{m.id}</span>
              <span className="mutation-tag__label">{m.label}</span>
              <span className="mutation-tag__desc">{m.description}</span>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="properties" aria-labelledby="props-title">
        <Reveal className="properties__intro">
          <h2 id="props-title" className="section-title">
            correctness properties
          </h2>
          <p>
            Eleven things that must stay true, checked by the test suite. P1 is the whole point. The rest keep it
            honest.
          </p>
        </Reveal>
        <Reveal className="properties__sheet paper" depth="far">
          <ol className="properties__list">
            {PROPERTIES.map((p) => (
              <li key={p.id}>
                <span className="properties__id mono">{p.id}</span>
                <span>
                  <strong>{p.name}.</strong> {p.text}
                </span>
              </li>
            ))}
          </ol>
          <Stitches className="properties__stitch" />
        </Reveal>
      </section>

      <section className="gates" aria-labelledby="gates-title">
        <Reveal>
          <h2 id="gates-title" className="section-title">
            where a person has to say yes
          </h2>
        </Reveal>
        <div className="gates__grid">
          <Reveal className="gate">
            <h3>every class of difference</h3>
            <p>
              Mismatches are grouped by the fields and trace bits that differ. Each class needs a written decision,
              preserve the legacy behavior or correct it, with a reviewer name and a note. The local backend writes a
              decision file when a reviewer records one in the console; the hosted build cannot write there at all, and
              the Kiro agents are told not to write there.
            </p>
          </Reveal>
          <Reveal className="gate gate--offset" depth="far">
            <h3>the final candidate</h3>
            <p>
              A run with every class decided still ends in APPROVAL REQUIRED. A reviewer approves or rejects it, and a
              rejection needs a reason. Nothing is deployed automatically.
            </p>
          </Reveal>
          <Reveal className="gate gate--seal">
            <WaxSeal text="3 of 3" className="gate__seal" />
            <p>
              Three decision records exist today. All three are preserve choices the reviewer delegated during the build,
              not yet confirmed. Until someone confirms or overturns them, the twin reproduces the legacy behavior.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="staged" aria-labelledby="staged-title">
        <Reveal className="staged__sheet paper">
          <h2 id="staged-title" className="section-title">
            what is staged
          </h2>
          <p className="staged__intro">Things a careful reader should know before trusting any of the above.</p>
          <ul className="staged__list">
            {STAGED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Stamp tone="red" tilt={-7} className="staged__stamp">
            disclosed
          </Stamp>
        </Reveal>
      </section>

      <section className="kiro" aria-labelledby="kiro-title">
        <Reveal className="kiro__card">
          <h2 id="kiro-title" className="section-title">
            Kiro
          </h2>
          <p>
            Most of this repository was built before Kiro was used on it, with other coding agents. The steering, agents,
            hooks and first three specs in .kiro were written as plain files, not through the Kiro spec
            workflow. KIRO.md records what was then run in Kiro and what was not. This is a summary of it.
          </p>
          <h3 className="kiro__subhead">what ran in Kiro</h3>
          <ul className="kiro__list">
            <li>
              The oracle MCP tools were called on counterexample <span className="mono">cx_0002</span> from both the Kiro
              CLI and the Kiro IDE. In the CLI, <span className="mono">run_oracle</span> returned the recorded oracle
              output. In the IDE, <span className="mono">parse_record</span> decoded the record, through a server entry in
              the owner's user settings; the workspace entry in .kiro/settings/mcp.json was not available to the IDE
              chat, and the cause was not confirmed.
            </li>
            <li>
              Both hooks fired in the IDE. <span className="mono">Re-derive properties</span> reported that the
              twin's design.md listed only 4 properties, P5, P8, P9 and P10, while the tests implement P1 to P11. Kiro then rewrote that section
              to list P1 to P11, which was checked against the test code before it was committed.{" "}
              <span className="mono">Test guard</span> undid a blank line saved into oracle/__init__.py, saying the edit had
              not been requested.
            </li>
            <li>
              The <span className="mono">evidence-report</span> spec went through the IDE spec workflow, one task at a
              time, and produced <span className="mono">python -m harness.report</span> and its tests. The first version
              had two failing tests and did not say the snapshot was the run with M4 injected. After that review was
              pasted into the chat, Kiro fixed both and added three tests.
            </li>
            <li>
              The <span className="mono">failure-analyst</span> agent ran through the Kiro CLI and wrote three class files
              to evidence/classes. They are its raw output. The fields it quotes from{" "}
              <span className="mono">cx_0002</span> were checked by hand.
            </li>
          </ul>
          <h3 className="kiro__subhead">limits</h3>
          <ul className="kiro__list">
            <li>
              Kiro's shell did not work inside the IDE, so Kiro could not run its own tests. They were run outside
              Kiro.
            </li>
            <li>
              Workspace steering was not shown to load. Asked directly, Kiro said no steering was in its context, also
              after a window reload, so no claim is made that steering changed any answer.
            </li>
            <li>Kiro powers and Kiro on the web were not tried.</li>
            <li>
              Custom agents run from the CLI could not use the shell in non-interactive mode, and one reported that no
              MCP tools were registered.
            </li>
          </ul>
          <div className="kiro__links">
            <a className="pencil-link" href={`${REPO_URL}/blob/main/KIRO.md`} rel="noreferrer">
              read KIRO.md
              <PencilLine className="pencil-link__line" />
            </a>
            <a className="pencil-link" href={`${REPO_URL}/tree/main/.kiro`} rel="noreferrer">
              read the .kiro directory
              <PencilLine className="pencil-link__line" />
            </a>
          </div>
        </Reveal>
      </section>
    </article>
  );
}
