import { useEffect, useRef } from "react";

interface Props {
  running: boolean;
}

interface Ember {
  x: number;
  y: number;
  r: number;
  vy: number;
  sway: number;
  phase: number;
  life: number;
}

interface Bat {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
  dip: number;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeSprite(): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = 32;
  sprite.height = 32;
  const ctx = sprite.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255, 228, 170, 1)");
    g.addColorStop(0.25, "rgba(245, 150, 60, 0.9)");
    g.addColorStop(0.6, "rgba(200, 80, 20, 0.25)");
    g.addColorStop(1, "rgba(200, 80, 20, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  }
  return sprite;
}

function drawBat(ctx: CanvasRenderingContext2D, bat: Bat, t: number) {
  const flap = Math.sin(t * 0.012 + bat.phase);
  const s = bat.size;
  ctx.save();
  ctx.translate(bat.x, bat.y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-s * 0.5, -s * 0.2 - flap * s * 0.45, -s * 1.1, -flap * s * 0.55);
  ctx.quadraticCurveTo(-s * 0.75, s * 0.05, -s * 0.55, s * 0.18);
  ctx.quadraticCurveTo(-s * 0.3, s * 0.05, 0, s * 0.3);
  ctx.quadraticCurveTo(s * 0.3, s * 0.05, s * 0.55, s * 0.18);
  ctx.quadraticCurveTo(s * 0.75, s * 0.05, s * 1.1, -flap * s * 0.55);
  ctx.quadraticCurveTo(s * 0.5, -s * 0.2 - flap * s * 0.45, 0, 0);
  ctx.fill();
  ctx.restore();
}

export function Embers({ running }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(running);
  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const sprite = makeSprite();
    let width = 0;
    let height = 0;
    let embers: Ember[] = [];
    let bats: Bat[] = [];
    let frame = 0;
    let last = 0;
    let visible = true;

    const spawnEmber = (anywhere: boolean): Ember => ({
      x: rand(0, width),
      y: anywhere ? rand(0, height) : height + rand(0, 40),
      r: rand(2, 7),
      vy: rand(12, 38),
      sway: rand(6, 22),
      phase: rand(0, Math.PI * 2),
      life: rand(0.4, 1),
    });

    const spawnBat = (anywhere: boolean): Bat => ({
      x: anywhere ? rand(0, width) : -rand(40, 260),
      y: rand(height * 0.06, height * 0.45),
      speed: rand(40, 85),
      size: rand(7, 15),
      phase: rand(0, Math.PI * 2),
      dip: rand(8, 26),
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      width = Math.max(1, box.width);
      height = Math.max(1, box.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(70, Math.max(24, width / 18)));
      embers = Array.from({ length: count }, () => spawnEmber(true));
      bats = Array.from({ length: width < 640 ? 3 : 6 }, () => spawnBat(true));
      draw(performance.now());
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      for (const e of embers) {
        const flick = 0.55 + 0.45 * Math.sin(t * 0.004 + e.phase * 3);
        ctx.globalAlpha = Math.max(0, Math.min(1, e.life * flick * (e.y / height + 0.15)));
        const x = e.x + Math.sin(t * 0.0011 + e.phase) * e.sway;
        ctx.drawImage(sprite, x - e.r * 2, e.y - e.r * 2, e.r * 4, e.r * 4);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = "#050407";
      for (const b of bats) drawBat(ctx, b, t);
      ctx.globalAlpha = 1;
    };

    const step = (t: number) => {
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      for (let i = 0; i < embers.length; i += 1) {
        const e = embers[i];
        e.y -= e.vy * dt;
        if (e.y < -20) embers[i] = spawnEmber(false);
      }
      for (let i = 0; i < bats.length; i += 1) {
        const b = bats[i];
        b.x += b.speed * dt;
        b.y += Math.sin(t * 0.0015 + b.phase) * b.dip * dt;
        if (b.x > width + 60) bats[i] = spawnBat(false);
      }
      draw(t);
      frame = window.requestAnimationFrame(step);
    };

    const sync = () => {
      const go = runningRef.current && visible && !document.hidden;
      if (go && !frame) {
        last = 0;
        frame = window.requestAnimationFrame(step);
      } else if (!go && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    kick.current = sync;

    const io = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    resize();
    sync();

    return () => {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
  }, []);

  useEffect(() => {
    runningRef.current = running;
    kick.current();
  }, [running]);

  return <canvas ref={ref} className="embers" aria-hidden="true" />;
}
