import { useEffect, useRef } from "react";
import { useMotion } from "../motion";

export function Atmosphere() {
  const motion = useMotion();
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = glowRef.current;
    if (!el || !motion.enabled) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;
    let x = 0;
    let y = 0;
    let frame = 0;
    const paint = () => {
      frame = 0;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      el.classList.add("is-on");
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    const onLeave = () => el.classList.remove("is-on");
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
      el.classList.remove("is-on");
    };
  }, [motion.enabled]);

  return (
    <div className="atmos" aria-hidden="true">
      <div className="atmos__fog atmos__fog--back">
        <span />
      </div>
      <div className="atmos__fog atmos__fog--front">
        <span />
      </div>
      <div className="atmos__glow" ref={glowRef} />
    </div>
  );
}
