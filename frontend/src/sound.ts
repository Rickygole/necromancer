import { useSyncExternalStore } from "react";

const KEY = "necromancer-sound";

type Sting = "rise" | "bury" | "revive";

interface Rig {
  ctx: AudioContext;
  master: GainNode;
  drone: GainNode;
  whisper: GainNode;
  noise: AudioBuffer;
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
let beatPeriod: number | null = null;
let beatTimer = 0;
let nextBeat = 0;
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

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

  const whisper = ctx.createGain();
  whisper.gain.value = 0;
  whisper.connect(master);
  const breath = ctx.createGain();
  breath.gain.value = 0.5;
  breath.connect(whisper);
  const hiss = ctx.createBufferSource();
  hiss.buffer = noise;
  hiss.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1500;
  band.Q.value = 1.4;
  hiss.connect(band).connect(breath);
  hiss.start();
  const sweep = ctx.createOscillator();
  sweep.frequency.value = 0.09;
  const sweepDepth = ctx.createGain();
  sweepDepth.gain.value = 700;
  sweep.connect(sweepDepth).connect(band.frequency);
  sweep.start();
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.17;
  const swellDepth = ctx.createGain();
  swellDepth.gain.value = 0.45;
  swell.connect(swellDepth).connect(breath.gain);
  swell.start();

  return { ctx, master, drone, whisper, noise };
}

function fadeDrone(target: number, seconds: number) {
  if (!rig) return;
  const now = rig.ctx.currentTime;
  const g = rig.drone.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(target, now + seconds);
  const w = rig.whisper.gain;
  w.cancelScheduledValues(now);
  w.setValueAtTime(w.value, now);
  w.linearRampToValueAtTime(target * 0.32, now + seconds);
}

function wake() {
  if (!rig) rig = build();
  if (!rig) return;
  if (rig.ctx.state === "suspended") void rig.ctx.resume();
  fadeDrone(0.05, 2.5);
  pump();
}

function sleep() {
  stopPump();
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

function thump(ctx: AudioContext, out: AudioNode, at: number, peak: number) {
  const low = tone(ctx, out, "sine", 70, at, peak, 0.2);
  low.frequency.exponentialRampToValueAtTime(42, at + 0.14);
  tone(ctx, out, "triangle", 110, at, peak * 0.22, 0.12);
}

function stopPump() {
  window.clearInterval(beatTimer);
  beatTimer = 0;
}

function pump() {
  stopPump();
  if (!on || !rig || beatPeriod === null) return;
  const { ctx, master } = rig;
  nextBeat = ctx.currentTime + 0.05;
  const schedule = () => {
    if (!rig || beatPeriod === null || ctx.state !== "running") return;
    if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + 0.05;
    while (nextBeat < ctx.currentTime + 0.25) {
      thump(ctx, master, nextBeat, 0.2);
      thump(ctx, master, nextBeat + beatPeriod * 0.22, 0.13);
      nextBeat += beatPeriod;
    }
  };
  schedule();
  beatTimer = window.setInterval(schedule, 100);
}

export function setHeartbeat(period: number | null) {
  if (period === beatPeriod) return;
  const was = beatPeriod;
  beatPeriod = period;
  if (period === null) stopPump();
  else if (was === null || !beatTimer) pump();
}

export function thunder() {
  if (!on || !rig || rig.ctx.state !== "running") return;
  const { ctx, master, noise } = rig;
  const t = ctx.currentTime + 0.05;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.setValueAtTime(380, t);
  low.frequency.exponentialRampToValueAtTime(90, t + 3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
  src.connect(low).connect(g).connect(master);
  src.start(t);
  src.stop(t + 3.5);
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
