import type { CheckErrorType, Monitor } from "@/lib/api/types";

export type MonitorState = "up" | "down" | "paused" | "pending";

/** Current state of a monitor as shown in the UI. */
export function monitorState(m: Pick<Monitor, "paused" | "isDown" | "lastCheckedAt" | "websiteTicks">): MonitorState {
  if (m.paused) return "paused";
  if (m.isDown) return "down";
  if (!m.lastCheckedAt && !(m.websiteTicks?.length > 0)) return "pending";
  return "up";
}

export const STATE_LABEL: Record<MonitorState, string> = {
  up: "Up",
  down: "Down",
  paused: "Paused",
  pending: "Pending",
};

const ERROR_LABELS: Record<CheckErrorType, string> = {
  DNS: "DNS lookup failed",
  TIMEOUT: "Timed out",
  CONNECTION: "Connection failed",
  TLS: "TLS/SSL error",
  HTTP_STATUS: "Unexpected status code",
  KEYWORD: "Keyword not found",
  BLOCKED: "Blocked address",
  UNKNOWN: "Unknown error",
};

export function errorLabel(type: CheckErrorType | null | undefined): string {
  return type ? ERROR_LABELS[type] : "Unknown error";
}

export function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60} min`;
  return `${seconds / 3600} h`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function formatUptime(pct: number | null | undefined): string {
  if (pct == null) return "—";
  return `${pct >= 99.995 ? "100" : pct.toFixed(2)}%`;
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(date: string | Date | null | undefined, now = Date.now()): string {
  if (!date) return "never";
  const diff = (new Date(date).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function displayName(m: Pick<Monitor, "name" | "url">): string {
  return m.name?.trim() || hostnameOf(m.url);
}

export type TickBucket = "up" | "down" | "none";

/**
 * Bucket recent ticks (newest first) into `count` windows of `windowMs`,
 * oldest bucket first. A window is down if any check in it failed.
 */
export function bucketTicks(
  ticks: { createdAt: string; status: "UP" | "DOWN" }[],
  count = 30,
  windowMs = 60_000,
  now = Date.now()
): TickBucket[] {
  const buckets: TickBucket[] = Array(count).fill("none");
  for (const t of ticks) {
    const age = now - new Date(t.createdAt).getTime();
    const index = count - 1 - Math.floor(age / windowMs);
    if (index < 0 || index >= count) continue;
    if (t.status === "DOWN") buckets[index] = "down";
    else if (buckets[index] === "none") buckets[index] = "up";
  }
  return buckets;
}
