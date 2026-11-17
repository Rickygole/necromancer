import { useSyncExternalStore } from "react";
import { useMotion } from "../motion";

const forcedQuery = typeof window === "undefined" ? null : window.matchMedia("(forced-colors: active)");
const lessDataQuery = typeof window === "undefined" ? null : window.matchMedia("(prefers-reduced-data: reduce)");

let probed: boolean | null = null;

function saveData(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return Boolean(nav.connection?.saveData) || Boolean(lessDataQuery?.matches);
}

function lowPower(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return true;
  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency < 4) return true;
  return false;
}

function probe(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const attrs: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true, antialias: false, depth: false };
    const gl = (canvas.getContext("webgl2", attrs) ?? canvas.getContext("webgl", attrs)) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function webglReady(): boolean {
  if (probed !== null) return probed;
  if (typeof window === "undefined" || typeof WebGLRenderingContext === "undefined" || saveData()) {
    probed = false;
    return probed;
  }
  probed = !lowPower() && probe();
  return probed;
}

function subscribeForced(notify: () => void) {
  forcedQuery?.addEventListener("change", notify);
  return () => forcedQuery?.removeEventListener("change", notify);
}

export function useDeep(): boolean {
  const motion = useMotion();
  const forcedColors = useSyncExternalStore(
    subscribeForced,
    () => Boolean(forcedQuery?.matches),
    () => false,
  );
  return motion.enabled && !forcedColors;
}

export function whenIdle(run: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 1500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 300);
  return () => window.clearTimeout(id);
}
