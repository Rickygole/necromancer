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
    <button type="button" className="motion-toggle" aria-pressed={motion.paused} onClick={toggleMotion}>
      <span aria-hidden="true" className="motion-toggle__dot" />
      {motion.paused ? "motion paused" : "pause motion"}
    </button>
  );
}
