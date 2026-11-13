import type { Status } from "./types";

export const STATUSES: Status[] = [
  "NOT RUN",
  "BUILD FAILED",
  "MATCH",
  "MISMATCH",
  "RUNTIME ERROR",
  "APPROVAL REQUIRED",
];

export type Tone = "idle" | "match" | "mismatch" | "error" | "approval";

export function toStatus(value: unknown): Status {
  if (typeof value !== "string") return "NOT RUN";
  const normal = value.trim().toUpperCase().replace(/[_-]+/g, " ");
  const found = STATUSES.find((status) => status === normal);
  if (found) return found;
  if (normal === "BUILD ERROR") return "BUILD FAILED";
  if (normal === "ERROR" || normal === "ORACLE TIMEOUT") return "RUNTIME ERROR";
  return "RUNTIME ERROR";
}

export function toneOf(status: Status): Tone {
  switch (status) {
    case "MATCH":
      return "match";
    case "MISMATCH":
      return "mismatch";
    case "BUILD FAILED":
    case "RUNTIME ERROR":
      return "error";
    case "APPROVAL REQUIRED":
      return "approval";
    default:
      return "idle";
  }
}

const numberFormat = new Intl.NumberFormat("en-US");

export function count(value: number): string {
  return numberFormat.format(Math.max(0, Math.round(value)));
}

export function casesOf(done: number, planned: number): string {
  const total = Math.max(planned, done);
  return `${count(done)} of ${count(total)} cases`;
}
