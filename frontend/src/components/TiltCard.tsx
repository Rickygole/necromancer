import { useRef, type CSSProperties, type ElementType, type PointerEvent, type ReactNode } from "react";
import { useMotion } from "../motion";

interface Props {
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  max?: number;
  children: ReactNode;
  [key: string]: unknown;
}

const finePointer = typeof window !== "undefined" ? window.matchMedia("(hover: hover) and (pointer: fine)") : null;

export function TiltCard({ as: Tag = "div", className, style, max = 6, children, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);
  const motion = useMotion();
  const live = motion.enabled && Boolean(finePointer?.matches);

  const onMove = (event: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!live || !el) return;
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    el.style.setProperty("--tilt-x", `${((0.5 - y) * max).toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${((x - 0.5) * max).toFixed(2)}deg`);
    el.style.setProperty("--sheen-x", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--sheen-y", `${(y * 100).toFixed(1)}%`);
    el.classList.add("is-tilting");
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
    el.classList.remove("is-tilting");
  };

  return (
    <Tag
      ref={ref}
      className={`tilt ${className ?? ""}`}
      style={style}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      {...rest}
    >
      {children}
    </Tag>
  );
}
