import { useEffect, useRef, type CSSProperties } from "react";
import { useMotion } from "../motion";
import { Bat, Crack } from "./Doodles";
import { Embers } from "./Embers";

const SLICES = 11;
const NOISE = [0, 0.6, -0.4, 0.9, 0.2, -0.8, -5.5, -7, -2, 0.4, -0.3, 0.8, -0.6, 0.3, 1.2, -0.9, 0.1, -1.6, -3.2, 0.5, 0];

function archPolygon(): string {
  const points: string[] = ["1% 100%", "0% 66%", "1.5% 40%"];
  const steps = NOISE.length - 1;
  for (let i = 0; i <= steps; i += 1) {
    const theta = Math.PI - (i * Math.PI) / steps;
    const wobble = 1 + NOISE[i] / 100;
    const x = 50 + 49 * wobble * Math.cos(theta);
    const y = 37 - 34 * wobble * Math.sin(theta);
    points.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  points.push("98.5% 41%", "100% 72%", "98% 100%");
  return `polygon(${points.join(", ")})`;
}

const ARCH = archPolygon();

export function Scene() {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useMotion();
  const enabled = motion.enabled;
  const visibleRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (rx: number, ry: number, px: number, py: number, sy: number) => {
      el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
      el.style.setProperty("--px", px.toFixed(3));
      el.style.setProperty("--py", py.toFixed(3));
      el.style.setProperty("--sy", sy.toFixed(1));
    };

    if (!enabled) {
      set(3, -16, 0, 0, 0);
      return;
    }

    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let frame = 0;
    let last = 0;

    const onPointer = (event: PointerEvent) => {
      target = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      };
    };

    const tick = (t: number) => {
      const dt = Math.min(64, t - (last || t));
      last = t;
      const k = 1 - Math.pow(0.9, dt / 16);
      current = { x: current.x + (target.x - current.x) * k, y: current.y + (target.y - current.y) * k };
      const idle = Math.sin(t * 0.00035) * 7;
      const sy = Math.min(window.scrollY, window.innerHeight);
      set(3 - current.y * 9, -14 + idle + current.x * 18, current.x, current.y, sy);
      frame = window.requestAnimationFrame(tick);
    };

    const sync = () => {
      const go = visibleRef.current && !document.hidden;
      if (go && !frame) {
        last = 0;
        frame = window.requestAnimationFrame(tick);
      } else if (!go && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const io = new IntersectionObserver((entries) => {
      visibleRef.current = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    io.observe(el);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", sync);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return (
    <div ref={ref} className="scene" aria-hidden="true">
      <div className="scene__sky">
        <div className="moon">
          <span className="moon__halo" />
          <span className="moon__disc" />
        </div>
        <Bat className="scene__bat scene__bat--one" />
        <Bat className="scene__bat scene__bat--two" />
      </div>
      <div className="fog fog--back">
        <span />
      </div>
      <Embers running={enabled} />
      <div className="stage">
        <div className="stone">
          {Array.from({ length: SLICES }, (_, i) => {
            const z = (i / (SLICES - 1) - 0.5) * 2;
            const front = i === SLICES - 1;
            const back = i === 0;
            return (
              <div
                key={i}
                className={`stone__slice${front ? " stone__slice--front" : ""}${back ? " stone__slice--back" : ""}`}
                style={{ "--z": z.toFixed(3), clipPath: ARCH } as CSSProperties}
              >
                {front ? (
                  <div className="stone__face">
                    <p className="stone__small">here lies</p>
                    <p className="stone__name">UICALC</p>
                    <p className="stone__pic">WS-QUOTIENT PIC 9(3)</p>
                    <p className="stone__epitaph">
                      26,000.00 / 26 = 000
                      <br />
                      it truncated quietly
                    </p>
                    <Crack className="stone__crack" />
                    <span className="stone__moss" />
                  </div>
                ) : null}
              </div>
            );
          })}
          <div className="plinth">
            <span className="plinth__face plinth__face--front" />
            <span className="plinth__face plinth__face--top" />
            <span className="plinth__face plinth__face--left" />
            <span className="plinth__face plinth__face--right" />
          </div>
        </div>
        <span className="stone__shadow" />
        <div className="scene-candle" data-candle>
          <span className="scene-candle__glow" />
          <span className="scene-candle__flame" />
          <span className="scene-candle__wax" />
        </div>
      </div>
      <div className="fog fog--front">
        <span />
      </div>
    </div>
  );
}
