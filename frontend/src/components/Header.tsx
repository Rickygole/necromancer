import { NAV, type Route } from "../router";
import { MotionToggle } from "./MotionToggle";

export function Header({ route }: { route: Route }) {
  return (
    <header className="site-head">
      <a className="logo" href="#/" aria-label="Necromancer, home">
        <span className="logo__candle" data-candle aria-hidden="true">
          <span className="logo__flame" />
          <span className="logo__wax" />
        </span>
        <span className="logo__word">necromancer</span>
      </a>
      <nav className="site-nav" aria-label="Main">
        <ol>
          {NAV.map((item, i) => (
            <li key={item.route}>
              <a href={item.href} aria-current={route === item.route ? "page" : undefined}>
                <span className="site-nav__num" aria-hidden="true">
                  {String(i).padStart(2, "0")}
                </span>
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <MotionToggle />
    </header>
  );
}
