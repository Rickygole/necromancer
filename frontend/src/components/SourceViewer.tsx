import { useEffect, useMemo, useRef } from "react";

interface Props {
  label: string;
  text: string | null;
  error: string | null;
  lit: Map<number, string>;
  window?: [number, number] | null;
}

export function SourceViewer({ label, text, error, lit, window: range }: Props) {
  const scroller = useRef<HTMLPreElement>(null);
  const lines = useMemo(() => (text ? text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n") : []), [text]);
  const firstLit = useMemo(() => {
    let min = Infinity;
    for (const key of lit.keys()) min = Math.min(min, key);
    return Number.isFinite(min) ? min : null;
  }, [lit]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || firstLit === null) return;
    const row = el.querySelector<HTMLElement>(`[data-line="${firstLit}"]`);
    if (!row) return;
    const target = row.offsetTop - el.clientHeight / 3;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
  }, [firstLit, lines]);

  if (error) {
    return (
      <div className="source source--empty" role="note">
        <p>Source not available. {error}</p>
      </div>
    );
  }

  if (!text) {
    return (
      <div className="source source--loading" aria-busy="true" aria-label={`${label}, loading`}>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="skeleton-line" style={{ width: `${40 + ((i * 37) % 50)}%` }} />
        ))}
      </div>
    );
  }

  const [from, to] = range ?? [0, lines.length];

  return (
    <pre ref={scroller} className="source" tabIndex={0} aria-label={label}>
      <code>
        {lines.slice(from, to).map((line, offset) => {
          const index = from + offset;
          const note = lit.get(index);
          return (
            <span key={index} data-line={index} className={note ? "source__line is-lit" : "source__line"}>
              <span className="source__mark" aria-hidden="true">{note ? "◆" : ""}</span>
              <span className="source__num" aria-hidden="true">{index + 1}</span>
              <span className="source__text">{line || " "}</span>
              {note ? <span className="visually-hidden"> (fired: {note})</span> : null}
            </span>
          );
        })}
      </code>
    </pre>
  );
}
