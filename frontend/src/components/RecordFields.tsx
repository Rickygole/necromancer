import { formatValue, slice, type FieldSpec } from "../records";

interface Props {
  record: string;
  fields: FieldSpec[];
  caption: string;
  hideFiller?: boolean;
}

export function RecordFields({ record, fields, caption, hideFiller }: Props) {
  const shown = hideFiller ? fields.filter((f) => f.key !== "filler") : fields;
  return (
    <table className="fields">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Field</th>
          <th scope="col">Cols</th>
          <th scope="col">Raw</th>
          <th scope="col">Value</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((field) => {
          const raw = slice(record, field);
          return (
            <tr key={field.key}>
              <th scope="row">{field.label}</th>
              <td className="num">
                {field.start === field.end ? field.start : `${field.start} to ${field.end}`}
              </td>
              <td className="mono raw">{raw.replace(/ /g, "·")}</td>
              <td className="mono">{formatValue(raw, field.kind)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function OutputDiff({
  oracle,
  twin,
  fields,
}: {
  oracle: string;
  twin: string;
  fields: FieldSpec[];
}) {
  return (
    <table className="fields fields--diff">
      <caption>Outputs, field by field</caption>
      <thead>
        <tr>
          <th scope="col">Field</th>
          <th scope="col">Oracle</th>
          <th scope="col">Twin</th>
          <th scope="col">
            <span className="visually-hidden">Agreement</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => {
          const a = slice(oracle, field);
          const b = slice(twin, field);
          const differs = a !== b;
          return (
            <tr key={field.key} className={differs ? "is-diff" : undefined}>
              <th scope="row">{field.label}</th>
              <td className="mono">{formatValue(a, field.kind)}</td>
              <td className="mono">{formatValue(b, field.kind)}</td>
              <td className="agree">
                <span aria-hidden="true">{differs ? "≠" : "="}</span>
                <span className="visually-hidden">{differs ? "differs" : "same"}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
