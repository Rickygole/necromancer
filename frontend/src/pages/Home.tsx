import { CoffeeRing, PencilLine, Stitches, Tally } from "../components/Doodles";
import { Reveal } from "../components/Reveal";
import { Scene } from "../components/Scene";
import { Stamp } from "../components/Stamp";
import { TiltCard } from "../components/TiltCard";
import { DEMO_CASES, DEMO_SEED, MUTATION_CASES } from "../content";
import { count } from "../status";

const STEPS = [
  {
    n: "1",
    title: "raise the oracle",
    text: "Compile UICALC.cbl with GnuCOBOL 3.1.2 and treat whatever it prints as the truth. Not the spec. Not the comments. The bytes.",
    margin: "it is always right, even when it is wrong",
  },
  {
    n: "2",
    title: "feed both the same bytes",
    text: "Golden, boundary, invalid and property based claims go into the COBOL program and the Python twin as identical 80 byte records. Every field of the 40 byte answer is compared exactly. No rounding, no tolerance, no squinting.",
    margin: `${count(DEMO_CASES)} claims on the demo profile`,
  },
  {
    n: "3",
    title: "argue about it",
    text: "Each disagreement is shrunk to the smallest claimant that still breaks, then a person decides: keep the legacy behavior or fix it. Then a reviewer signs off on the whole thing, or does not.",
    margin: "nothing ships by itself",
  },
];

export function Home() {
  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <Scene />
        <div className="hero__copy">
          <p className="hero__case mono">
            <span>case file {DEMO_SEED}</span>
            <span>kiroween 2026, resurrection</span>
          </p>
          <h1 id="hero-title" className="wordmark" tabIndex={-1} data-text="necromancer">
            necromancer
          </h1>
          <p className="hero__sub mono">verification for legacy COBOL</p>
          <p className="hero__pitch">
            The legacy program says one thing. The rewrite says another. <em>Nobody knew.</em>
          </p>
          <p className="hero__body">
            We wrote a small benefit calculator in COBOL, rewrote it in Python from the rules alone, and then made the
            two of them answer the same questions thousands of times. They mostly agreed. Where they did not, the COBOL
            was doing something the rules never mention. We planted those quirks on purpose, then made the harness find
            them the hard way.
          </p>
          <div className="hero__actions">
            <a className="slab-button" href="#/console">
              open the console
            </a>
            <a className="pencil-link" href="#/evidence">
              or read the evidence first
              <PencilLine className="pencil-link__line" />
            </a>
          </div>
        </div>
      </section>

      <div className="bleed" aria-hidden="true">
        <p className="bleed__text">
          <span>NOBODY</span> <span>KNEW.</span>
        </p>
      </div>

      <section className="tags" aria-labelledby="tags-title">
        <Reveal className="tags__intro">
          <h2 id="tags-title">the numbers, with their denominators</h2>
          <p>
            A number without a denominator is a rumor. These come from one recorded run and one mutation sweep, seed{" "}
            {DEMO_SEED}. They are evidence over the cases counted, not a proof of anything.
          </p>
        </Reveal>
        <ol className="tags__row">
          <Reveal as="li" className="tag-slot tag-slot--one" depth="far">
            <TiltCard className="toe-tag">
              <span className="toe-tag__hole" aria-hidden="true" />
              <span className="toe-tag__label mono">specimen A, demo profile</span>
              <span className="toe-tag__num">
                <span className="toe-tag__big">{count(DEMO_CASES)}</span>
                <span className="toe-tag__of">of {count(DEMO_CASES)}</span>
              </span>
              <span className="toe-tag__what">cases matched, twin as written</span>
              <span className="toe-tag__foot mono">0 mismatched</span>
            </TiltCard>
          </Reveal>
          <Reveal as="li" className="tag-slot tag-slot--two" depth="far">
            <TiltCard className="toe-tag toe-tag--bone">
              <span className="toe-tag__hole" aria-hidden="true" />
              <span className="toe-tag__label mono">specimen B, mutations</span>
              <span className="toe-tag__num">
                <span className="toe-tag__big">5</span>
                <span className="toe-tag__of">of 5</span>
              </span>
              <Tally count={5} className="toe-tag__tally" />
              <span className="toe-tag__what">planted bugs caught</span>
              <span className="toe-tag__foot mono">each over {count(MUTATION_CASES)} cases</span>
            </TiltCard>
          </Reveal>
          <Reveal as="li" className="tag-slot tag-slot--three" depth="far">
            <TiltCard className="toe-tag">
              <span className="toe-tag__hole" aria-hidden="true" />
              <span className="toe-tag__label mono">specimen C, the oracle</span>
              <span className="toe-tag__num">
                <span className="toe-tag__big">3</span>
              </span>
              <span className="toe-tag__what">classes of legacy behavior found by the oracle</span>
              <span className="toe-tag__foot mono">3 of 3 have a decision record</span>
            </TiltCard>
          </Reveal>
        </ol>
      </section>

      <section className="chart" aria-labelledby="how-title">
        <Reveal className="chart__sheet paper paper--torn">
          <CoffeeRing className="chart__coffee" />
          <header className="chart__head">
            <h2 id="how-title">how it works</h2>
            <p className="chart__meta mono">procedure, three steps, no anesthetic</p>
          </header>
          <ol className="chart__steps">
            {STEPS.map((step) => (
              <li key={step.n} className="chart__step">
                <span className="chart__n" aria-hidden="true">
                  {step.n}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
                <p className="chart__margin">{step.margin}</p>
              </li>
            ))}
          </ol>
          <Stitches className="chart__stitch" />
          <Stamp tone="red" tilt={-8} className="chart__stamp">
            synthetic data
          </Stamp>
        </Reveal>
        <Reveal className="chart__side" depth="far">
          <p className="chart__side-kicker mono">exhibit</p>
          <p className="chart__side-quote">
            A high quarter of 26,000.00 should pay the 650.00 cap. The COBOL pays 0.00, because the field it divides
            into only holds three digits.
          </p>
          <a className="pencil-link" href="#/legacy">
            see the other two quirks
            <PencilLine className="pencil-link__line" />
          </a>
        </Reveal>
      </section>

      <section className="exits" aria-labelledby="exits-title">
        <h2 id="exits-title" className="visually-hidden">
          where to go next
        </h2>
        <Reveal className="exit exit--console">
          <a href="#/console">
            <span className="exit__kicker mono">bench</span>
            <span className="exit__title">the console</span>
            <span className="exit__text">Run the comparison, inject a bug, watch the candle change color.</span>
          </a>
        </Reveal>
        <Reveal className="exit exit--evidence" depth="far">
          <a href="#/evidence">
            <span className="exit__kicker mono">chart</span>
            <span className="exit__title">the evidence</span>
            <span className="exit__text">The recorded story, one counterexample, the mutation score and its limits.</span>
          </a>
        </Reveal>
        <Reveal className="exit exit--build">
          <a href="#/build">
            <span className="exit__kicker mono">autopsy</span>
            <span className="exit__title">how it was built</span>
          </a>
        </Reveal>
      </section>
    </div>
  );
}
