// Dependency-free constants and types shared by the models and their
// consumers. Importable as "db/constants" without loading mongoose.

export type MonitorMethod = "GET" | "HEAD" | "POST";

/** Allowed check intervals, in seconds. */
export const MONITOR_INTERVALS = [60, 120, 300, 600, 900, 1800, 3600] as const;

/** Defaults applied to monitors (including legacy documents missing a field). */
export const MONITOR_DEFAULTS = {
  method: "GET" as MonitorMethod,
  intervalSeconds: 60,
  timeoutMs: 10_000,
  expectedStatus: "200-399",
  keyword: "",
  followRedirects: true,
  failureThreshold: 2,
  paused: false,
};

/** Why a check failed. Null for successful checks. */
export type CheckErrorType =
  | "DNS"
  | "TIMEOUT"
  | "CONNECTION"
  | "TLS"
  | "HTTP_STATUS"
  | "KEYWORD"
  | "BLOCKED"
  | "UNKNOWN";

export const CHECK_ERROR_TYPES: CheckErrorType[] = [
  "DNS",
  "TIMEOUT",
  "CONNECTION",
  "TLS",
  "HTTP_STATUS",
  "KEYWORD",
  "BLOCKED",
  "UNKNOWN",
];
