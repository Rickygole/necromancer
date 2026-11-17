import { CanvasTexture, SRGBColorSpace, Texture, WebGLRenderer, type Material, type Object3D, type BufferGeometry } from "three";

export const MAX_DPR = 1.5;

export function makeRenderer(canvas: HTMLCanvasElement, alpha: boolean): WebGLRenderer | null {
  try {
    const renderer = new WebGLRenderer({
      canvas,
      alpha,
      antialias: false,
      stencil: false,
      depth: true,
      powerPreference: "default",
      preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.outputColorSpace = SRGBColorSpace;
    return renderer;
  } catch {
    return null;
  }
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paint(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, color = true): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new CanvasTexture(canvas);
  if (color) texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function glowTexture(): CanvasTexture {
  return paint(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

export function disposeTree(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((node) => {
    const item = node as Object3D & { geometry?: BufferGeometry; material?: Material | Material[]; dispose?: () => void };
    if (item.geometry) geometries.add(item.geometry);
    const list = Array.isArray(item.material) ? item.material : item.material ? [item.material] : [];
    for (const material of list) materials.add(material);
    if ((node as { isInstancedMesh?: boolean }).isInstancedMesh) item.dispose?.();
  });
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) textures.add(value);
    }
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
}

export function releaseRenderer(renderer: WebGLRenderer) {
  renderer.setAnimationLoop(null);
  renderer.renderLists.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
}

export interface Loop {
  dispose: () => void;
  level: () => number;
}

export function runLoop(
  watch: Element,
  frame: (time: number, dt: number, level: number) => void,
  onLevel: (level: number) => void,
): Loop {
  let raf = 0;
  let last = 0;
  let inView = true;
  let slowFor = 0;
  let average = 16.7;
  let level = 0;
  let skip = false;

  const tick = (now: number) => {
    raf = window.requestAnimationFrame(tick);
    const gap = last ? now - last : 16.7;
    last = now;
    if (gap > 1000) return;
    average = average * 0.9 + gap * 0.1;
    slowFor = average > 24 ? slowFor + gap : 0;
    if (slowFor > 2000 && level < 3) {
      level += 1;
      slowFor = 0;
      onLevel(level);
    }
    if (level >= 3) {
      skip = !skip;
      if (skip) return;
    }
    frame(now / 1000, Math.min(gap, 66) / 1000, level);
  };

  const sync = () => {
    const go = inView && !document.hidden;
    if (go && !raf) {
      last = 0;
      raf = window.requestAnimationFrame(tick);
    } else if (!go && raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const io = new IntersectionObserver((entries) => {
    inView = entries.some((entry) => entry.isIntersecting);
    sync();
  });
  io.observe(watch);
  document.addEventListener("visibilitychange", sync);
  sync();

  return {
    dispose: () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    },
    level: () => level,
  };
}

export function watchContext(canvas: HTMLCanvasElement, onLost: () => void): () => void {
  const lost = () => onLost();
  canvas.addEventListener("webglcontextlost", lost);
  return () => canvas.removeEventListener("webglcontextlost", lost);
}
