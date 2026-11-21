// Dependency-free constants and types shared by the models and their
// consumers. Importable as "db/constants" without loading mongoose.

export type MonitorMethod = "GET" | "HEAD" | "POST";

/**
 * "http": we fetch the URL on a schedule.
 * "heartbeat": the user's job pings us; we alert when a ping is overdue.
 */
export type MonitorType = "http" | "heartbeat";

/** Allowed check intervals (or expected ping periods), in seconds. */
export const MONITOR_INTERVALS = [
  60, 120, 300, 600, 900, 1800, 3600, 6 * 3600, 12 * 3600, 24 * 3600,
] as const;

/** Defaults applied to monitors (including legacy documents missing a field). */
export const MONITOR_DEFAULTS = {
  type: "http" as MonitorType,
  method: "GET" as MonitorMethod,
  intervalSeconds: 60,
  timeoutMs: 10_000,
  expectedStatus: "200-399",
  keyword: "",
  followRedirects: true,
  failureThreshold: 2,
  paused: false,
  /** Heartbeats: extra time allowed past the period before a ping is overdue. */
  graceSeconds: 300,
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
  | "MISSED"
  | "UNKNOWN";

export const CHECK_ERROR_TYPES: CheckErrorType[] = [
  "DNS",
  "TIMEOUT",
  "CONNECTION",
  "TLS",
  "HTTP_STATUS",
  "KEYWORD",
  "BLOCKED",
  "MISSED",
  "UNKNOWN",
];

export type AlertChannelType = "email" | "slack" | "discord" | "webhook";

export const ALERT_CHANNEL_TYPES: AlertChannelType[] = ["email", "slack", "discord", "webhook"];
