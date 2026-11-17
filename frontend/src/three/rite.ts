import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RingGeometry,
  Scene,
  TorusGeometry,
} from "three";
import { disposeTree, makeRenderer, paint, releaseRenderer, rng, runLoop, watchContext } from "./kit";
import { archShape, extrude, stoneTexture } from "./stone";

export type RiteTone = "idle" | "match" | "mismatch" | "error" | "approval";

export interface RiteState {
  tone: RiteTone;
  running: boolean;
  progress: number;
  mismatched: number;
  classes: string[];
  runId: string | null;
  finished: boolean;
}

export interface Anchor {
  x: number;
  y: number;
  r: number;
}

export interface RiteHandle {
  update: (state: RiteState) => void;
  dispose: () => void;
}

const COLORS: Record<RiteTone, number> = {
  idle: 0xf3a24b,
  match: 0x9fd162,
  mismatch: 0xf0705f,
  error: 0xc0503f,
  approval: 0xe8b04c,
};

const SEGMENTS = 8;
const MAX_STONES = 8;
const TILT = (52 * Math.PI) / 180;
const FOV = 30;

function glyphLines(r: () => number, inner: number, outer: number, count: number, from: number, to: number): BufferGeometry {
  const points: number[] = [];
  const span = (to - from) / count;
  for (let i = 0; i < count; i += 1) {
    const a0 = from + i * span + span * 0.18;
    const a1 = from + (i + 1) * span - span * 0.18;
    const strokes = 2 + Math.floor(r() * 3);
    for (let k = 0; k < strokes; k += 1) {
      const pa = a0 + r() * (a1 - a0);
      const pb = a0 + r() * (a1 - a0);
      const ra = inner + r() * (outer - inner);
      const rb = r() < 0.5 ? inner + r() * (outer - inner) : ra;
      points.push(Math.cos(pa) * ra, 0, Math.sin(pa) * ra, Math.cos(pb) * rb, 0, Math.sin(pb) * rb);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
  return g;
}

function starLines(radius: number, n: number, step: number): BufferGeometry {
  const points: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const b = (((i + step) % n) / n) * Math.PI * 2;
    points.push(Math.cos(a) * radius, 0, Math.sin(a) * radius, Math.cos(b) * radius, 0, Math.sin(b) * radius);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
  return g;
}

function crackLines(r: () => number): BufferGeometry {
  const points: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    let a = (i / 7) * Math.PI * 2 + r() * 0.4;
    let rad = 0.14;
    let x = Math.cos(a) * rad;
    let z = Math.sin(a) * rad;
    while (rad < 1.25) {
      rad += 0.08 + r() * 0.1;
      a += (r() - 0.5) * 0.35;
      const nx = Math.cos(a) * rad;
      const nz = Math.sin(a) * rad;
      points.push(x, 0, z, nx, 0, nz);
      if (r() < 0.25) {
        const ba = a + (r() < 0.5 ? -0.6 : 0.6);
        points.push(nx, 0, nz, nx + Math.cos(ba) * 0.12, 0, nz + Math.sin(ba) * 0.12);
      }
      x = nx;
      z = nz;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
  return g;
}

function flatTorus(radius: number, tube: number, arc: number): TorusGeometry {
  const g = new TorusGeometry(radius, tube, 6, Math.max(8, Math.round(arc * 24)), arc);
  g.rotateX(Math.PI / 2);
  return g;
}

export function mountRite(canvas: HTMLCanvasElement, host: HTMLElement, anchor: () => Anchor): RiteHandle | null {
  const renderer = makeRenderer(canvas, true);
  if (!renderer) return null;
  renderer.setClearColor(0x000000, 0);

  const r = rng(731942);
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.05, 60);

  const glowColor = new Color(COLORS.idle);
  const goalColor = new Color(COLORS.idle);
  const red = new Color(COLORS.mismatch);
  const ringMat = new MeshBasicMaterial({ color: glowColor, transparent: true, blending: AdditiveBlending, depthWrite: false });
  const lineMat = new LineBasicMaterial({ color: glowColor, transparent: true, blending: AdditiveBlending, depthWrite: false });
  const starMat = new LineBasicMaterial({ color: glowColor, transparent: true, blending: AdditiveBlending, depthWrite: false });
  const crackMat = new LineBasicMaterial({ color: 0xff5a46, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const gyroMat = new MeshBasicMaterial({ color: glowColor, transparent: true, blending: AdditiveBlending, depthWrite: false });

  const occluder = new Mesh(new CircleGeometry(4, 48), new MeshBasicMaterial({ colorWrite: false }));
  occluder.rotation.x = -Math.PI / 2;
  occluder.position.y = -0.004;
  occluder.renderOrder = -1;
  scene.add(occluder);

  const glowTex = paint(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,0.5)");
    g.addColorStop(0.35, "rgba(255,255,255,0.16)");
    g.addColorStop(0.72, "rgba(255,255,255,0.2)");
    g.addColorStop(0.8, "rgba(255,255,255,0.05)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
  const glowMat = new MeshBasicMaterial({ map: glowTex, color: glowColor, transparent: true, blending: AdditiveBlending, depthWrite: false });
  const glow = new Mesh(new PlaneGeometry(2.9, 2.9), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.001;
  scene.add(glow);

  const rite = new Group();
  scene.add(rite);
  const segments: Array<{ group: Group; mid: number; tilt: number }> = [];
  const arc = (Math.PI * 2) / SEGMENTS;
  for (let i = 0; i < SEGMENTS; i += 1) {
    const group = new Group();
    const from = i * arc + 0.02;
    const to = (i + 1) * arc - 0.02;
    const outer = new Mesh(flatTorus(1, 0.012, to - from), ringMat);
    outer.rotation.y = -from;
    const inner = new Mesh(flatTorus(0.84, 0.008, to - from), ringMat);
    inner.rotation.y = -from;
    const runes = new LineSegments(glyphLines(r, 0.87, 0.97, 4, from, to), lineMat);
    group.add(outer, inner, runes);
    rite.add(group);
    segments.push({ group, mid: (from + to) / 2, tilt: (r() - 0.5) * 0.3 });
  }

  const star = new LineSegments(starLines(0.82, 7, 3), starMat);
  star.position.y = 0.002;
  scene.add(star);

  const inner = new Group();
  inner.add(new Mesh(flatTorus(0.5, 0.009, Math.PI * 2), ringMat));
  inner.add(new LineSegments(glyphLines(r, 0.53, 0.62, 18, 0, Math.PI * 2), lineMat));
  inner.add(new Mesh(flatTorus(0.13, 0.008, Math.PI * 2), ringMat));
  scene.add(inner);

  const gyros = [0.72, 0.6].map((radius, i) => {
    const m = new Mesh(new TorusGeometry(radius, 0.006, 6, 72), gyroMat);
    m.position.y = 0.42 + i * 0.1;
    scene.add(m);
    return m;
  });

  const cracks = new LineSegments(crackLines(r), crackMat);
  cracks.position.y = 0.003;
  scene.add(cracks);

  const waveMat = new MeshBasicMaterial({ color: 0xff6a52, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const wave = new Mesh(new RingGeometry(0.97, 1.0, 96), waveMat);
  wave.rotation.x = -Math.PI / 2;
  wave.position.y = 0.004;
  scene.add(wave);

  scene.add(new AmbientLight(0xc8c0d0, 4.2));
  const lamp = new PointLight(glowColor, 2, 6, 1.6);
  lamp.position.set(0, 0.6, 1.0);
  scene.add(lamp);

  const stoneW = 0.58;
  const stoneH = 0.82;
  const stoneGeo = extrude(archShape(stoneW, stoneH), 0.1);
  const plinthGeo = new BoxGeometry(stoneW * 1.25, 0.06, 0.18);
  const sideTex = stoneTexture(rng(5), 1, 1, null);
  sideTex.repeat.set(1, 1);
  sideTex.offset.set(0, 0);
  const sideMat = new MeshLambertMaterial({ color: 0x8c8578, map: sideTex });
  let stones: Array<{ group: Group; start: number; face: MeshLambertMaterial }> = [];
  let sinking: Array<{ group: Group; start: number; from: number; face: MeshLambertMaterial }> = [];

  const placeStones = (classes: string[], t: number) => {
    const list = classes.slice(0, MAX_STONES);
    const n = list.length;
    stones = list.map((name, i) => {
      const face = new MeshLambertMaterial({ color: 0xcfc6b4 });
      const tex = stoneTexture(rng(300 + i), stoneW, stoneH, { kicker: "R.I.P.", name, code: "class", note: "" });
      face.map = tex;
      face.bumpMap = tex;
      face.bumpScale = 1.2;
      const group = new Group();
      const stone = new Mesh(stoneGeo, [face, sideMat]);
      stone.position.y = 0.05;
      const plinth = new Mesh(plinthGeo, sideMat);
      plinth.position.y = 0.03;
      group.add(stone, plinth);
      const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * Math.min(2.2, 0.5 * (n - 1));
      const angle = Math.PI / 2 + spread;
      const radius = 1.32;
      group.position.set(Math.cos(angle) * radius, -0.9, Math.sin(angle) * radius);
      group.rotation.set(0, -spread * 0.6, (r() - 0.5) * 0.12);
      scene.add(group);
      return { group, start: t + 0.25 + i * 0.22, face };
    });
  };

  const sinkStones = (t: number) => {
    for (const s of stones) sinking.push({ group: s.group, start: t, from: s.group.position.y, face: s.face });
    stones = [];
  };

  const dropStone = (s: { group: Group; face: MeshLambertMaterial }) => {
    scene.remove(s.group);
    s.face.map?.dispose();
    s.face.dispose();
  };

  let width = 1;
  let height = 1;
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    const a = anchor();
    const fullW = 2 * Math.max(a.x, width - a.x, 1);
    const fullH = 2 * Math.max(a.y, height - a.y, 1);
    camera.aspect = fullW / fullH;
    camera.setViewOffset(fullW, fullH, fullW / 2 - a.x, fullH / 2 - a.y, width, height);
    const focal = fullH / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
    const distance = focal / Math.max(20, a.r);
    camera.position.set(0, Math.sin(TILT) * distance, Math.cos(TILT) * distance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let state: RiteState = { tone: "idle", running: false, progress: 0, mismatched: 0, classes: [], runId: null, finished: false };
  let fired: string | null = null;
  let pendingFire = false;
  let pendingStones = false;
  let placed = "";
  let waveAt = -100;
  let angle = 0;
  let spin = 0.12;
  let bright = 0.35;
  let crack = 0;
  let now = 0;
  let frames = 0;

  const targets = () => {
    const m = Math.log2(1 + Math.max(0, state.mismatched));
    if (state.running) {
      const p = Math.min(1, Math.max(0, state.progress));
      return { spin: (0.35 + 1.4 * p) * (1 + 0.12 * m), bright: 0.45 + 0.55 * p, pulse: Math.min(2.5, 0.5 + 0.35 * m), amp: 0.14, crack: 0 };
    }
    switch (state.tone) {
      case "mismatch": {
        const beat = Math.max(0.75, 1.15 - 0.045 * m);
        return { spin: 0.22, bright: 0.85, pulse: 1 / beat, amp: 0.12, crack: state.finished ? 1 : 0 };
      }
      case "match":
        return { spin: 0.08, bright: 0.62, pulse: 0, amp: 0, crack: 0 };
      case "approval":
        return { spin: 0.06, bright: 0.72, pulse: 0, amp: 0, crack: 0 };
      case "error":
        return { spin: 0.03, bright: 0.3, pulse: 0, amp: 0, crack: 0 };
      default:
        return { spin: 0.12, bright: 0.36, pulse: 0.2, amp: 0.1, crack: 0 };
    }
  };

  const frame = (t: number, dt: number) => {
    now = t;
    const goal = targets();
    const calm = !state.running && goal.pulse <= 0.2 && t - waveAt > 1.5 && stones.every((s) => t - s.start > 1.2) && !sinking.length;
    frames += 1;
    const k = 1 - Math.exp(-dt * 1.8);
    spin += (goal.spin - spin) * k;
    bright += (goal.bright - bright) * k;
    crack += (goal.crack - crack) * (1 - Math.exp(-dt * 3));
    if (state.running) goalColor.setHex(COLORS.idle).lerp(red, state.mismatched > 0 ? 0.35 : 0);
    else goalColor.setHex(COLORS[state.tone]);
    glowColor.lerp(goalColor, k);
    angle += spin * dt;

    if (pendingFire) {
      pendingFire = false;
      waveAt = t;
    }
    if (pendingStones) {
      pendingStones = false;
      sinkStones(t);
      placed = state.classes.join("|");
      placeStones(state.classes, t);
    }

    if (calm && frames % 2 === 1) return;

    const pulse = goal.pulse > 0 ? 1 + goal.amp * Math.sin(t * Math.PI * 2 * Math.min(goal.pulse, 2.5)) : 1;
    const b = bright * pulse;
    ringMat.color.copy(glowColor);
    lineMat.color.copy(glowColor);
    starMat.color.copy(glowColor);
    gyroMat.color.copy(glowColor);
    glowMat.color.copy(glowColor);
    lamp.color.copy(glowColor);
    ringMat.opacity = Math.min(1, 0.35 + b * 0.65);
    lineMat.opacity = Math.min(1, 0.25 + b * 0.75);
    starMat.opacity = Math.min(1, 0.12 + b * 0.5);
    glowMat.opacity = 0.12 + b * 0.38;
    gyroMat.opacity = state.running ? 0.15 + 0.45 * Math.min(1, state.progress) : 0.08 + b * 0.08;
    lamp.intensity = 0.8 + b * 2.2;
    crackMat.opacity = crack * 0.85;

    rite.rotation.y = angle;
    star.rotation.y = -angle * 0.6;
    inner.rotation.y = -angle * 1.6;
    gyros[0].rotation.set(Math.PI / 2 + Math.sin(angle * 0.7) * 0.5, angle * 0.9, 0);
    gyros[1].rotation.set(Math.PI / 2 + Math.cos(angle * 0.5) * 0.6, -angle * 1.2, Math.sin(angle) * 0.3);
    for (const s of segments) {
      const push = crack * 0.08;
      s.group.position.set(Math.cos(s.mid) * push, crack * 0.02, Math.sin(s.mid) * push);
      s.group.rotation.set(s.tilt * crack, 0, s.tilt * crack * 0.6);
    }

    const since = t - waveAt;
    if (since >= 0 && since < 1.3) {
      const e = since / 1.3;
      wave.scale.setScalar(1 + e * 1.9);
      waveMat.opacity = 0.55 * (1 - e) * (1 - e);
    } else {
      waveMat.opacity = 0;
    }

    for (const s of stones) {
      const p = Math.min(1, Math.max(0, (t - s.start) / 1.1));
      const ease = 1 - Math.pow(1 - p, 3);
      s.group.position.y = -0.9 * (1 - ease);
    }
    sinking = sinking.filter((s) => {
      const p = Math.min(1, (t - s.start) / 0.7);
      s.group.position.y = s.from - 0.95 * p * p;
      if (p >= 1) {
        dropStone(s);
        return false;
      }
      return true;
    });

    renderer.render(scene, camera);
  };

  const onLevel = (level: number) => {
    renderer.setPixelRatio(level >= 2 ? 0.75 : 1);
    resize();
  };

  let disposed = false;
  const loop = runLoop(host, frame, onLevel);
  const unwatch = watchContext(canvas, () => {
    if (!disposed) loop.dispose();
  });

  return {
    update: (next) => {
      const prev = state;
      state = next;
      const fire = next.finished && next.tone === "mismatch" && next.runId !== null && next.runId !== fired;
      if (fire) {
        fired = next.runId;
        pendingFire = true;
        pendingStones = true;
      } else if (next.finished && next.tone === "mismatch" && next.runId === fired && next.classes.join("|") !== placed) {
        pendingStones = true;
      } else if (prev.tone === "mismatch" && next.tone !== "mismatch" && stones.length) {
        sinkStones(now);
      }
      if (next.running && stones.length) sinkStones(now);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      loop.dispose();
      unwatch();
      ro.disconnect();
      for (const s of [...stones, ...sinking]) dropStone(s);
      disposeTree(scene);
      stoneGeo.dispose();
      plinthGeo.dispose();
      releaseRenderer(renderer);
    },
  };
}
