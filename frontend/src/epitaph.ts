import { OUTPUT_FIELDS, TRACE_POSITIONS, formatValue, slice, type FieldSpec } from "./records";
import type { Counterexample } from "./types";

function isZero(raw: string): boolean {
  return /^0+$/.test(raw);
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function line(field: FieldSpec, oracle: string, twin: string): string {
  const name = field.label.toLowerCase();
  const a = formatValue(oracle, field.kind);
  const b = formatValue(twin, field.kind);
  if (field.kind === "money" && isZero(oracle) && !isZero(twin)) {
    return `whose ${name} the legacy program left at ${a} while the rewrite gave ${b}`;
  }
  if (field.kind === "money" && isZero(twin) && !isZero(oracle)) {
    return `whose ${name} the rewrite left at ${b} while the legacy program gave ${a}`;
  }
  return `whose ${name} was ${a} to the legacy program and ${b} to the rewrite`;
}

export function epitaph(cx: Counterexample): string {
  const differing = OUTPUT_FIELDS.filter(
    (f) => f.kind !== "trace" && slice(cx.oracle_output, f) !== slice(cx.twin_output, f),
  );
  if (differing.length > 0) {
    const lead = differing.find((f) => f.key === "net") ?? differing[0];
    const rest = differing.filter((f) => f !== lead).map((f) => f.label.toLowerCase());
    const head = `Here lies a claimant ${line(lead, slice(cx.oracle_output, lead), slice(cx.twin_output, lead))}.`;
    return rest.length ? `${head} The ${list(rest)} disagreed too.` : head;
  }
  const a = cx.trace_diff?.oracle ?? "";
  const b = cx.trace_diff?.twin ?? "";
  const split = TRACE_POSITIONS.filter((p) => a[p.pos - 1] !== b[p.pos - 1]).map((p) => p.label.toLowerCase());
  if (split.length > 0) return `Here lies a claimant whose rule trace split at ${list(split)}.`;
  return "Here lies a claimant.";
}
