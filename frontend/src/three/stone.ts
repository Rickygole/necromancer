import { CanvasTexture, ExtrudeGeometry, Shape } from "three";
import { paint } from "./kit";

export interface Engraving {
  kicker: string;
  name: string;
  code: string;
  note: string;
}

export function fontVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function archShape(w: number, h: number): Shape {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true);
  s.lineTo(w / 2, 0);
  s.lineTo(-w / 2, 0);
  return s;
}

export function extrude(shape: Shape, depth: number): ExtrudeGeometry {
  const g = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 12,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function stoneTexture(r: () => number, w: number, h: number, engraving: Engraving | null): CanvasTexture {
  const W = 320;
  const H = Math.round((W * h) / w);
  const display = fontVar("--font-display", "Georgia, serif");
  const mono = fontVar("--font-mono", "ui-monospace, Menlo, monospace");
  const texture = paint(W, H, (ctx) => {
    ctx.fillStyle = "#8a8476";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3200; i += 1) {
      const v = (96 + r() * 90) | 0;
      ctx.fillStyle = `rgba(${v},${v - 4},${v - 14},${(0.2 + r() * 0.35).toFixed(2)})`;
      ctx.fillRect(r() * W, r() * H, 1 + r() * 2.5, 1 + r() * 2.5);
    }
    for (let i = 0; i < 7; i += 1) {
      ctx.strokeStyle = `rgba(40,36,32,${(0.12 + r() * 0.2).toFixed(2)})`;
      ctx.lineWidth = 1 + r();
      ctx.beginPath();
      let x = r() * W;
      let y = r() * H * 0.4;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k += 1) {
        x += (r() - 0.5) * 30;
        y += 10 + r() * 22;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const fade = ctx.createLinearGradient(0, 0, 0, H);
    fade.addColorStop(0, "rgba(20,18,16,0)");
    fade.addColorStop(0.6, "rgba(20,18,16,0.12)");
    fade.addColorStop(1, "rgba(20,18,16,0.55)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 16; i += 1) {
      const x = r() * W;
      const y = H * (0.78 + r() * 0.24);
      const rad = 14 + r() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, "rgba(72,92,40,0.55)");
      g.addColorStop(1, "rgba(72,92,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const carve = (text: string, y: number, weight: string, size: number, family: string) => {
      if (!text) return;
      let px = size;
      ctx.font = `${weight} ${px}px ${family}`;
      while (ctx.measureText(text).width > W * 0.8 && px > 8) {
        px -= 1;
        ctx.font = `${weight} ${px}px ${family}`;
      }
      ctx.fillStyle = "rgba(255,248,230,0.4)";
      ctx.fillText(text, W / 2 + 1.5, y + 1.8);
      ctx.fillStyle = "rgba(26,22,20,0.94)";
      ctx.fillText(text, W / 2, y);
    };
    if (engraving) {
      const top = H - W * 1.1;
      carve(engraving.kicker, top + W * 0.3, "600", W * 0.075, mono);
      carve(engraving.name, top + W * 0.47, "700", W * 0.2, display);
      carve(engraving.code, top + W * 0.66, "500", W * 0.068, mono);
      const notes = engraving.note.split("\n");
      notes.forEach((line, i) => carve(line, top + W * (0.8 + i * 0.09), "italic 400", W * 0.066, display));
    } else {
      ctx.fillStyle = "rgba(30,26,24,0.35)";
      for (let i = 0; i < 4; i += 1) {
        const lw = W * (0.3 + r() * 0.35);
        ctx.fillRect((W - lw) / 2, H * (0.3 + i * 0.1), lw, 5);
      }
    }
  });
  texture.repeat.set(1 / w, 1 / h);
  texture.offset.set(0.5, 0);
  return texture;
}
