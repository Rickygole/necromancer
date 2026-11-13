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
  note: string;
}

export const QUIRKS: Quirk[] = [
  {
    id: "Q1",
    name: "Narrow quotient overflow",
    decision: "dec_0001",
    field: "base",
    cause: "The quotient field holds three digits. A high quarter of 26,000.00 or more divides out to four, and the top digit falls off without a word.",
    code: "01  WS-QUOTIENT   PIC 9(3).\nCOMPUTE WS-QUOTIENT = WS-HIGH / 26",
    steps: ["High quarter 26,000.00", "26,000.00 / 26 = 1,000", "PIC 9(3) keeps 000", "000 is not above 650, so the cap never fires"],
    rules: "650.00",
    legacy: "0.00",
    note: "The richest claimants get a base of nothing. The cap was supposed to be the ceiling, and it turned out to be a trapdoor.",
  },
  {
    id: "Q2",
    name: "Unsigned subtraction keeps the absolute value",
    decision: "dec_0002",
    field: "net",
    cause: "The net field has no sign. Once the base has already wrapped to zero, even a one cent offset pushes the subtraction below zero, and COBOL drops the minus.",
    code: "01  WS-NET   PIC 9(5)V99.\nCOMPUTE WS-NET = WS-COMBINED - WS-OFFSET",
    steps: [
      "High quarter 26,000.00, so the base wraps to 0.00",
      "No dependents, combined benefit 0.00",
      "Offset 0.01",
      "0.00 less 0.01 = -0.01",
      "No sign position, so 0.01 is stored",
    ],
    rules: "0.00",
    legacy: "0.01",
    note: "This one needs quirk 01 first. An eligible claim only reaches a combined benefit of 0.00 after the base wraps. Rule R8 says never below zero, and the program pays a penny. Mutation M4 is exactly the polite fix, which is why the harness flags it.",
  },
  {
    id: "Q3",
    name: "Offset field wrap",
    decision: "dec_0003",
    field: "offset",
    cause: "The offset field holds five whole digits. A large pension plus half a large severance needs six, so the leading digit goes missing.",
    code: "01  WS-OFFSET   PIC 9(5)V99.\nCOMPUTE WS-OFFSET = CL-PEN + CL-SEV * 0.50",
    steps: ["Pension 99,999.99", "Severance 99,999.99 at 50 percent = 49,999.995", "Sum 149,999.985", "PIC 9(5)V99 keeps 49,999.98"],
    rules: "149,999.98",
    legacy: "49,999.98",
    note: "The offset shrinks by exactly 100,000.00. Nobody files a claim like this, which is exactly how a bug like this survives.",
  },
];

export interface MutationRow {
  id: string;
  label: string;
  description: string;
  caught: number;
}

export const MUTATION_CASES = 4048;
export const DEMO_SEED = 731942;
export const DEMO_CASES = 3394;
export const INJECTED_MISMATCHED = 443;
export const FULL_CASES = 42137;
export const BASELINE_MISMATCHES = 0;

export const MUTATIONS: MutationRow[] = [
  { id: "M1", label: "round base", description: "Round the base weekly benefit half up instead of truncating it.", caught: 727 },
  { id: "M2", label: "cap off by one", description: "Base benefit cap is 651.00 instead of 650.00.", caught: 880 },
  { id: "M3", label: "exemption above 62", description: "Retirement exemption starts above age 62 instead of at 62.", caught: 97 },
  { id: "M4", label: "clamp net", description: "Explicitly clamp a negative net payout to zero.", caught: 1646 },
  { id: "M5", label: "early truncation", description: "Truncate total wages / 52 to cents before applying 65 percent.", caught: 112 },
];

export const HIDDEN_MUTANTS: { id: string; description: string }[] = [
  { id: "H1", description: "Quarter counting ignores the quarter shift." },
  { id: "H2", description: "Dependents above 12 are treated as 3." },
  { id: "H3", description: "Age is read modulo 18." },
];

export const STAGED: string[] = [
  "UICALC is synthetic. It was written for this project, and its rules are not any state's law.",
  "The three legacy quirks were planted on purpose, then measured on the real GnuCOBOL compiler.",
  "The mismatch in the guided demo is an injected mutation, M4, not a legacy finding.",
  "The three decisions are preserve choices that the reviewer delegated during the build. They are not yet confirmed.",
];

export interface Property {
  id: string;
  name: string;
  text: string;
}

export const PROPERTIES: Property[] = [
  { id: "P1", name: "Differential equivalence", text: "For any valid batch, the twin equals the oracle." },
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
  { path: "decisions/", text: "human authored decision records, nothing else" },
  { path: "evidence/", text: "probe report, counterexamples, mutation score, snapshot" },
  { path: "tests/", text: "unit, property, mutation and API tests" },
  { path: ".kiro/", text: "specs, steering, agents, settings" },
];
