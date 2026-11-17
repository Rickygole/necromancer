import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QUIRKS } from "../content";
import { thunder } from "../sound";
import { useDeep, webglReady, whenIdle } from "../three/gate";
import type { Engraving } from "../three/graveyard";
import { Scene } from "./Scene";

function picOf(code: string): string {
  return code.split("\n")[0].replace(/^\s*\d+\s+/, "").replace(/\s+/g, " ").replace(/\.$/, "");
}

const ENGRAVINGS: Engraving[] = [
  { kicker: "HERE LIES", name: "UICALC", code: "WS-QUOTIENT PIC 9(3)", note: "26,000.00 / 26 = 000\nit truncated quietly" },
  ...QUIRKS.map((q) => ({
    kicker: `${q.id}, ${q.field}`,
    name: q.name.split(" ").slice(0, 2).join(" "),
    code: picOf(q.code),
    note: `the rules say ${q.rules}\nit kept ${q.legacy}`,
  })),
  { kicker: "NOT THE SPEC", name: "the bytes", code: "not the comments", note: "it is always right\neven when it is wrong" },
  { kicker: "REST HERE", name: "the rewrite", code: "written from the rules alone", note: "nobody knew" },
];

type Phase = "flat" | "fading" | "deep";

export function Graveyard() {
  const deep = useDeep();
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>("flat");
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = deep && !failed;

  useEffect(() => {
    if (!live) {
      setPhase("flat");
      return;
    }
    let cancelled = false;
    let handle: { dispose: () => void } | null = null;
    let timer = 0;
    const start = () => {
      if (!webglReady()) {
        setFailed(true);
        return;
      }
      const fonts = document.fonts?.ready ?? Promise.resolve();
      Promise.all([import("../three/graveyard"), fonts])
        .then(([mod]) => {
          const canvas = canvasRef.current;
          const layer = layerRef.current;
          if (cancelled || !canvas || !layer) return;
          handle = mod.mountGraveyard(canvas, layer, {
            engravings: ENGRAVINGS,
            hero: layer.ownerDocument.querySelector<HTMLElement>(".hero"),
            onReady: () => {
              if (cancelled) return;
              layer.classList.add("is-ready");
              document.documentElement.dataset.deep = "on";
              setPhase("fading");
              timer = window.setTimeout(() => setPhase("deep"), 700);
            },
            onFail: () => setFailed(true),
            onMove: () => undefined,
            onThunder: thunder,
          });
          if (!handle) setFailed(true);
        })
        .catch(() => setFailed(true));
    };
    const cancelIdle = whenIdle(start);
    return () => {
      cancelled = true;
      cancelIdle();
      window.clearTimeout(timer);
      handle?.dispose();
      handle = null;
      layerRef.current?.classList.remove("is-ready");
      delete document.documentElement.dataset.deep;
    };
  }, [live]);

  return (
    <>
      <Scene variant={phase} />
      {live
        ? createPortal(
            <div ref={layerRef} className="crypt3d" aria-hidden="true">
              <canvas ref={canvasRef} className="crypt3d__canvas" />
              <div className="crypt3d__veil" />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
