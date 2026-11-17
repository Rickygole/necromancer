import { useEffect, useRef } from "react";
import { useMotion } from "../motion";

const COUNT = 6;

export function GhostTrail() {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root || !motion.enabled) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;
    const dots = Array.from(root.children) as HTMLElement[];
    const pts = dots.map(() => ({ x: -100, y: -100 }));
    let tx = -100;
    let ty = -100;
    let frame = 0;
    let started = false;
    const tick = () => {
      let moving = false;
      let lx = tx;
      let ly = ty;
      pts.forEach((p, i) => {
        p.x += (lx - p.x) * 0.34;
        p.y += (ly - p.y) * 0.34;
        if (Math.abs(lx - p.x) > 0.4 || Math.abs(ly - p.y) > 0.4) moving = true;
        dots[i].style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        lx = p.x;
        ly = p.y;
      });
      if (moving && !document.hidden) {
        frame = window.requestAnimationFrame(tick);
      } else {
        frame = 0;
        root.classList.remove("is-on");
      }
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      tx = event.clientX;
      ty = event.clientY;
      if (!started) {
        started = true;
        for (const p of pts) {
          p.x = tx;
          p.y = ty;
        }
      }
      root.classList.add("is-on");
      if (!frame) frame = window.requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
      root.classList.remove("is-on");
    };
  }, [motion.enabled]);

  return (
    <div ref={ref} className="ghost-trail" aria-hidden="true">
      {Array.from({ length: COUNT }, (_, i) => (
        <span key={i} className="ghost-trail__wisp" />
      ))}
    </div>
  );
}
