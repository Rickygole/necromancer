import { useEffect, type RefObject } from "react";
import { useMotion } from "./motion";

const finePointer = typeof window === "undefined" ? null : window.matchMedia("(hover: hover) and (pointer: fine)");

export function useTilt(ref: RefObject<HTMLElement | null>, max = 5, shape: unknown = null) {
  const motion = useMotion();
  const live = motion.enabled && Boolean(finePointer?.matches);

  useEffect(() => {
    const el = ref.current;
    if (!el || !live) return;
    let frame = 0;
    let px = 0;
    let py = 0;
    el.dataset.tilt = "rest";
    const paint = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const x = (px - box.left) / box.width - 0.5;
      const y = (py - box.top) / box.height - 0.5;
      el.style.setProperty("--tilt-x", `${(-y * max).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(x * max).toFixed(2)}deg`);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      px = event.clientX;
      py = event.clientY;
      el.dataset.tilt = "active";
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    const leave = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
      el.dataset.tilt = "rest";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      leave();
      delete el.dataset.tilt;
    };
  }, [ref, live, max, shape]);
}
