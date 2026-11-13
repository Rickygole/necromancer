import { useSyncExternalStore } from "react";

export type Route = "home" | "console" | "evidence" | "legacy" | "build" | "missing";

export interface NavItem {
  route: Exclude<Route, "missing">;
  href: string;
  label: string;
  title: string;
}

export const NAV: NavItem[] = [
  { route: "home", href: "#/", label: "home", title: "Necromancer, verification for legacy COBOL" },
  { route: "console", href: "#/console", label: "console", title: "Console, Necromancer" },
  { route: "evidence", href: "#/evidence", label: "evidence", title: "Evidence, Necromancer" },
  { route: "legacy", href: "#/legacy", label: "legacy", title: "UICALC, the legacy program, Necromancer" },
  { route: "build", href: "#/build", label: "build", title: "How it was built, Necromancer" },
];

const PATHS: Record<string, Route> = {
  "": "home",
  "/": "home",
  "/console": "console",
  "/evidence": "evidence",
  "/legacy": "legacy",
  "/build": "build",
};

export function parseHash(hash: string): Route | null {
  if (hash === "" || hash === "#") return "home";
  if (!hash.startsWith("#/")) return null;
  const path = hash.slice(1).replace(/\/+$/, "") || "/";
  return PATHS[path] ?? "missing";
}

let current: Route = parseHash(typeof window === "undefined" ? "" : window.location.hash) ?? "home";

function subscribe(notify: () => void) {
  const onChange = () => {
    const next = parseHash(window.location.hash);
    if (next !== null && next !== current) {
      current = next;
      notify();
    }
  };
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "home",
  );
}

export function titleOf(route: Route): string {
  if (route === "missing") return "Nothing buried here, Necromancer";
  return NAV.find((item) => item.route === route)?.title ?? NAV[0].title;
}
