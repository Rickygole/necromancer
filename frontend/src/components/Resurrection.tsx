import { useEffect, useRef, useState } from "react";
import { useMotion } from "../motion";
import { sting } from "../sound";
import { count } from "../status";

export const RISE_MS = 1400;
const COUNT_MS = 900;

export function useResurrection(key: string | null): boolean {
  const motion = useMotion();
  const enabledRef = useRef(motion.enabled);
  enabledRef.current = motion.enabled;
  const [rising, setRising] = useState(false);

  useEffect(() => {
    if (!key || !enabledRef.current) return;
    setRising(true);
    sting("rise");
    const timer = window.setTimeout(() => setRising(false), RISE_MS);
    return () => {
      window.clearTimeout(timer);
      setRising(false);
    };
  }, [key]);

  useEffect(() => {
    if (!motion.enabled) setRising(false);
  }, [motion.enabled]);

  return rising;
}

export function RisingCount({ value, play }: { value: number; play: boolean }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!play) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / COUNT_MS);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = window.requestAnimationFrame(tick);
    };
    setShown(0);
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [play, value]);

  const text = count(play ? shown : value);
  return (
    <span className={`verdict__big${play ? " is-glitching" : ""}`} data-text={text}>
      <span aria-hidden="true">{text}</span>
      <span className="visually-hidden">{count(value)}</span>
    </span>
  );
}
