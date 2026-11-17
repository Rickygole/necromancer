import { useEffect, useRef, useState } from "react";
import { useMotion } from "../motion";
import { Bat } from "./Doodles";

const NEAR = 130;
const CLEAR = 220;
const RETURN_MS = 1600;
const FIRST_DROP_MS = 2400;
const FLIGHT_MS = 3200;
const FLIGHT_GAP_MS = 26000;

export function Spider() {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useMotion();
  const [down, setDown] = useState(!motion.enabled);

  useEffect(() => {
    if (!motion.enabled) {
      setDown(true);
      return;
    }
    const el = ref.current?.querySelector<HTMLElement>(".spider__body");
    if (!el) return;
    let shy = false;
    let frame = 0;
    let x = 0;
    let y = 0;
    let back = window.setTimeout(() => setDown(true), FIRST_DROP_MS);
    const check = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const d = Math.hypot(x - (box.left + box.width / 2), y - (box.top + box.height / 2));
      if (d < NEAR && !shy) {
        shy = true;
        window.clearTimeout(back);
        setDown(false);
      } else if (shy && d > CLEAR) {
        shy = false;
        window.clearTimeout(back);
        back = window.setTimeout(() => setDown(true), RETURN_MS);
      }
    };
    const onPointer = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      window.clearTimeout(back);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [motion.enabled]);

  return (
    <div ref={ref} className={`spider${down ? " is-down" : ""}`}>
      <span className="spider__thread" />
      <span className="spider__body">
        <svg viewBox="0 0 60 52" focusable="false">
          <g className="spider__legs" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M24 22 L12 12 L4 20" />
            <path d="M24 25 L9 22 L1 33" />
            <path d="M24 28 L11 32 L5 46" />
            <path d="M25 31 L16 39 L13 51" />
            <path d="M36 22 L48 12 L56 20" />
            <path d="M36 25 L51 22 L59 33" />
            <path d="M36 28 L49 32 L55 46" />
            <path d="M35 31 L44 39 L47 51" />
          </g>
          <ellipse className="spider__shell" cx="30" cy="20" rx="6.5" ry="6" />
          <ellipse className="spider__shell" cx="30" cy="34" rx="9" ry="11" />
          <path className="spider__mark" d="M30 28 L27 33 L30 38 L33 33 Z" />
          <circle className="spider__eye" cx="27.6" cy="17.6" r="1.3" />
          <circle className="spider__eye" cx="32.4" cy="17.6" r="1.3" />
        </svg>
      </span>
    </div>
  );
}

export function Swoop() {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useMotion();
  const [flying, setFlying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !motion.enabled) {
      setFlying(false);
      return;
    }
    let visible = true;
    let timer = 0;
    const schedule = (wait: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fly, wait);
    };
    const fly = () => {
      if (!visible || document.hidden) {
        schedule(4000);
        return;
      }
      setFlying(true);
      timer = window.setTimeout(() => {
        setFlying(false);
        schedule(FLIGHT_GAP_MS + Math.random() * 8000);
      }, FLIGHT_MS);
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    });
    io.observe(el.parentElement ?? el);
    schedule(9000);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [motion.enabled]);

  return (
    <div ref={ref} className={`swoop${flying ? " is-flying" : ""}`}>
      <span className="swoop__wings">
        <Bat className="swoop__bat" />
      </span>
    </div>
  );
}

const SPOKES = [0, 15, 32, 50, 68, 84, 90];
const RINGS = [0.22, 0.42, 0.62, 0.82];

function webPath(size: number): string {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const parts: string[] = [];
  for (const a of SPOKES) parts.push(`M0 0 L${(Math.cos(rad(a)) * size).toFixed(1)} ${(Math.sin(rad(a)) * size).toFixed(1)}`);
  RINGS.forEach((r, ring) => {
    const len = size * r;
    let d = "";
    SPOKES.forEach((a, i) => {
      const wobble = 1 + ((i + ring) % 3) * 0.03;
      const px = Math.cos(rad(a)) * len * wobble;
      const py = Math.sin(rad(a)) * len * wobble;
      if (i === 0) {
        d += `M${px.toFixed(1)} ${py.toFixed(1)}`;
        return;
      }
      const mid = rad((a + SPOKES[i - 1]) / 2);
      const sag = len * 0.84;
      d += ` Q${(Math.cos(mid) * sag).toFixed(1)} ${(Math.sin(mid) * sag).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`;
    });
    parts.push(d);
  });
  return parts.join(" ");
}

const WEB = webPath(100);

export function Cobweb({ className, flip = false }: { className: string; flip?: boolean }) {
  return (
    <svg className={`cobweb ${className}`} viewBox="0 0 100 100" focusable="false">
      <path d={WEB} transform={flip ? "matrix(-1 0 0 1 100 0)" : undefined} />
    </svg>
  );
}
