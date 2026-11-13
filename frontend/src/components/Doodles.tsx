import type { ReactElement } from "react";

interface Props {
  className?: string;
}

const base = { "aria-hidden": true, focusable: false } as const;

export function Crack({ className }: Props) {
  return (
    <svg {...base} className={className} viewBox="0 0 120 200" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M62 0 L58 22 L66 38 L55 61 L61 79 L47 104 L52 121 L41 146" strokeWidth="2.2" />
      <path d="M58 22 L41 30 L33 27" strokeWidth="1.3" />
      <path d="M55 61 L72 70 L80 82" strokeWidth="1.2" />
      <path d="M47 104 L33 110" strokeWidth="1" />
      <path d="M52 121 L63 133 L66 149" strokeWidth="0.9" />
    </svg>
  );
}

export function Stitches({ className }: Props) {
  return (
    <svg {...base} className={className} viewBox="0 0 240 24" fill="none" stroke="currentColor" strokeLinecap="round" preserveAspectRatio="none">
      <path d="M2 12 C 60 10, 120 14, 238 11" strokeWidth="1.4" />
      {[14, 38, 61, 87, 110, 134, 158, 181, 207, 228].map((x, i) => (
        <path key={x} d={`M${x - 4} ${4 + (i % 2)} L${x + 5} ${19 - (i % 3)}`} strokeWidth="1.8" />
      ))}
    </svg>
  );
}

export function Tally({ count, className }: Props & { count: number }) {
  const groups = Math.floor(count / 5);
  const rest = count % 5;
  const marks: ReactElement[] = [];
  let x = 4;
  for (let g = 0; g < groups; g += 1) {
    for (let i = 0; i < 4; i += 1) {
      marks.push(<path key={`${g}-${i}`} d={`M${x + i * 7} ${5 + (i % 2)} L${x + i * 7 + 1.5} ${35 - (i % 3)}`} />);
    }
    marks.push(<path key={`${g}-x`} d={`M${x - 4} 30 L${x + 26} 9`} />);
    x += 40;
  }
  for (let i = 0; i < rest; i += 1) marks.push(<path key={`r-${i}`} d={`M${x + i * 7} 6 L${x + i * 7 + 1} 34`} />);
  const width = Math.max(x + rest * 7 + 4, 40);
  return (
    <svg {...base} className={className} viewBox={`0 0 ${width} 40`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      {marks}
    </svg>
  );
}

export function Blot({ className }: Props) {
  return (
    <svg {...base} className={className} viewBox="0 0 100 100" fill="currentColor">
      <path d="M52 14c9 1 11 12 19 14s18-2 19 7-9 12-8 21 10 15 3 22-15-1-22 4-8 15-17 14-8-11-16-15-19 0-21-9 9-12 8-20-12-13-6-20 15 0 21-6 11-13 20-12z" />
      <circle cx="88" cy="18" r="4" />
      <circle cx="14" cy="86" r="3" />
      <circle cx="94" cy="70" r="2" />
    </svg>
  );
}

export function CoffeeRing({ className }: Props) {
  return (
    <svg {...base} className={className} viewBox="0 0 160 160" fill="none" stroke="currentColor">
      <path d="M80 12c39 0 68 28 67 66-1 40-30 70-69 69-37-1-65-31-64-69 1-37 30-66 66-66z" strokeWidth="5" strokeOpacity="0.55" />
      <path d="M81 20c33 1 59 25 58 59-1 34-27 61-60 60-32 0-57-27-56-61 2-31 27-58 58-58z" strokeWidth="1.5" strokeOpacity="0.35" />
      <path d="M134 120c6 6 10 13 9 18" strokeWidth="3" strokeOpacity="0.4" />
    </svg>
  );
}

export function WaxSeal({ className, text }: Props & { text: string }) {
  return (
    <svg {...base} className={className} viewBox="0 0 120 120">
      <path
        d="M60 6c8 0 10 6 17 8s13-2 18 4 1 12 4 18 10 9 10 16-6 10-7 17 4 13-1 19-12 3-18 7-8 12-15 12-11-7-18-9-13 3-18-3-1-12-5-18-11-8-11-16 7-11 8-17-3-12 2-18 12-1 18-5 9-15 16-15z"
        fill="#6e1712"
      />
      <circle cx="60" cy="60" r="34" fill="none" stroke="#3d0a07" strokeWidth="3" />
      <circle cx="60" cy="60" r="29" fill="none" stroke="#a8392c" strokeWidth="1" strokeDasharray="3 3" />
      <text x="60" y="66" textAnchor="middle" fill="#f1d9c4" fontFamily="ui-monospace, Menlo, monospace" fontSize="17" fontWeight="700">
        {text}
      </text>
    </svg>
  );
}

export function PencilLine({ className }: Props) {
  return (
    <svg {...base} className={className} viewBox="0 0 200 12" fill="none" stroke="currentColor" strokeLinecap="round" preserveAspectRatio="none">
      <path d="M3 8 C 40 5, 80 9, 120 6 S 180 4, 197 7" strokeWidth="2" />
      <path d="M30 9 C 70 8, 120 10, 170 7" strokeWidth="0.8" strokeOpacity="0.6" />
    </svg>
  );
}

export function Bat({ className }: Props) {
  return (
    <svg {...base} className={className} viewBox="0 0 64 28" fill="currentColor">
      <path d="M32 9c2-4 3-6 3-6l1 4c3 0 5 2 6 4 4-5 10-7 22-6-5 2-7 6-7 10-3-2-6-2-8 1-2-2-5-2-7 1-2-1-4-1-6 3l-4 6-4-6c-2-4-4-4-6-3-2-3-5-3-7-1-2-3-5-3-8-1 0-4-2-8-7-10 12-1 18 1 22 6 1-2 3-4 6-4l1-4s1 2 3 6z" />
    </svg>
  );
}
