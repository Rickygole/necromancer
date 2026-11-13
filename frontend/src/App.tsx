import { useEffect, useRef, useState, type MouseEvent } from "react";
import { api, describeError } from "./api";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { useLightsOut } from "./lights";
import { Build } from "./pages/Build";
import { Console } from "./pages/Console";
import { Evidence } from "./pages/Evidence";
import { Home } from "./pages/Home";
import { Legacy } from "./pages/Legacy";
import { NotFound } from "./pages/NotFound";
import { titleOf, useRoute } from "./router";
import { setLiveMode } from "./runner";
import type { Health } from "./types";

export function App() {
  const route = useRoute();
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [consoleMounted, setConsoleMounted] = useState(route === "console");
  const dark = useLightsOut();
  const first = useRef(true);

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setLiveMode(Boolean(h.hosted && h.oracle_available));
        setHealth(h);
      })
      .catch((err) => setHealthError(describeError(err).message));
  }, []);

  useEffect(() => {
    if (route === "console") setConsoleMounted(true);
    document.title = titleOf(route);
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-page="${route}"] h1`)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route]);

  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById("main")?.focus();
  };

  return (
    <>
      <a className="skip" href="#main" onClick={skip}>
        Skip to content
      </a>
      <Header route={route} />
      <main id="main" tabIndex={-1} className={`site-main site-main--${route}`}>
        {route === "home" ? (
          <div data-page="home">
            <Home />
          </div>
        ) : null}
        {consoleMounted ? (
          <div data-page="console" hidden={route !== "console"}>
            <Console health={health} healthError={healthError} />
          </div>
        ) : null}
        {route === "evidence" ? (
          <div data-page="evidence">
            <Evidence />
          </div>
        ) : null}
        {route === "legacy" ? (
          <div data-page="legacy">
            <Legacy />
          </div>
        ) : null}
        {route === "build" ? (
          <div data-page="build">
            <Build />
          </div>
        ) : null}
        {route === "missing" ? (
          <div data-page="missing">
            <NotFound />
          </div>
        ) : null}
      </main>
      <Footer />
      <div className={dark ? "lights-out is-out" : "lights-out"} aria-hidden="true">
        <p>someone blew out the candle</p>
      </div>
      <p className="visually-hidden" role="status">
        {dark ? "The lights went out for a moment." : ""}
      </p>
    </>
  );
}
