import { toggleMotion, useMotion } from "../motion";

export function MotionToggle() {
  const motion = useMotion();
  if (motion.reduced) {
    return (
      <p className="motion-toggle motion-toggle--system">
        <span aria-hidden="true" className="motion-toggle__dot" />
        motion off, per your system
      </p>
    );
  }
  return (
    <button
      type="button"
      className={`motion-toggle${motion.paused ? " motion-toggle--paused" : ""}`}
      onClick={toggleMotion}
    >
      <span aria-hidden="true" className="motion-toggle__dot" />
      <span className="motion-toggle__text">{motion.paused ? "resume motion" : "pause motion"}</span>
    </button>
  );
}
