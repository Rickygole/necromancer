import probes from "./generated/carddemo/probes.json";
import report from "./generated/carddemo/report.json";
import { REPO_URL } from "./content";

export const CARDDEMO_REPORT = report;
export const CARDDEMO_PROBES = probes;

export const CARDDEMO_UPSTREAM = "https://github.com/aws-samples/aws-mainframe-modernization-carddemo";
export const CARDDEMO_COMMIT = "59cc6c2fd7ebd7ef7925cad552a01a4b8b6e4d5e";
export const CARDDEMO_SOURCE_URL = `${CARDDEMO_UPSTREAM}/blob/${CARDDEMO_COMMIT}/app/cbl/CBACT04C.cbl`;
export const CARDDEMO_TREE_URL = `${CARDDEMO_UPSTREAM}/tree/${CARDDEMO_COMMIT}`;
export const CARDDEMO_TWIN_COMMIT = "682c52e7140078cf8fec30070bade02e587d75c8";
export const CARDDEMO_TWIN_URL = `${REPO_URL}/commit/${CARDDEMO_TWIN_COMMIT}`;
export const CARDDEMO_README_URL = `${REPO_URL}/tree/main/case_studies/carddemo_interest`;
export const CARDDEMO_HREF = "#/legacy?carddemo";

export const CARDDEMO_PARAGRAPH = [
  "1300-COMPUTE-INTEREST.",
  "",
  "    COMPUTE WS-MONTHLY-INT",
  "     = ( TRAN-CAT-BAL * DIS-INT-RATE) / 1200",
  "",
  "    ADD WS-MONTHLY-INT  TO WS-TOTAL-INT",
  "    PERFORM 1300-B-WRITE-TX.",
].join("\n");

type Counterexample = (typeof report.counterexamples)[number];

export interface OutputField {
  key: "monthly" | "total";
  label: string;
  start: number;
}

export const CARDDEMO_OUTPUTS: OutputField[] = [
  { key: "monthly", label: "monthly interest", start: 0 },
  { key: "total", label: "total interest", start: 12 },
];

export interface Finding {
  key: string;
  title: string;
  cause: string;
  clause: string;
  scope: string;
  probe: string[];
  cx: Counterexample;
  cases: number;
}

const FINDINGS: Omit<Finding, "cx" | "cases" | "probe">[] = [
  {
    key: "truncation",
    title: "the result is truncated, not rounded",
    cause:
      "COMPUTE without ROUNDED stores the result in a two decimal field by dropping the extra digits, toward zero. The rewrite rounds half up to the cent, so they part ways whenever the dropped fraction is half a cent or more.",
    clause: "no ROUNDED",
    scope:
      "The source states no rounding rule. This is a defect only if rounding was intended. A team that decides truncation is the rule would call it no difference.",
  },
  {
    key: "monthly_overflow",
    title: "monthly interest silently drops its high digits",
    cause:
      "COMPUTE with no ON SIZE ERROR keeps the low order digits that fit in PIC S9(09)V99 and drops the rest without a word. The rewrite has no number that fits, so it reports a size error.",
    clause: "no ON SIZE ERROR",
    scope:
      "Reachable only at annual rates far above anything a real product uses. It matters for a rewrite that widens or changes the field, not for today's balances.",
  },
  {
    key: "total_overflow",
    title: "the running total silently wraps",
    cause:
      "ADD without ON SIZE ERROR keeps the low order digits of WS-TOTAL-INT, so a total that passes the top of the field starts again near zero. In the full program that total goes on to the account balance.",
    clause: "no ON SIZE ERROR",
    scope: "Needs no unusual rate, only a running total near the top of the field. A theoretical edge too, but an ordinary line carries it.",
  },
];

const PROBE_PREFIX: Record<string, string[]> = {
  truncation: ["PRB1"],
  monthly_overflow: ["PRB2:compute with"],
  total_overflow: ["PRB2:add with"],
};

function probeLines(key: string): string[] {
  const out: string[] = [];
  for (const spec of PROBE_PREFIX[key] ?? []) {
    const [name, filter] = spec.split(":");
    const lines = (probes as Record<string, unknown>)[name];
    if (!Array.isArray(lines)) continue;
    for (const line of lines) {
      if (typeof line !== "string") continue;
      if (!filter || line.startsWith(filter)) out.push(line);
    }
  }
  return out.slice(0, 2);
}

export const CARDDEMO_ROUNDED = probes.rounded_counterfactual;

export function causeCount(key: string): number {
  return Object.entries(report.classes).reduce(
    (sum, [name, n]) => (name.split("+").includes(key) ? sum + n : sum),
    0,
  );
}

export const CARDDEMO_FINDINGS: Finding[] = FINDINGS.flatMap((f) => {
  const cx = report.counterexamples.find((c) => c.class === f.key);
  return cx ? [{ ...f, cx, cases: causeCount(f.key), probe: probeLines(f.key) }] : [];
});

function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function money(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const raw = String(Math.abs(cents)).padStart(3, "0");
  return `${sign}${group(raw.slice(0, -2))}.${raw.slice(-2)}`;
}

export function rate(hundredths: number): string {
  return `${money(hundredths)} percent`;
}

export function signed(raw: string): string {
  const m = /^([+-])(\d+)$/.exec(raw);
  if (!m) return raw.trim().toLowerCase();
  const digits = m[2].padStart(3, "0");
  const whole = digits.slice(0, -2).replace(/^0+(?=\d)/, "");
  return `${m[1] === "-" ? "-" : ""}${group(whole)}.${digits.slice(-2)}`;
}

export function slot(output: string, field: OutputField): string {
  return output.slice(field.start, field.start + 12);
}

export function isSizeError(raw: string): boolean {
  return raw.trim() === "SIZE ERROR";
}

export function graveLine(cx: Counterexample): string {
  const v = cx.input_values;
  const differing = CARDDEMO_OUTPUTS.filter((f) => slot(cx.oracle_output, f) !== slot(cx.twin_output, f));
  const lead = differing[0];
  const earlier = v.initial_total_cents ? `, on an earlier total of ${money(v.initial_total_cents)}` : "";
  const head = `Here lies a balance of ${money(v.balance_cents)} at ${rate(v.annual_rate_hundredths_of_percent)}${earlier}`;
  if (!lead) return `${head}.`;
  const a = signed(slot(cx.oracle_output, lead));
  const b = slot(cx.twin_output, lead);
  const tail = isSizeError(b)
    ? `whose ${lead.label} the program stored as ${a}, where the rewrite found it too large for the field`
    : `whose ${lead.label} the program left at ${a} while the rewrite gave ${signed(b)}`;
  return `${head}, ${tail}.`;
}
