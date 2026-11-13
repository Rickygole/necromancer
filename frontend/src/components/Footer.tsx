import { REPO_URL } from "../content";
import { NAV } from "../router";
import { Stitches } from "./Doodles";

export function Footer() {
  return (
    <footer className="site-foot">
      <Stitches className="site-foot__stitch" />
      <div className="site-foot__grid">
        <p className="site-foot__claim">
          Every verdict is evidence over the cases counted, never a proof of equivalence. All data is synthetic.
        </p>
        <nav aria-label="Footer">
          <ul className="site-foot__links">
            {NAV.map((item) => (
              <li key={item.route}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
            <li>
              <a href={REPO_URL} rel="noreferrer">
                source on GitHub
              </a>
            </li>
          </ul>
        </nav>
        <p className="site-foot__aside">
          Made for Kiroween 2026. The oracle speaks a language older than everyone who worked on this, and it still
          wins every argument.
        </p>
        <p className="site-foot__fine mono">MIT licensed. No real claimants were harmed. There were never any real claimants.</p>
      </div>
    </footer>
  );
}
