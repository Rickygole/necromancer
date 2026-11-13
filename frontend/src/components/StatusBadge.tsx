import { toneOf } from "../status";
import type { Status } from "../types";

function Icon({ status }: { status: Status }) {
  const common = {
    width: "1em",
    height: "1em",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };
  switch (status) {
    case "MATCH":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M5 8.2l2 2 4-4.4" />
        </svg>
      );
    case "MISMATCH":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" />
        </svg>
      );
    case "BUILD FAILED":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <path d="M4.5 11.5l7-7" />
        </svg>
      );
    case "RUNTIME ERROR":
      return (
        <svg {...common}>
          <path d="M8 1.8l6.4 11.4H1.6z" />
          <path d="M8 6.2v3.2M8 11.4v.1" />
        </svg>
      );
    case "APPROVAL REQUIRED":
      return (
        <svg {...common}>
          <path d="M8 1.5l6.5 6.5L8 14.5 1.5 8z" />
          <path d="M8 5v3.6M8 10.8v.1" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.5" strokeDasharray="2.4 2.2" />
        </svg>
      );
  }
}

export function StatusBadge({ status, size = "sm" }: { status: Status; size?: "sm" | "lg" }) {
  return (
    <span className={`status status--${toneOf(status)} status--${size}`}>
      <Icon status={status} />
      <span>{status}</span>
    </span>
  );
}
