import { useEffect, useState } from "react";
import { api } from "./api";
import type { MutationScore } from "./types";

export const REPO_URL = "https://github.com/Rickygole/necromancer";

export interface Rule {
  id: string;
  name: string;
  text: string;
}

export const RULES: Rule[] = [
  {
    id: "R0",
    name: "Validation",
    text: "A record that is not exactly 80 bytes, has a non digit in a numeric field, or has an unknown retirement code or boundary flag gets status 99 and every amount zero.",
  },
  { id: "R1", name: "Quarter boundary", text: "When the boundary flag is Y, Q4 wages count as zero." },
  {
    id: "R2",
    name: "Insufficient wages",
    text: "Total base wages are Q1 + Q2 + Q3 + Q4. Below 2,500.00 the claim gets status 01.",
  },
  { id: "R3", name: "Single quarter", text: "Fewer than two quarters with wages above zero gives status 02." },
  {
    id: "R4",
    name: "Base benefit",
    text: "High quarter divided by 26, truncated to a whole dollar, capped at 650.00.",
  },
  { id: "R5", name: "Dependency allowance", text: "25.00 per dependent, up to 4 dependents." },
  {
    id: "R6",
    name: "Wage ceiling",
    text: "The combined benefit is capped at 65 percent of total base wages divided by 52, truncated to cents.",
  },
  {
    id: "R7",
    name: "Offset",
    text: "Weekly pension at 100 percent plus weekly severance at 50 percent. Zero when age is 62 or more and the retirement code is M.",
  },
  { id: "R8", name: "Net payout", text: "Combined benefit less the offset, never below zero." },
];

export interface Quirk {
  id: string;
  name: string;
  decision: string;
  field: string;
  cause: string;
  code: string;
  steps: string[];
  rules: string;
  legacy: string;
  rulesLabel?: string;
  legacyLabel?: string;
  note: string;
}

export const QUIRKS: Quirk[] = [
  {
    id: "Q1",
    name: "Narrow quotient overflow",
    decision: "dec_0001",
    field: "base",
    cause: "The quotient is stored in three digits, so it wraps modulo 1000. A high quarter of 26,000.00 gives quotient 1000, which wraps to 000, and the cap test never fires.",
    code: "01  WS-QUOTIENT   PIC 9(3).\nCOMPUTE WS-QUOTIENT = WS-HIGH / 26",
    steps: [
      "High quarter 26,000.00",
      "26,000.00 / 26 = 1000",
      "PIC 9(3) stores 1000 modulo 1000 = 000",
      "000 is not above 650, so the cap never fires",
    ],
    rules: "650.00",
    legacy: "0.00",
    rulesLabel: "the rules give a base of",
    legacyLabel: "the program stores a base of",
    note: "This is cx_0001: base 650.00 by the rules, 0.00 from the program. What that does to the weekly payout depends on the wage ceiling; in cx_0001 the rules pay 325.00 and the program pays 0.00. High quarters from 26,000.00 to 42,899.99 wrap to quotients 000 to 649 and get less than the cap. Wrapped quotients from 651 to 999 hit the cap again, and the pattern repeats every 26,000.00.",
  },
  {
    id: "Q2",
    name: "Unsigned subtraction keeps the absolute value",
    decision: "dec_0002",
    field: "net",
    cause: "The net field has no sign. Whenever the offset exceeds the combined benefit, the subtraction goes below zero and the program stores the absolute value. No wrap is needed.",
    code: "01  WS-NET   PIC 9(5)V99.\nCOMPUTE WS-NET = WS-COMBINED - WS-OFFSET",
    steps: [
      "cx_0002: base 96.00, no dependents",
      "The wage ceiling clamps the combined benefit to 31.25",
      "Offset 31.26",
      "31.25 less 31.26 = -0.01",
      "No sign position, so 0.01 is stored",
    ],
    rules: "0.00",
    legacy: "0.01",
    note: "Rule R8 says never below zero. Any offset larger than the benefit triggers it, and the amounts are not always pennies: q1 and q2 of 2,500.00 with a 100.00 pension pays 37.50 a week on the oracle, where the rules say 0.00. Mutation M4 is the polite fix, a clamp to zero, and because this case is so common it hits 1,646 of 4,090 cases.",
  },
  {
    id: "Q3",
    name: "Offset field wrap",
    decision: "dec_0003",
    field: "offset",
    cause: "The offset field holds five whole digits. A large pension plus half a large severance needs six, so the leading digit goes missing.",
    code: "01  WS-OFFSET   PIC 9(5)V99.\nCOMPUTE WS-OFFSET = CL-PEN + CL-SEV * 0.50",
    steps: ["Pension 99,999.99", "Severance 99,999.99 at 50 percent = 49,999.995", "Sum 149,999.985", "PIC 9(5)V99 keeps 49,999.98"],
    rules: "99,999.99",
    legacy: "49,999.98",
    rulesLabel: "the rules give an offset of",
    legacyLabel: "stored offset after the wrap",
    note: "The output field cannot hold 149,999.98, so the rules cap the offset at 99,999.99. The program instead loses exactly 100,000.00, and quirk 02 turns the result into money: q1 and q2 of 10,000.00 with pension 99,999.99 and severance 99,999.99 pays 49,749.98 a week on the oracle, where the rules pay 0.00.",
  },
];

export interface MutationRow {
  id: string;
  label: string;
  description: string;
  caught: number;
}

export const MUTATION_CASES = 4090;
export const DEMO_SEED = 731942;
export const DEMO_CASES = 3291;
export const INJECTED_MISMATCHED = 424;
export const FULL_CASES = 41260;
export const BASELINE_MISMATCHES = 0;

export const MUTATIONS: MutationRow[] = [
  { id: "M1", label: "round base", description: "Round the base weekly benefit half up instead of truncating it.", caught: 727 },
  { id: "M2", label: "cap off by one", description: "Base benefit cap is 651.00 instead of 650.00.", caught: 880 },
  { id: "M3", label: "exemption above 62", description: "Retirement exemption starts above age 62 instead of at 62.", caught: 97 },
  { id: "M4", label: "clamp net", description: "Explicitly clamp a negative net payout to zero.", caught: 1646 },
  { id: "M5", label: "early truncation", description: "Truncate total wages / 52 to cents before applying 65 percent.", caught: 119 },
];

export const HIDDEN_MUTANTS: { id: string; description: string; caught: number }[] = [
  { id: "H1", description: "Quarter counting ignores the quarter shift.", caught: 371 },
  { id: "H2", description: "Dependents above 12 are treated as 3.", caught: 1240 },
  { id: "H3", description: "Age is read modulo 18.", caught: 315 },
  { id: "H4", description: "The wage ceiling check trips when the benefit equals the ceiling.", caught: 1 },
  { id: "H5", description: "A quarter counts only at 1.00 or more instead of above zero.", caught: 1 },
];

export const STAGED: string[] = [
  "UICALC is synthetic. It was written for this project, and its rules are not any state's law.",
  "The three legacy quirks were planted on purpose, then measured on the real GnuCOBOL compiler.",
  "The mismatch in the guided demo is an injected mutation, M4, not a legacy finding.",
  "The three decisions are preserve choices that the reviewer delegated during the build. They are not yet confirmed.",
];

const FALLBACK_SCORE: MutationScore = {
  cases: MUTATION_CASES,
  baseline_mismatches: BASELINE_MISMATCHES,
  named: Object.fromEntries(MUTATIONS.map((m) => [m.id, m.caught])),
  named_caught: MUTATIONS.filter((m) => m.caught > 0).length,
  named_total: MUTATIONS.length,
  hidden: Object.fromEntries(HIDDEN_MUTANTS.map((h) => [h.id, h.caught])),
  hidden_caught: HIDDEN_MUTANTS.filter((h) => h.caught > 0).length,
  hidden_total: HIDDEN_MUTANTS.length,
};

export function useMutationScore() {
  const [score, setScore] = useState<MutationScore>(FALLBACK_SCORE);
  useEffect(() => {
    let live = true;
    api
      .mutationScore()
      .then((value) => {
        if (live && value && typeof value.cases === "number" && value.named && value.hidden) setScore(value);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return score;
}

export interface Property {
  id: string;
  name: string;
  text: string;
}

export const PROPERTIES: Property[] = [
  { id: "P1", name: "Differential agreement", text: "On every generated batch the twin's output equals the oracle's." },
  { id: "P2", name: "Totality", text: "Each program returns exactly one well formed result per input, in order." },
  { id: "P3", name: "Determinism", text: "The same batch run twice gives identical output." },
  { id: "P4", name: "Batch independence", text: "Permuting a batch permutes the results and changes nothing else." },
  { id: "P5", name: "Record round trip", text: "Formatting a parsed record returns the original bytes." },
  { id: "P6", name: "Offset direction", text: "Raising severance or pension never raises the net payout." },
  { id: "P7", name: "Wage monotonicity", text: "Raising the high quarter never lowers the base benefit." },
  { id: "P8", name: "Limits", text: "The base never exceeds 650.00 and the combined benefit never exceeds the wage ceiling." },
  { id: "P9", name: "Eligibility consistency", text: "Any status other than 00 means every amount is zero." },
  { id: "P10", name: "No floats", text: "The twin uses Decimal only." },
  { id: "P11", name: "Decision coverage", text: "Every observed class of mismatch has a decision record." },
];

export const PICTURES: Record<string, string> = {
  id: "X(9)",
  q1: "9(7)V99",
  q2: "9(7)V99",
  q3: "9(7)V99",
  q4: "9(7)V99",
  dependents: "9(2)",
  age: "9(2)",
  retirement: "X",
  pension: "9(5)V99",
  severance: "9(5)V99",
  boundary: "X",
  filler: "X(15)",
  status: "9(2)",
  base: "9(5)V99",
  allowance: "9(5)V99",
  offset: "9(5)V99",
  net: "9(5)V99",
  trace: "X(10)",
};

export const REPO_TREE: { path: string; text: string }[] = [
  { path: "legacy/", text: "UICALC.cbl and the semantics probes" },
  { path: "oracle/", text: "build script, batch runner, probe runner" },
  { path: "modern/", text: "the Python twin, one function per COBOL paragraph" },
  { path: "harness/", text: "corpus, comparator, shrinking, engine, mutation score" },
  { path: "backend/", text: "FastAPI app, SQLite store, recorded patches" },
  { path: "frontend/", text: "this site and the console" },
  { path: "oracle_mcp/", text: "MCP server that exposes the oracle" },
  { path: "decisions/", text: "decision records (the reviewer delegated the three choices) and the incident log" },
  { path: "evidence/", text: "probe report, counterexamples, mutation score, snapshot" },
  { path: "tests/", text: "unit, property, mutation and API tests" },
  { path: ".kiro/", text: "specs, steering, hooks, agents, and the oracle MCP server registration" },
];
