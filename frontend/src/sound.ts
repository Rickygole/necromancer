import { useSyncExternalStore } from "react";

const KEY = "necromancer-sound";

type Sting = "rise" | "bury" | "revive";

interface Rig {
  ctx: AudioContext;
  master: GainNode;
  drone: GainNode;
}

function readOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

function writeOn(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    void 0;
  }
}

let on = typeof window === "undefined" ? false : readOn();
let rig: Rig | null = null;
let armed = false;
const listeners = new Set<() => void>();
const reducedQuery = typeof window === "undefined" ? null : window.matchMedia("(prefers-reduced-motion: reduce)");

function notify() {
  for (const listener of listeners) listener();
}

function audioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function build(): Rig | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  const drone = ctx.createGain();
  drone.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 240;
  filter.Q.value = 6;
  drone.connect(master);
  filter.connect(drone);

  const voices: Array<[OscillatorType, number, number]> = [
    ["sawtooth", 55, 0.32],
    ["sawtooth", 55.45, 0.28],
    ["sine", 27.5, 0.6],
    ["triangle", 82.6, 0.12],
  ];
  for (const [type, freq, level] of voices) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(filter);
    osc.start();
  }

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = ctx.createGain();
  depth.gain.value = 120;
  lfo.connect(depth).connect(filter.frequency);
  lfo.start();

  return { ctx, master, drone };
}

function fadeDrone(target: number, seconds: number) {
  if (!rig) return;
  const now = rig.ctx.currentTime;
  const g = rig.drone.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(target, now + seconds);
}

function wake() {
  if (!rig) rig = build();
  if (!rig) return;
  if (rig.ctx.state === "suspended") void rig.ctx.resume();
  fadeDrone(0.05, 2.5);
}

function sleep() {
  if (!rig) return;
  fadeDrone(0, 0.4);
  const ctx = rig.ctx;
  window.setTimeout(() => {
    if (!on && ctx.state === "running") void ctx.suspend();
  }, 500);
}

function disarm() {
  armed = false;
  window.removeEventListener("pointerdown", onGesture, true);
  window.removeEventListener("keydown", onGesture, true);
}

function onGesture() {
  disarm();
  if (on) wake();
}

function arm() {
  if (armed) return;
  armed = true;
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
}

if (typeof document !== "undefined") {
  if (on) arm();
  document.addEventListener("visibilitychange", () => {
    if (!rig || !on) return;
    if (document.hidden) void rig.ctx.suspend();
    else void rig.ctx.resume();
  });
}

export function toggleSound() {
  on = !on;
  writeOn(on);
  disarm();
  if (on) wake();
  else sleep();
  notify();
}

function tone(ctx: AudioContext, out: AudioNode, type: OscillatorType, freq: number, start: number, peak: number, decay: number) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + decay + 0.05);
  return osc;
}

export function sting(kind: Sting) {
  if (!on || !rig || rig.ctx.state !== "running") return;
  if (reducedQuery?.matches) return;
  const { ctx, master } = rig;
  const t = ctx.currentTime + 0.01;
  if (kind === "rise") {
    const low = tone(ctx, master, "sawtooth", 110, t, 0.09, 1.8);
    low.frequency.exponentialRampToValueAtTime(73.4, t + 1.6);
    tone(ctx, master, "triangle", 155.6, t, 0.06, 1.6);
    tone(ctx, master, "sine", 466.2, t + 0.05, 0.035, 1.4);
    return;
  }
  if (kind === "bury") {
    for (const [freq, level] of [
      [98, 0.12],
      [196.9, 0.05],
      [293.7, 0.03],
    ] as const) {
      tone(ctx, master, "sine", freq, t, level, 2.6);
    }
    return;
  }
  tone(ctx, master, "sine", 392, t, 0.05, 1.4);
  tone(ctx, master, "sine", 587.3, t + 0.12, 0.04, 1.4);
  tone(ctx, master, "triangle", 784, t + 0.24, 0.025, 1.6);
}

export function useSound(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => on,
    () => on,
  );
}
