import { TRACE_POSITIONS } from "../records";

interface Props {
  oracle: string;
  twin: string;
  caption: string;
}

export function TraceTable({ oracle, twin, caption }: Props) {
  const differences = TRACE_POSITIONS.filter((p) => (oracle[p.pos - 1] ?? "0") !== (twin[p.pos - 1] ?? "0")).length;
  return (
    <div className="trace-wrap">
      <table className="trace">
        <caption>
          {caption}
          <span className="trace__summary">
            {differences === 0 ? "All 10 bits agree" : `${differences} of 10 bits differ`}
          </span>
        </caption>
        <thead>
          <tr>
            <th scope="col" className="trace__corner">Bit</th>
            {TRACE_POSITIONS.map((p) => (
              <th key={p.pos} scope="col" title={p.label}>
                <abbr title={p.label}>{p.pos}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["Oracle", "Twin"] as const).map((who) => {
            const bits = who === "Oracle" ? oracle : twin;
            return (
              <tr key={who}>
                <th scope="row">{who}</th>
                {TRACE_POSITIONS.map((p) => {
                  const value = bits[p.pos - 1] ?? "0";
                  const other = (who === "Oracle" ? twin : oracle)[p.pos - 1] ?? "0";
                  const differs = value !== other;
                  const cls = ["trace__cell", value === "1" ? "is-on" : "is-off", differs ? "is-diff" : ""].join(" ");
                  return (
                    <td key={p.pos} className={cls}>
                      <span aria-hidden="true">{value}</span>
                      <span className="visually-hidden">
                        {p.label} {value === "1" ? "fired" : "not fired"}
                        {differs ? ", differs" : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="trace__diffrow">
            <th scope="row">Diff</th>
            {TRACE_POSITIONS.map((p) => {
              const differs = (oracle[p.pos - 1] ?? "0") !== (twin[p.pos - 1] ?? "0");
              return (
                <td key={p.pos} className={differs ? "trace__flag is-diff" : "trace__flag"}>
                  <span aria-hidden="true">{differs ? "≠" : ""}</span>
                  <span className="visually-hidden">{differs ? "differs" : "same"}</span>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
