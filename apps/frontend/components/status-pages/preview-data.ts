import type { CalendarDay, Incident, Monitor, PublicMonitorStatus, PublicStatusPage } from "@/lib/api/types";
import { displayName } from "@/lib/monitor-format";
import { overallStatus } from "./status-meta";

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;
export const MAX_STATUS_PAGES = 5;

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 48)
      // Strip edge dashes after truncating, or a long title can end in "-".
      .replace(/^-+|-+$/g, "")
  );
}

/** Mirrors the API's public status for a monitor. */
export function toPublicStatus(m: Monitor, now = Date.now()): PublicMonitorStatus {
  if (m.paused) return "paused";
  if (m.maintenanceUntil && new Date(m.maintenanceUntil).getTime() > now) return "maintenance";
  if (m.isDown) return "down";
  return m.lastCheckedAt || m.lastHeartbeatAt || m.websiteTicks?.length ? "up" : "unknown";
}

const DAY_MS = 86_400_000;

/** 90 UTC days ending today, oldest first, filled from a monitor's calendar when we have it. */
function daysFor(calendar: CalendarDay[] | undefined, now: number) {
  const byDate = new Map((calendar ?? []).map((d) => [d.date, d.uptime]));
  return Array.from({ length: 90 }, (_, i) => {
    const date = new Date(now - (89 - i) * DAY_MS).toISOString().slice(0, 10);
    return { date, uptime: byDate.get(date) ?? null };
  });
}

function overallUptime(calendar: CalendarDay[] | undefined): number | null {
  if (!calendar?.length) return null;
  const checks = calendar.reduce((n, d) => n + d.checks, 0);
  if (!checks) return null;
  const down = calendar.reduce((n, d) => n + d.downChecks, 0);
  return Math.round(((checks - down) / checks) * 10_000) / 100;
}

/** Build the data the public page would render, from the editor's form state and live monitors. */
export function buildPreview({
  form,
  monitors,
  calendars,
  incidents,
  now = Date.now(),
}: {
  form: {
    title: string;
    description: string;
    logoUrl: string;
    accentColor: string;
    announcement: string;
    websiteIds: string[];
    showIncidentHistory: boolean;
  };
  monitors: Monitor[];
  calendars: Map<string, CalendarDay[]>;
  incidents: Incident[];
  now?: number;
}): PublicStatusPage {
  const byId = new Map(monitors.map((m) => [m.id, m]));
  const selected = form.websiteIds.map((id) => byId.get(id)).filter((m): m is Monitor => Boolean(m));
  const names = new Map(selected.map((m) => [m.id, displayName(m)]));
  const cutoff = now - 14 * DAY_MS;

  const publicMonitors = selected.map((m) => {
    const calendar = calendars.get(m.id);
    return {
      id: m.id,
      name: displayName(m),
      status: toPublicStatus(m, now),
      uptime: overallUptime(calendar),
      days: daysFor(calendar, now),
    };
  });

  const publicIncidents = incidents
    .filter((i) => names.has(i.websiteId) && new Date(i.startedAt).getTime() >= cutoff)
    .filter((i) => form.showIncidentHistory || i.ongoing)
    .slice(0, 20)
    .map((i) => ({
      id: i.id,
      monitor: names.get(i.websiteId) ?? i.monitorName,
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt,
      durationMs: i.durationMs,
      ongoing: i.ongoing,
      updates: i.updates.filter((u) => u.public).map((u) => ({ at: u.at, message: u.message, status: u.status })),
    }));

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    logoUrl: form.logoUrl.trim(),
    accentColor: form.accentColor,
    announcement: form.announcement,
    status: overallStatus(publicMonitors.map((m) => m.status)),
    generatedAt: new Date(now).toISOString(),
    monitors: publicMonitors,
    incidents: publicIncidents,
  };
}
