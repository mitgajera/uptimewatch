// Dependency-free constants and types shared by the models and their
// consumers. Importable as "db/constants" without loading mongoose.

export const MONITOR_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as const;
export type MonitorMethod = (typeof MONITOR_METHODS)[number];
/** Methods that carry the monitor's request body. */
export const BODY_METHODS: readonly MonitorMethod[] = ["POST", "PUT", "PATCH"];

/**
 * "http": we fetch the URL on a schedule.
 * "tcp": we open a TCP connection to host:port.
 * "dns": we resolve a record for a host.
 * "heartbeat": the user's job pings us; we alert when a ping is overdue.
 */
export const MONITOR_TYPES = ["http", "tcp", "dns", "heartbeat"] as const;
export type MonitorType = (typeof MONITOR_TYPES)[number];

export const KEYWORD_MODES = ["contains", "absent"] as const;
export type KeywordMode = (typeof KEYWORD_MODES)[number];

export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

/** While down, re-alert every N minutes (0 = off). */
export const REMINDER_MINUTES = [0, 15, 30, 60, 240, 1440] as const;

/** Custom request header on an http monitor. */
export interface MonitorHeader {
  name: string;
  value: string;
}
export const MAX_MONITOR_HEADERS = 10;
export const MAX_MONITOR_BODY = 10_000;
/** Headers the HTTP client must control itself. */
export const FORBIDDEN_MONITOR_HEADERS = ["host", "content-length"];

export const MAX_MONITOR_TAGS = 10;
export const MONITOR_TAG_RE = /^[a-z0-9 _-]{1,24}$/;

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
  keywordMode: "contains" as KeywordMode,
  headers: [] as MonitorHeader[],
  body: "",
  followRedirects: true,
  failureThreshold: 2,
  paused: false,
  /** Heartbeats: extra time allowed past the period before a ping is overdue. */
  graceSeconds: 300,
  degradedThresholdMs: null as number | null,
  tags: [] as string[],
  alertChannelIds: [] as string[],
  reminderMinutes: 0,
  /** TCP/DNS target host; empty for http/heartbeat monitors. */
  host: "",
  /** TCP port; null for other monitor types. */
  port: null as number | null,
  dnsRecordType: "A" as DnsRecordType,
  dnsExpected: "",
};

/** Why a check failed. Null for successful checks. */
export type CheckErrorType =
  | "DNS"
  | "DNS_MISMATCH"
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
  "DNS_MISMATCH",
  "TIMEOUT",
  "CONNECTION",
  "TLS",
  "HTTP_STATUS",
  "KEYWORD",
  "BLOCKED",
  "MISSED",
  "UNKNOWN",
];

export type AlertChannelType =
  | "email"
  | "slack"
  | "discord"
  | "webhook"
  | "telegram"
  | "teams"
  | "googlechat"
  | "ntfy";

export const ALERT_CHANNEL_TYPES: AlertChannelType[] = [
  "email",
  "slack",
  "discord",
  "webhook",
  "telegram",
  "teams",
  "googlechat",
  "ntfy",
];

export type NotificationKind = "DOWN" | "UP" | "SSL_EXPIRY" | "TEST" | "REMINDER";
export const NOTIFICATION_KINDS: NotificationKind[] = ["DOWN", "UP", "SSL_EXPIRY", "TEST", "REMINDER"];

export const INCIDENT_UPDATE_STATUSES = ["investigating", "identified", "monitoring", "resolved"] as const;
export type IncidentUpdateStatus = (typeof INCIDENT_UPDATE_STATUSES)[number];

export const DEFAULT_ACCENT_COLOR = "#ea580c";
