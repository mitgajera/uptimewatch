import {
  MONITOR_INTERVALS,
  REMINDER_OPTIONS,
  type DnsRecordType,
  type KeywordMode,
  type Monitor,
  type MonitorConfig,
  type MonitorMethod,
  type MonitorType,
} from "@/lib/api/types";

/** Limits from docs/api-contract.md, mirrored so the form can validate inline. */
export const LIMITS = {
  name: 100,
  headers: 10,
  headerValue: 1000,
  body: 10_000,
  keyword: 200,
  host: 253,
  dnsExpected: 200,
  tags: 10,
  tagLength: 24,
  graceMinutes: 1440,
  timeoutSeconds: [1, 30] as const,
  degradedMs: [100, 30_000] as const,
};

export const BODY_METHODS: MonitorMethod[] = ["POST", "PUT", "PATCH"];

export const INTERVAL_LABEL: Record<(typeof MONITOR_INTERVALS)[number], string> = {
  60: "1 minute",
  120: "2 minutes",
  300: "5 minutes",
  600: "10 minutes",
  900: "15 minutes",
  1800: "30 minutes",
  3600: "1 hour",
  21600: "6 hours",
  43200: "12 hours",
  86400: "24 hours",
};

export function intervalLabel(seconds: number): string {
  return INTERVAL_LABEL[seconds as keyof typeof INTERVAL_LABEL] ?? `${seconds} seconds`;
}

export const REMINDER_LABEL: Record<(typeof REMINDER_OPTIONS)[number], string> = {
  0: "Don't repeat",
  15: "Every 15 minutes",
  30: "Every 30 minutes",
  60: "Every hour",
  240: "Every 4 hours",
  1440: "Every day",
};

export type StatusPreset = "2xx" | "2xx-3xx" | "custom";
export const STATUS_PRESETS: { value: StatusPreset; label: string; expected?: string }[] = [
  { value: "2xx", label: "2xx", expected: "200-299" },
  { value: "2xx-3xx", label: "2xx – 3xx", expected: "200-399" },
  { value: "custom", label: "Custom" },
];

export interface HeaderRow {
  key: string;
  name: string;
  value: string;
}

export type AlertMode = "all" | "selected";

export interface FormState {
  type: MonitorType;
  name: string;
  url: string;
  method: MonitorMethod;
  headers: HeaderRow[];
  body: string;
  followRedirects: boolean;
  statusPreset: StatusPreset;
  expectedStatus: string;
  keyword: string;
  keywordMode: KeywordMode;
  degradedEnabled: boolean;
  degradedMs: string;
  host: string;
  port: string;
  dnsRecordType: DnsRecordType;
  dnsExpected: string;
  intervalSeconds: number;
  timeoutSeconds: string;
  failureThreshold: number;
  graceMinutes: string;
  alertMode: AlertMode;
  alertChannelIds: string[];
  reminderMinutes: number;
  tags: string[];
}

export type Errors = Record<string, string>;

let rowSeq = 0;
export const newHeaderRow = (name = "", value = ""): HeaderRow => ({ key: `h${++rowSeq}`, name, value });

export function defaultForm(type: MonitorType = "http"): FormState {
  return {
    type,
    name: "",
    url: "",
    method: "GET",
    headers: [],
    body: "",
    followRedirects: true,
    statusPreset: "2xx-3xx",
    expectedStatus: "200-399",
    keyword: "",
    keywordMode: "contains",
    degradedEnabled: false,
    degradedMs: "2000",
    host: "",
    port: "",
    dnsRecordType: "A",
    dnsExpected: "",
    intervalSeconds: type === "heartbeat" ? 3600 : 60,
    timeoutSeconds: "10",
    failureThreshold: 2,
    graceMinutes: "5",
    alertMode: "all",
    alertChannelIds: [],
    reminderMinutes: 0,
    tags: [],
  };
}

function presetFor(expected: string): StatusPreset {
  const normalized = expected.replace(/\s+/g, "");
  return STATUS_PRESETS.find((p) => p.expected === normalized)?.value ?? "custom";
}

export function fromMonitor(m: Monitor): FormState {
  const base = defaultForm(m.type ?? "http");
  return {
    ...base,
    name: m.name ?? "",
    url: m.url ?? "",
    method: m.method ?? "GET",
    headers: (m.headers ?? []).map((h) => newHeaderRow(h.name, h.value)),
    body: m.body ?? "",
    followRedirects: m.followRedirects ?? true,
    statusPreset: presetFor(m.expectedStatus ?? "200-399"),
    expectedStatus: m.expectedStatus ?? "200-399",
    keyword: m.keyword ?? "",
    keywordMode: m.keywordMode ?? "contains",
    degradedEnabled: m.degradedThresholdMs != null,
    degradedMs: String(m.degradedThresholdMs ?? 2000),
    host: m.host ?? "",
    port: m.port != null ? String(m.port) : "",
    dnsRecordType: m.dnsRecordType ?? "A",
    dnsExpected: m.dnsExpected ?? "",
    intervalSeconds: m.intervalSeconds ?? base.intervalSeconds,
    timeoutSeconds: String(Math.round((m.timeoutMs ?? 10_000) / 1000)),
    failureThreshold: m.failureThreshold ?? 2,
    graceMinutes: String(Math.round((m.graceSeconds ?? 300) / 60)),
    alertMode: (m.alertChannelIds?.length ?? 0) > 0 ? "selected" : "all",
    alertChannelIds: m.alertChannelIds ?? [],
    reminderMinutes: m.reminderMinutes ?? 0,
    tags: m.tags ?? [],
  };
}

const HEADER_NAME = /^[A-Za-z0-9-]{1,64}$/;
const FORBIDDEN_HEADERS = ["host", "content-length"];
const STATUS_LIST = /^\s*\d{3}(\s*-\s*\d{3})?(\s*,\s*\d{3}(\s*-\s*\d{3})?)*\s*$/;
const HOST = /^(\[[0-9a-fA-F:.]+\]|[0-9a-fA-F:]*:[0-9a-fA-F:.]+|[A-Za-z0-9_]([A-Za-z0-9_-]*[A-Za-z0-9_])?(\.[A-Za-z0-9_]([A-Za-z0-9_-]*[A-Za-z0-9_])?)*\.?)$/;
export const TAG_PATTERN = /^[a-z0-9 _-]{1,24}$/;

const wholeInRange = (raw: string, min: number, max: number) => {
  if (!raw.trim()) return false;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max;
};

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Client-side checks matching the API's validation, keyed by field id. */
export function validate(f: FormState): Errors {
  const e: Errors = {};

  if (f.name.trim().length > LIMITS.name) e.name = `Keep the name under ${LIMITS.name} characters`;
  if (f.type === "heartbeat" && !f.name.trim()) e.name = "Name the job, e.g. Nightly backup";

  if (f.type === "http") {
    const url = f.url.trim();
    if (!url) e.url = "Enter the URL to check";
    else {
      try {
        const u = new URL(url);
        if (!/^https?:$/.test(u.protocol)) e.url = "The URL must start with http:// or https://";
      } catch {
        e.url = "Enter a full URL, e.g. https://api.example.com/health";
      }
    }
    if (f.headers.length > LIMITS.headers) e.headers = `Add at most ${LIMITS.headers} headers`;
    f.headers.forEach((h, i) => {
      const name = h.name.trim();
      if (!HEADER_NAME.test(name)) e[`header-${i}-name`] = "Use 1–64 letters, digits or dashes";
      else if (FORBIDDEN_HEADERS.includes(name.toLowerCase())) e[`header-${i}-name`] = `${name} is set automatically`;
      if (h.value.length > LIMITS.headerValue) e[`header-${i}-value`] = `Keep values under ${LIMITS.headerValue} characters`;
      else if (/[\r\n]/.test(h.value)) e[`header-${i}-value`] = "Values can't contain line breaks";
    });
    if (BODY_METHODS.includes(f.method) && f.body.length > LIMITS.body) {
      e.body = `Keep the body under ${LIMITS.body.toLocaleString()} characters`;
    }
    if (f.statusPreset === "custom" && !STATUS_LIST.test(f.expectedStatus)) {
      e.expectedStatus = "Use codes and ranges, e.g. 200-299,301";
    }
    if (f.keyword.length > LIMITS.keyword) e.keyword = `Keep the keyword under ${LIMITS.keyword} characters`;
    if (f.keywordMode === "absent" && !f.keyword.trim()) e.keyword = "Enter the text that must not appear";
  }

  if (f.type === "tcp" || f.type === "dns") {
    const host = f.host.trim();
    if (!host) e.host = "Enter a hostname or IP address";
    else if (/^[a-z]+:\/\//i.test(host)) e.host = "Enter just the host, without http://";
    else if (host.length > LIMITS.host || !HOST.test(host)) e.host = "Enter a valid hostname or IP address";
  }
  if (f.type === "tcp" && !wholeInRange(f.port, 1, 65_535)) e.port = "Use a port from 1 to 65535";
  if (f.type === "dns" && f.dnsExpected.trim().length > LIMITS.dnsExpected) {
    e.dnsExpected = `Keep the expected value under ${LIMITS.dnsExpected} characters`;
  }

  if ((f.type === "http" || f.type === "tcp") && f.degradedEnabled) {
    const [min, max] = LIMITS.degradedMs;
    if (!wholeInRange(f.degradedMs, min, max)) e.degradedMs = `Use ${min}–${max.toLocaleString()} ms`;
  }

  if (f.type !== "heartbeat") {
    const [min, max] = LIMITS.timeoutSeconds;
    if (!wholeInRange(f.timeoutSeconds, min, max)) e.timeoutSeconds = `Use a whole number of seconds from ${min} to ${max}`;
  } else if (!wholeInRange(f.graceMinutes, 0, LIMITS.graceMinutes)) {
    e.graceMinutes = `Use 0–${LIMITS.graceMinutes} minutes`;
  }

  if (f.alertMode === "selected" && f.alertChannelIds.length === 0) {
    e.alertChannelIds = "Pick at least one channel, or send to all channels";
  }

  if (f.tags.length > LIMITS.tags) e.tags = `Use at most ${LIMITS.tags} tags`;
  else if (f.tags.some((t) => !TAG_PATTERN.test(t))) e.tags = "Tags use a–z, 0–9, spaces, _ and -";

  return e;
}

/** Order the form renders fields in, so the first error can take focus. */
export const FIELD_ORDER = [
  "name",
  "url",
  "host",
  "port",
  "dnsExpected",
  "graceMinutes",
  "headers",
  "header-",
  "body",
  "expectedStatus",
  "keyword",
  "degradedMs",
  "timeoutSeconds",
  "alertChannelIds",
  "tags",
];

export function firstErrorKey(errors: Errors): string | undefined {
  const keys = Object.keys(errors);
  for (const prefix of FIELD_ORDER) {
    const hit = keys.filter((k) => k === prefix || (prefix.endsWith("-") && k.startsWith(prefix))).sort()[0];
    if (hit) return hit;
  }
  return keys[0];
}

/** Map an API issue path (e.g. "headers.2.name", "timeoutMs") to a form field id. */
export function fieldForIssue(path: string): string {
  const header = /^headers\.(\d+)\.(name|value)/.exec(path);
  if (header) return `header-${header[1]}-${header[2]}`;
  const root = path.split(".")[0] ?? "";
  const map: Record<string, string> = {
    timeoutMs: "timeoutSeconds",
    graceSeconds: "graceMinutes",
    degradedThresholdMs: "degradedMs",
    alertChannelIds: "alertChannelIds",
  };
  return map[root] ?? root;
}

/** Only the fields relevant to the monitor type, in the API's shape. */
export function toPayload(f: FormState, mode: "create" | "edit"): Partial<MonitorConfig> {
  const common: Partial<MonitorConfig> = {
    name: f.name.trim(),
    intervalSeconds: f.intervalSeconds,
    tags: f.tags,
    alertChannelIds: f.alertMode === "all" ? [] : f.alertChannelIds,
    reminderMinutes: f.reminderMinutes,
  };
  if (mode === "create") common.type = f.type;

  if (f.type === "heartbeat") {
    return { ...common, graceSeconds: Number(f.graceMinutes) * 60 };
  }

  const checked: Partial<MonitorConfig> = {
    ...common,
    timeoutMs: Number(f.timeoutSeconds) * 1000,
    failureThreshold: f.failureThreshold,
  };
  const degraded = f.degradedEnabled ? Number(f.degradedMs) : null;

  if (f.type === "tcp") {
    return { ...checked, host: f.host.trim(), port: Number(f.port), degradedThresholdMs: degraded };
  }
  if (f.type === "dns") {
    return { ...checked, host: f.host.trim(), dnsRecordType: f.dnsRecordType, dnsExpected: f.dnsExpected.trim() };
  }
  const preset = STATUS_PRESETS.find((p) => p.value === f.statusPreset);
  return {
    ...checked,
    url: f.url.trim(),
    method: f.method,
    headers: f.headers.map((h) => ({ name: h.name.trim(), value: h.value })),
    body: BODY_METHODS.includes(f.method) ? f.body : "",
    followRedirects: f.followRedirects,
    expectedStatus: preset?.expected ?? f.expectedStatus.replace(/\s+/g, ""),
    keyword: f.keyword,
    keywordMode: f.keywordMode,
    degradedThresholdMs: degraded,
  };
}
