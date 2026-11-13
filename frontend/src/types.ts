export type Status =
  | "NOT RUN"
  | "BUILD FAILED"
  | "MATCH"
  | "MISMATCH"
  | "RUNTIME ERROR"
  | "APPROVAL REQUIRED";

export type Profile = "dev" | "demo" | "full";

export interface Health {
  version: string;
  compiler: string;
  oracle_available: boolean;
  hosted: boolean;
}

export interface Mutation {
  id: string;
  label: string;
  description: string;
}

export interface DiffEntry {
  field: string;
  oracle: string;
  twin: string;
}

export interface TraceDiff {
  oracle: string;
  twin: string;
}

export interface Counterexample {
  id: string;
  seed: number;
  input_record: string;
  oracle_output: string;
  twin_output: string;
  diff: DiffEntry[];
  trace_diff: TraceDiff;
  class: string;
  decision: unknown;
  family?: string;
  mutation?: string | null;
}

export interface Report {
  run_id: string;
  profile: string;
  seed: number;
  mutation: string | null;
  verdict: string;
  cases: number;
  matched: number;
  mismatched: number;
  compiler: string;
  source_hash: string;
  twin_hash: string;
  limitations: string[];
  decision_coverage?: { undecided?: string[]; observed?: string[] };
  seconds?: number;
  mutation_score?: number | string | null;
}

export interface RunEvent {
  type: string;
  cases?: number;
  matched?: number;
  planned?: number;
  mismatched?: number;
  family?: string;
  verdict?: string;
  payload?: Counterexample;
  code?: string;
  message?: string;
  detail?: unknown;
}

export interface Snapshot extends Report {
  counterexamples: Counterexample[];
  events: RunEvent[];
}

export interface RunRequest {
  profile: Profile;
  seed?: number;
  mutation?: string;
  use_demo_config?: boolean;
}

export interface Decision {
  class: string;
  field: string;
  counterexample_ids: string[];
  options_considered: string[];
  choice: "preserve" | "correct";
  reviewer: string;
  note: string;
}

export interface FocusTrace {
  oracle: string;
  twin: string;
  source: string;
}
