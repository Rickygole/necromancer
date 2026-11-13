import { useMemo } from "react";
import { SAMPLE_CLAIMS } from "../data";
import { INPUT_FIELDS, OUTPUT_FIELDS, TRACE_POSITIONS, firedBits } from "../records";
import type { FocusTrace } from "../types";
import { useText } from "../useText";
import { RecordFields } from "./RecordFields";
import { SourceViewer } from "./SourceViewer";

interface Props {
  focus: FocusTrace | null;
  claimId: string;
  onPickClaim: (id: string) => void;
}

export function Crypt({ focus, claimId, onPickClaim }: Props) {
  const { text, error } = useText("/legacy/UICALC.cbl");
  const fired = useMemo(() => firedBits(focus?.oracle), [focus]);
  const claim = SAMPLE_CLAIMS.find((c) => c.id === claimId) ?? SAMPLE_CLAIMS[0];

  const lit = useMemo(() => {
    const map = new Map<number, string>();
    if (!text) return map;
    const firedParagraphs = new Map<string, string[]>();
    for (const p of TRACE_POSITIONS) {
      if (!fired.has(p.pos)) continue;
      const list = firedParagraphs.get(p.paragraph) ?? [];
      list.push(p.label);
      firedParagraphs.set(p.paragraph, list);
    }
    text.split("\n").forEach((line, index) => {
      const header = /^\s*(\d{4}-[A-Z0-9-]+)\.\s*$/.exec(line);
      if (header && firedParagraphs.has(header[1])) {
        map.set(index, firedParagraphs.get(header[1])!.join(", "));
        return;
      }
      const bit = /WS-TRACE\((\d+):1\)/.exec(line);
      if (bit && fired.has(Number(bit[1]))) {
        const pos = TRACE_POSITIONS[Number(bit[1]) - 1];
        map.set(index, `bit ${pos.pos}, ${pos.label}`);
      }
    });
    return map;
  }, [text, fired]);

  return (
    <section className="pane pane--crypt" aria-labelledby="crypt-title">
      <header className="pane__head">
        <h2 id="crypt-title">The Crypt</h2>
        <p className="pane__sub">Legacy source, UICALC.cbl</p>
      </header>

      <div className="block">
        <div className="block__head">
          <h3>Rule trace</h3>
          <p className="hint">{focus ? `Oracle trace from ${focus.source}` : "Pick a claim or a counterexample"}</p>
        </div>
        <ol className="paragraphs">
          {TRACE_POSITIONS.map((p) => {
            const on = fired.has(p.pos);
            return (
              <li key={p.pos} className={on ? "paragraph is-lit" : "paragraph"}>
                <span className="paragraph__pos" aria-hidden="true">{p.pos}</span>
                <span className="paragraph__name mono">{p.paragraph}</span>
                <span className="paragraph__label">{p.label}</span>
                <span className="paragraph__state">
                  <span aria-hidden="true">{on ? "◆" : "◇"}</span>
                  <span className="visually-hidden">{on ? "fired" : "not fired"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="block">
        <div className="block__head">
          <h3>Source</h3>
          <p className="hint">{lit.size ? `${lit.size} lines lit` : "Nothing lit"}</p>
        </div>
        <SourceViewer label="UICALC.cbl source" text={text} error={error} lit={lit} />
      </div>

      <div className="block">
        <div className="block__head">
          <h3>
            <label htmlFor="claim-picker">Sample claim</label>
          </h3>
        </div>
        <select id="claim-picker" className="input" value={claim.id} onChange={(e) => onPickClaim(e.target.value)}>
          {SAMPLE_CLAIMS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}, {c.title}
            </option>
          ))}
        </select>
        <p className="record mono" role="group" aria-label="Raw 80 byte input record">
          {claim.record.replace(/ /g, "·")}
        </p>
        <RecordFields record={claim.record} fields={INPUT_FIELDS} caption="Input record layout, 80 bytes" />
        <RecordFields
          record={claim.output}
          fields={OUTPUT_FIELDS}
          caption="Recorded twin output, 40 bytes"
        />
      </div>
    </section>
  );
}
