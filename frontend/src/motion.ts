import { useSyncExternalStore } from "react";

const KEY = "necromancer-motion";

export interface MotionState {
  reduced: boolean;
  paused: boolean;
  enabled: boolean;
}

const query = typeof window === "undefined" ? null : window.matchMedia("(prefers-reduced-motion: reduce)");

function readPaused(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "paused";
  } catch {
    return false;
  }
}

function build(reduced: boolean, paused: boolean): MotionState {
  return { reduced, paused, enabled: !reduced && !paused };
}

let state: MotionState = build(Boolean(query?.matches), typeof window === "undefined" ? false : readPaused());
const listeners = new Set<() => void>();

function apply() {
  if (typeof document !== "undefined") document.documentElement.dataset.motion = state.enabled ? "on" : "off";
  for (const listener of listeners) listener();
}

query?.addEventListener("change", (event) => {
  state = build(event.matches, state.paused);
  apply();
});

apply();

function markTab() {
  document.documentElement.dataset.tab = document.hidden ? "hidden" : "shown";
}

if (typeof document !== "undefined") {
  markTab();
  document.addEventListener("visibilitychange", markTab);
}

export function toggleMotion() {
  const paused = !state.paused;
  try {
    window.localStorage.setItem(KEY, paused ? "paused" : "playing");
  } catch {
    void 0;
  }
  state = build(state.reduced, paused);
  apply();
}

export function useMotion(): MotionState {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => state,
    () => state,
  );
}
