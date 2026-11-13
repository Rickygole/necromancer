export type FieldKind = "text" | "money" | "int" | "code" | "trace" | "status";

export interface FieldSpec {
  key: string;
  label: string;
  start: number;
  end: number;
  kind: FieldKind;
}

export const INPUT_FIELDS: FieldSpec[] = [
  { key: "id", label: "Claimant id", start: 1, end: 9, kind: "text" },
  { key: "q1", label: "Q1 wages", start: 10, end: 18, kind: "money" },
  { key: "q2", label: "Q2 wages", start: 19, end: 27, kind: "money" },
  { key: "q3", label: "Q3 wages", start: 28, end: 36, kind: "money" },
  { key: "q4", label: "Q4 wages", start: 37, end: 45, kind: "money" },
  { key: "dependents", label: "Dependents", start: 46, end: 47, kind: "int" },
  { key: "age", label: "Age", start: 48, end: 49, kind: "int" },
  { key: "retirement", label: "Retirement code", start: 50, end: 50, kind: "code" },
  { key: "pension", label: "Pension", start: 51, end: 57, kind: "money" },
  { key: "severance", label: "Severance", start: 58, end: 64, kind: "money" },
  { key: "boundary", label: "Boundary flag", start: 65, end: 65, kind: "code" },
  { key: "filler", label: "Filler", start: 66, end: 80, kind: "text" },
];

export const OUTPUT_FIELDS: FieldSpec[] = [
  { key: "status", label: "Status", start: 1, end: 2, kind: "status" },
  { key: "base", label: "Base", start: 3, end: 9, kind: "money" },
  { key: "allowance", label: "Allowance", start: 10, end: 16, kind: "money" },
  { key: "offset", label: "Offset", start: 17, end: 23, kind: "money" },
  { key: "net", label: "Net", start: 24, end: 30, kind: "money" },
  { key: "trace", label: "Trace", start: 31, end: 40, kind: "trace" },
];

export interface TracePosition {
  pos: number;
  label: string;
  paragraph: string;
  python: string;
}

export const TRACE_POSITIONS: TracePosition[] = [
  { pos: 1, label: "Input rejected", paragraph: "2300-REJECT", python: "validate" },
  { pos: 2, label: "Quarter shift", paragraph: "3100-QUARTER-SHIFT", python: "quarter_shift" },
  { pos: 3, label: "Insufficient wages", paragraph: "3000-DETERMINE", python: "total_wages" },
  { pos: 4, label: "Single quarter", paragraph: "3000-DETERMINE", python: "count_quarters" },
  { pos: 5, label: "High quarter formula", paragraph: "4100-BASE-BENEFIT", python: "base_benefit" },
  { pos: 6, label: "Cap clamped base", paragraph: "4100-BASE-BENEFIT", python: "base_benefit" },
  { pos: 7, label: "Dependency allowance", paragraph: "4200-DEPENDENCY-ALLOWANCE", python: "dependency_allowance" },
  { pos: 8, label: "Wage ceiling clamped", paragraph: "4300-WAGE-CEILING", python: "wage_ceiling" },
  { pos: 9, label: "Offset applied", paragraph: "4400-OFFSET", python: "offset" },
  { pos: 10, label: "Retirement exemption", paragraph: "4400-OFFSET", python: "offset" },
];

export function slice(record: string, field: FieldSpec): string {
  return record.slice(field.start - 1, field.end);
}

export function formatValue(raw: string, kind: FieldKind): string {
  if (kind === "money") {
    if (!/^\d+$/.test(raw)) return raw;
    const cents = raw.padStart(3, "0");
    const whole = cents.slice(0, -2).replace(/^0+(?=\d)/, "");
    return `${Number(whole).toLocaleString("en-US")}.${cents.slice(-2)}`;
  }
  if (kind === "int") {
    return /^\d+$/.test(raw) ? String(Number(raw)) : raw;
  }
  if (kind === "text") {
    return raw.trim() === "" ? "(blank)" : raw.trimEnd();
  }
  if (kind === "code") {
    return raw === " " ? "(blank)" : raw;
  }
  return raw;
}

export function firedBits(trace: string | undefined | null): Set<number> {
  const bits = new Set<number>();
  if (!trace) return bits;
  for (let i = 0; i < Math.min(trace.length, 10); i += 1) {
    if (trace[i] === "1") bits.add(i + 1);
  }
  return bits;
}
