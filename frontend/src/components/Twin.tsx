import { useMemo } from "react";
import { TRACE_POSITIONS, firedBits } from "../records";
import type { FocusTrace } from "../types";
import { useText } from "../useText";
import { SourceViewer } from "./SourceViewer";
import { TraceTable } from "./TraceTable";

interface Props {
  focus: FocusTrace | null;
  open: boolean;
}

export function Twin({ focus, open }: Props) {
  const { text, error } = useText("/modern/calculator.py");
  const fired = useMemo(() => firedBits(focus?.twin), [focus]);

  const lit = useMemo(() => {
    const map = new Map<number, string>();
    if (!text) return map;
    const names = new Map<string, string[]>();
    for (const p of TRACE_POSITIONS) {
      if (!fired.has(p.pos)) continue;
      const list = names.get(p.python) ?? [];
      list.push(p.label);
      names.set(p.python, list);
    }
    text.split("\n").forEach((line, index) => {
      const def = /^def (\w+)\(/.exec(line);
      if (def && names.has(def[1])) map.set(index, names.get(def[1])!.join(", "));
    });
    return map;
  }, [text, fired]);

  return (
    <section className="pane pane--twin" aria-labelledby="twin-title">
      <header className="pane__head">
        <h2 id="twin-title">The Resurrected Twin</h2>
        <p className="pane__sub">Python twin, calculator.py</p>
      </header>

      <div className="block">
        <div className="block__head">
          <h3>Trace comparison</h3>
          <p className="hint">{focus ? focus.source : "No trace selected"}</p>
        </div>
        {focus ? (
          <TraceTable oracle={focus.oracle} twin={focus.twin} caption="Oracle and twin rule trace" />
        ) : (
          <p className="empty">No trace picked. Run a comparison or choose a sample claim and both traces line up here.</p>
        )}
      </div>

      <div className="block">
        <div className="block__head">
          <h3>Source</h3>
          <p className="hint">{lit.size ? `${lit.size} functions lit` : "Nothing lit"}</p>
        </div>
        <SourceViewer label="calculator.py source" text={text} error={error} lit={lit} active={open} />
      </div>

    </section>
  );
}
