import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

interface Props {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  depth?: "near" | "far";
  [key: string]: unknown;
}

export function Reveal({ as: Tag = "div", className, children, depth = "near", ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const classes = ["reveal", `reveal--${depth}`, shown ? "is-in" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <Tag ref={ref} className={classes} {...rest}>
      {children}
    </Tag>
  );
}
