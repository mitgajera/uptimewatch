import type { Request, Response } from "express";
import { Incident, Website, WebsiteTick } from "db/client";
import { uptimePercent } from "../utils/stats";
import { daysUntil } from "../monitor/ssl";
import { inMaintenance } from "../monitor/schedule";
import { monitorDisplayName } from "../utils/incidents";
import { serializeIncidents } from "./incidentController";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SERIES_HOURS = 24;
const RECENT_INCIDENTS = 8;
const SSL_WARNING_DAYS = 30;

export type MonitorBucket = "up" | "down" | "degraded" | "paused" | "maintenance" | "pending";

/**
 * Which overview bucket a monitor falls into. Buckets are exclusive and sum
 * to `total`: paused, then maintenance, then pending (never checked), then
 * down, degraded, up.
 */
export function monitorBucket(
  m: {
    paused?: boolean;
    maintenanceUntil?: Date | string | null;
    lastCheckedAt?: Date | string | null;
    isDown?: boolean;
    isDegraded?: boolean;
  },
  now: number
): MonitorBucket {
  if (m.paused) return "paused";
  if (inMaintenance(m, now)) return "maintenance";
  if (!m.lastCheckedAt) return "pending";
  if (m.isDown) return "down";
  if (m.isDegraded) return "degraded";
  return "up";
}

/** 24 hourly points (oldest first) ending with the current hour; null where there's no data. */
export function buildLatencySeries(rows: { _id: number; avg: number }[], now: number) {
  const byHour = new Map(rows.map((r) => [Number(r._id), r.avg]));
  const current = Math.floor(now / HOUR_MS) * HOUR_MS;
  const points: { t: number; avg: number | null }[] = [];
  for (let i = SERIES_HOURS - 1; i >= 0; i--) {
    const t = current - i * HOUR_MS;
    const avg = byHour.get(t);
    points.push({ t, avg: avg === undefined || avg === null ? null : Math.round(avg) });
  }
  return points;
}

interface Totals {
  total: number;
  up: number;
}
interface OverviewFacets {
  week: Totals[];
  day: Totals[];
  dayLatency: { avg: number | null }[];
  hourly: { _id: number; avg: number }[];
}

// GET /overview
export const getOverview = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const now = Date.now();

  const websites = await Website.find({ userId, disabled: false })
    .select("name url type host port paused maintenanceUntil lastCheckedAt isDown isDegraded sslExpiresAt")
    .lean();

  const counts = { total: websites.length, up: 0, down: 0, degraded: 0, paused: 0, maintenance: 0, pending: 0 };
  for (const w of websites) counts[monitorBucket(w, now)] += 1;

  const ids = websites.map((w) => w._id);
  // Response times only mean something for http and tcp checks.
  const timedIds = websites.filter((w) => (w.type ?? "http") === "http" || w.type === "tcp").map((w) => w._id);
  const daySince = new Date(now - DAY_MS);

  const [facets, openIncidents, recent] = await Promise.all([
    ids.length
      ? WebsiteTick.aggregate<OverviewFacets>([
          { $match: { websiteId: { $in: ids }, createdAt: { $gte: new Date(now - 7 * DAY_MS) } } },
          {
            $facet: {
              week: [
                {
                  $group: {
                    _id: null,
                    total: { $sum: 1 },
                    up: { $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] } },
                  },
                },
              ],
              day: [
                { $match: { createdAt: { $gte: daySince } } },
                {
                  $group: {
                    _id: null,
                    total: { $sum: 1 },
                    up: { $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] } },
                  },
                },
              ],
              dayLatency: [
                { $match: { createdAt: { $gte: daySince }, websiteId: { $in: timedIds } } },
                { $group: { _id: null, avg: { $avg: "$latency" } } },
              ],
              hourly: [
                { $match: { createdAt: { $gte: daySince }, websiteId: { $in: timedIds } } },
                {
                  $group: {
                    _id: {
                      $subtract: [{ $toLong: "$createdAt" }, { $mod: [{ $toLong: "$createdAt" }, HOUR_MS] }],
                    },
                    avg: { $avg: "$latency" },
                  },
                },
              ],
            },
          },
        ])
      : Promise.resolve([] as OverviewFacets[]),
    Incident.countDocuments({ userId, ongoing: true }),
    Incident.find({ userId }).sort({ startedAt: -1 }).limit(RECENT_INCIDENTS).lean(),
  ]);

  const f = facets[0];
  const week = f?.week[0];
  const day = f?.day[0];
  const dayLatency = f?.dayLatency[0]?.avg;

  const sslExpiring = websites
    .filter((w) => w.sslExpiresAt)
    .map((w) => {
      const expires = new Date(w.sslExpiresAt!);
      return {
        id: String(w._id),
        name: monitorDisplayName(w),
        url: w.url ?? "",
        sslExpiresAt: expires.toISOString(),
        daysLeft: daysUntil(expires, now),
      };
    })
    .filter((s) => s.daysLeft <= SSL_WARNING_DAYS)
    .sort((a, b) => a.sslExpiresAt.localeCompare(b.sslExpiresAt));

  res.json({
    counts,
    uptime24h: day && day.total ? uptimePercent(day.up, day.total) : null,
    uptime7d: week && week.total ? uptimePercent(week.up, week.total) : null,
    avgLatency24h: typeof dayLatency === "number" ? Math.round(dayLatency) : null,
    openIncidents,
    latencySeries: buildLatencySeries(f?.hourly ?? [], now),
    recentIncidents: await serializeIncidents(recent),
    sslExpiring,
  });
};
