import { useEffect, useRef } from "react";
import { useMotion } from "../motion";

const SCRAWLS = [
  { text: "000", className: "scrawl scrawl--big" },
  { text: "650.00 became 0.00", className: "scrawl scrawl--one" },
  { text: "PIC 9(3) PIC 9(3) PIC 9(3)", className: "scrawl scrawl--two" },
  { text: "they kept the bug", className: "scrawl scrawl--three" },
  { text: "1000 mod 1000", className: "scrawl scrawl--four" },
  { text: "do not trust the comments", className: "scrawl scrawl--five" },
];

export function Lantern() {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useMotion();

  useEffect(() => {
    const root = ref.current;
    const beam = root?.querySelector<HTMLElement>(".lantern__beam");
    const wall = root?.querySelector<HTMLElement>(".lantern__wall");
    if (!root || !beam || !wall || !motion.enabled) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;
    let px = -1;
    let py = -1;
    let frame = 0;
    let inView = true;
    const fit = () => {
      wall.style.width = `${root.clientWidth}px`;
      wall.style.height = `${root.clientHeight}px`;
    };
    const paint = () => {
      frame = 0;
      const box = root.getBoundingClientRect();
      const r = beam.offsetWidth / 2;
      const x = px - box.left;
      const y = py - box.top;
      const inside = px >= 0 && x > -r && y > -r && x < box.width + r && y < box.height + r;
      root.classList.toggle("is-lit", inside && inView);
      if (!inside) return;
      beam.style.transform = `translate3d(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px, 0)`;
      wall.style.transform = `translate3d(${(r - x).toFixed(1)}px, ${(r - y).toFixed(1)}px, 0)`;
    };
    const kick = () => {
      if (!frame && inView) frame = window.requestAnimationFrame(paint);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      px = event.clientX;
      py = event.clientY;
      kick();
    };
    const onLeave = () => {
      px = -1;
      root.classList.remove("is-lit");
    };
    const io = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      if (!inView) root.classList.remove("is-lit");
    });
    const ro = new ResizeObserver(fit);
    fit();
    io.observe(root);
    ro.observe(root);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", kick, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", kick);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
      root.classList.remove("is-lit");
    };
  }, [motion.enabled]);

  return (
    <div ref={ref} className="lantern" aria-hidden="true">
      <div className="lantern__beam">
        <div className="lantern__wall">
          {SCRAWLS.map((s) => (
            <span key={s.text} className={s.className}>
              {s.text}
            </span>
          ))}
          <svg className="scrawl scrawl--tally" viewBox="0 0 120 40" focusable="false">
            <path d="M6 4 L8 36 M18 5 L19 35 M30 4 L31 36 M42 6 L42 35 M0 30 L50 10 M66 4 L67 36 M78 5 L80 35 M90 4 L90 36" />
          </svg>
        </div>
      </div>
    </div>
  );
}
