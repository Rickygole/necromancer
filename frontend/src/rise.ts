import { useEffect, useRef, useState, type RefObject } from "react";
import { useMotion } from "./motion";

export function useRise<T extends HTMLElement>(): [RefObject<T | null>, string] {
  const ref = useRef<T>(null);
  const motion = useMotion();
  const [up, setUp] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || up || !motion.enabled) return;
    if (typeof IntersectionObserver === "undefined") {
      setUp(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setUp(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [up, motion.enabled]);

  if (!motion.enabled) return [ref, ""];
  return [ref, up ? " rises is-up" : " rises"];
}
