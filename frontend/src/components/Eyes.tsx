import { useEffect, useRef } from "react";
import { useMotion } from "../motion";

const PAIRS = ["one", "two", "three"] as const;

export function Eyes() {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root || !motion.enabled) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;
    const pupils = Array.from(root.querySelectorAll<HTMLElement>(".eye__pupil"));
    let x = 0;
    let y = 0;
    let frame = 0;
    const paint = () => {
      frame = 0;
      for (const pupil of pupils) {
        const box = pupil.parentElement!.getBoundingClientRect();
        const dx = x - (box.left + box.width / 2);
        const dy = y - (box.top + box.height / 2);
        const d = Math.hypot(dx, dy) || 1;
        pupil.style.transform = `translate3d(${((dx / d) * 3).toFixed(2)}px, ${((dy / d) * 1).toFixed(2)}px, 0)`;
      }
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
      for (const pupil of pupils) pupil.style.transform = "";
    };
  }, [motion.enabled]);

  return (
    <div ref={ref} className="eyes" aria-hidden="true">
      {PAIRS.map((pair) => (
        <span key={pair} className={`eyes__pair eyes__pair--${pair}`}>
          <span className="eye">
            <span className="eye__pupil" />
          </span>
          <span className="eye">
            <span className="eye__pupil" />
          </span>
        </span>
      ))}
    </div>
  );
}
