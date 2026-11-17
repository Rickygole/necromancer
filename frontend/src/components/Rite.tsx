import { useEffect, useRef, useState } from "react";
import { useDeep, webglReady, whenIdle } from "../three/gate";
import type { Anchor, RiteHandle, RiteState } from "../three/rite";

function anchorFor(host: HTMLElement): Anchor {
  const box = host.getBoundingClientRect();
  const candle = host.parentElement?.querySelector<HTMLElement>(".verdict__candle");
  const spot = candle?.getBoundingClientRect();
  if (spot && spot.width > 0 && spot.height > 0) {
    return { x: spot.left + spot.width / 2 - box.left, y: spot.bottom - box.top - 4, r: Math.min(92, box.width * 0.075) };
  }
  return { x: box.width - Math.min(84, box.width * 0.22), y: 92, r: Math.min(60, box.width * 0.15) };
}

export function Rite(props: RiteState) {
  const deep = useDeep();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<RiteHandle | null>(null);
  const stateRef = useRef(props);
  stateRef.current = props;
  const live = deep && !failed;

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const start = () => {
      if (!webglReady()) {
        setFailed(true);
        return;
      }
      const fonts = document.fonts?.ready ?? Promise.resolve();
      Promise.all([import("../three/rite"), fonts])
        .then(([mod]) => {
          const canvas = canvasRef.current;
          if (cancelled || !canvas) return;
          const handle = mod.mountRite(canvas, canvas, () => anchorFor(canvas));
          if (!handle) {
            setFailed(true);
            return;
          }
          handle.update(stateRef.current);
          handleRef.current = handle;
          setReady(true);
        })
        .catch(() => setFailed(true));
    };
    const cancelIdle = whenIdle(start);
    return () => {
      cancelled = true;
      cancelIdle();
      handleRef.current?.dispose();
      handleRef.current = null;
      setReady(false);
    };
  }, [live]);

  const { tone, running, progress, mismatched, classes, runId, finished } = props;
  const classKey = classes.join("\u0000");
  useEffect(() => {
    handleRef.current?.update({ tone, running, progress, mismatched, classes: classKey ? classKey.split("\u0000") : [], runId, finished });
  }, [tone, running, progress, mismatched, classKey, runId, finished, ready]);

  if (!live) return null;
  return <canvas ref={canvasRef} className={ready ? "rite is-ready" : "rite"} aria-hidden="true" />;
}
