export const STATUS_HISTORY_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DailyCount {
  day: string; // YYYY-MM-DD (UTC)
  total: number;
  up: number;
}

export interface DailyBar {
  date: string;
  /** Percentage 0-100 with two decimals, or null when there were no checks. */
  uptime: number | null;
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** One bar per UTC day for the last `days` days (oldest first). */
export function buildDailyBars(rows: DailyCount[], now: number, days = STATUS_HISTORY_DAYS): DailyBar[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const bars: DailyBar[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = isoDay(now - i * DAY_MS);
    const row = byDay.get(date);
    bars.push({
      date,
      uptime: row && row.total > 0 ? Math.round((row.up / row.total) * 10_000) / 100 : null,
    });
  }
  return bars;
}

/** Overall uptime across bars, weighting each day by its check count. */
export function overallUptime(rows: DailyCount[]): number | null {
  const total = rows.reduce((n, r) => n + r.total, 0);
  if (total === 0) return null;
  const up = rows.reduce((n, r) => n + r.up, 0);
  return Math.round((up / total) * 10_000) / 100;
}

export type MonitorPublicStatus = "up" | "down" | "paused" | "unknown";
export type PageStatus = "operational" | "partial_outage" | "major_outage" | "unknown";

export function monitorPublicStatus(m: {
  paused?: boolean;
  isDown?: boolean;
  lastCheckedAt?: Date | string | null;
}): MonitorPublicStatus {
  if (m.paused) return "paused";
  if (m.isDown) return "down";
  return m.lastCheckedAt ? "up" : "unknown";
}

export function pageStatus(statuses: MonitorPublicStatus[]): PageStatus {
  const active = statuses.filter((s) => s !== "paused");
  if (active.length === 0 || active.every((s) => s === "unknown")) return "unknown";
  const down = active.filter((s) => s === "down").length;
  if (down === 0) return "operational";
  return down === active.length ? "major_outage" : "partial_outage";
}
