import type { Monitor, MonitorType } from "@/lib/api/types";
import {
  bucketTicks,
  displayName,
  monitorState,
  monitorTarget,
  STATE_ORDER,
  type MonitorState,
} from "@/lib/monitor-format";
import type { BarTone, UptimeBar } from "@/components/app/uptime-bars";

/** Text color for a 24h uptime percentage. */
export function uptimeTextClass(pct: number | null | undefined): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 99) return "text-success";
  if (pct >= 95) return "text-warning";
  return "text-destructive";
}

/** Sparkline tone that follows the monitor's state. */
export function sparklineTone(state: MonitorState): string {
  if (state === "down") return "text-destructive";
  if (state === "degraded") return "text-warning";
  if (state === "paused" || state === "pending") return "text-muted-foreground";
  return "text-brand";
}

const timeFmt = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" });

/** Last-30-minutes check bars for a monitor (one bar per minute, oldest first). */
export function recentCheckBars(m: Pick<Monitor, "websiteTicks">, now = Date.now()): UptimeBar[] {
  const buckets = bucketTicks(m.websiteTicks ?? [], 30, 60_000, now);
  return buckets.map((b, i) => {
    const at = new Date(now - (buckets.length - 1 - i) * 60_000);
    const tone: BarTone = b === "up" ? "up" : b === "down" ? "down" : "none";
    const text = b === "up" ? "Up" : b === "down" ? "Failed check" : "No check";
    return { key: String(i), tone, label: `${timeFmt.format(at)} · ${text}` };
  });
}

// ---- Filtering & sorting ---------------------------------------------------

export type StatusFilter = "all" | "down" | "degraded" | "up" | "paused" | "maintenance";
export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "down", label: "Down" },
  { value: "degraded", label: "Degraded" },
  { value: "up", label: "Up" },
  { value: "paused", label: "Paused" },
  { value: "maintenance", label: "Maintenance" },
];

export type SortKey = "status" | "name" | "uptime" | "latency" | "checked";
export const SORT_OPTIONS: { value: SortKey; label: string; hint: string }[] = [
  { value: "status", label: "Status", hint: "Problems first" },
  { value: "name", label: "Name", hint: "A to Z" },
  { value: "uptime", label: "Uptime", hint: "Lowest first" },
  { value: "latency", label: "Response time", hint: "Slowest first" },
  { value: "checked", label: "Last checked", hint: "Most recent first" },
];

export interface ListFilters {
  q: string;
  status: StatusFilter;
  type: MonitorType | "all";
  tags: string[];
  sort: SortKey;
}

export function countByStatus(monitors: Monitor[]): Record<StatusFilter, number> {
  const c: Record<StatusFilter, number> = { all: 0, down: 0, degraded: 0, up: 0, paused: 0, maintenance: 0 };
  for (const m of monitors) {
    c.all++;
    const s = monitorState(m);
    if (s !== "pending") c[s]++;
  }
  return c;
}

export function allTags(monitors: Monitor[]): string[] {
  const set = new Set<string>();
  for (const m of monitors) for (const t of m.tags ?? []) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}

function matchesQuery(m: Monitor, q: string): boolean {
  if (!q) return true;
  const hay = [displayName(m), monitorTarget(m), m.url, m.host, ...(m.tags ?? [])].join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

const checkedAt = (m: Monitor) => {
  const t = m.lastCheckedAt ?? m.lastHeartbeatAt;
  return t ? new Date(t).getTime() : 0;
};

export function applyFilters(monitors: Monitor[], f: ListFilters): Monitor[] {
  const byName = (a: Monitor, b: Monitor) => displayName(a).localeCompare(displayName(b));
  const rows = monitors.filter(
    (m) =>
      (f.status === "all" || monitorState(m) === f.status) &&
      (f.type === "all" || m.type === f.type) &&
      (f.tags.length === 0 || f.tags.some((t) => m.tags?.includes(t))) &&
      matchesQuery(m, f.q.trim())
  );
  const compare: Record<SortKey, (a: Monitor, b: Monitor) => number> = {
    status: (a, b) => STATE_ORDER[monitorState(a)] - STATE_ORDER[monitorState(b)] || byName(a, b),
    name: byName,
    // Monitors without data sink to the bottom on metric sorts.
    uptime: (a, b) => (a.uptime24h ?? 101) - (b.uptime24h ?? 101) || byName(a, b),
    latency: (a, b) => (b.avgLatency24h ?? -1) - (a.avgLatency24h ?? -1) || byName(a, b),
    checked: (a, b) => checkedAt(b) - checkedAt(a) || byName(a, b),
  };
  return rows.sort(compare[f.sort]);
}

export const TAG_PATTERN = /^[a-z0-9 _-]{1,24}$/;
export const normalizeTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");
