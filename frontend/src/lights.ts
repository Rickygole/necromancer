import { useEffect, useState } from "react";

const SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
const DARK_MS = 1800;

export function useLightsOut(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let position = 0;
    let clicks: number[] = [];
    let timer = 0;

    const blowOut = () => {
      window.clearTimeout(timer);
      setDark(true);
      timer = window.setTimeout(() => setDark(false), DARK_MS);
    };

    const onKey = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === SEQUENCE[position]) {
        position += 1;
        if (position === SEQUENCE.length) {
          position = 0;
          blowOut();
        }
      } else {
        position = key === SEQUENCE[0] ? 1 : 0;
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest("[data-candle]")) return;
      const now = performance.now();
      clicks = clicks.filter((t) => now - t < 1500);
      clicks.push(now);
      if (clicks.length >= 3) {
        clicks = [];
        blowOut();
      }
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      window.clearTimeout(timer);
    };
  }, []);

  return dark;
}
