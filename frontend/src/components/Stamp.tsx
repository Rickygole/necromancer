interface Props {
  children: string;
  tone?: "red" | "ink" | "green" | "amber";
  tilt?: number;
  className?: string;
}

export function Stamp({ children, tone = "red", tilt = -6, className }: Props) {
  return (
    <span className={`stamp stamp--${tone} ${className ?? ""}`} style={{ rotate: `${tilt}deg` }}>
      {children}
    </span>
  );
}
