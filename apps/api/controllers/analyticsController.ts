import type { Request, Response } from "express";
import { Website, WebsiteTick, Incident } from "db/client";
import { RANGES, percentile, average, uptimePercent } from "../utils/stats";
import { findUserWebsiteOr404 } from "../utils/websites";

/**
 * Dashboard summary across all of the user's monitors.
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const since = new Date(Date.now() - RANGES["24h"]);

  const websites = await Website.find({ userId, disabled: false }).lean();
  const websiteIds = websites.map((w) => w._id);

  const up = websites.filter((w) => !w.isDown).length;
  const down = websites.filter((w) => w.isDown).length;

  const ticks = websiteIds.length
    ? await WebsiteTick.find({
        websiteId: { $in: websiteIds },
        createdAt: { $gte: since },
      })
        .select("status latency")
        .lean()
    : [];

  const upTicks = ticks.filter((t) => t.status === "UP").length;
  const avgUptime = uptimePercent(upTicks, ticks.length);
  const avgResponse = average(ticks.map((t) => t.latency || 0));

  const activeIncidents = websiteIds.length
    ? await Incident.countDocuments({ userId, ongoing: true })
    : 0;

  res.json({
    totalMonitors: websites.length,
    up,
    down,
    avgUptime,
    avgResponseTime: avgResponse,
    activeIncidents,
    checksLast24h: ticks.length,
  });
};

/**
 * Per-website analytics for a given range: uptime %, latency avg/p95/p99,
 * and a bucketed time series for charts.
 */
export const getWebsiteAnalytics = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const websiteId = req.params.websiteId;
  const range = (req.query.range as string) in RANGES ? (req.query.range as string) : "24h";
  const since = new Date(Date.now() - RANGES[range]);

  const website = await findUserWebsiteOr404(res, { websiteId, userId });
  if (!website) return;

  const ticks = await WebsiteTick.find({
    websiteId: website._id,
    createdAt: { $gte: since },
  })
    .select("status latency createdAt")
    .sort({ createdAt: 1 })
    .lean();

  const total = ticks.length;
  const upCount = ticks.filter((t) => t.status === "UP").length;
  const uptime = uptimePercent(upCount, total);

  const latencies = ticks.map((t) => t.latency || 0).sort((a, b) => a - b);
  const avg = average(latencies);

  // Bucket into ~40 points for the chart.
  const bucketCount = 40;
  const bucketMs = Math.max(60_000, Math.floor(RANGES[range] / bucketCount));
  const buckets: Record<number, { sum: number; count: number; down: number }> = {};
  for (const t of ticks) {
    const bucket = Math.floor(new Date(t.createdAt).getTime() / bucketMs) * bucketMs;
    if (!buckets[bucket]) buckets[bucket] = { sum: 0, count: 0, down: 0 };
    buckets[bucket].sum += t.latency || 0;
    buckets[bucket].count += 1;
    if (t.status === "DOWN") buckets[bucket].down += 1;
  }
  const series = Object.entries(buckets)
    .map(([ts, b]) => ({
      t: Number(ts),
      avgLatency: Math.round(b.sum / b.count),
      up: b.down === 0,
    }))
    .sort((a, b) => a.t - b.t);

  res.json({
    range,
    uptime,
    totalChecks: total,
    upChecks: upCount,
    downChecks: total - upCount,
    latency: {
      avg,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      min: latencies[0] || 0,
      max: latencies[latencies.length - 1] || 0,
    },
    series,
  });
};

/**
 * Incident history for a website.
 */
export const getWebsiteIncidents = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const websiteId = req.params.websiteId;

  const website = await findUserWebsiteOr404(res, { websiteId, userId });
  if (!website) return;

  const incidents = await Incident.find({ websiteId: website._id })
    .sort({ startedAt: -1 })
    .limit(50)
    .lean();

  res.json({
    incidents: incidents.map((i) => ({
      id: String(i._id),
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt,
      durationMs: i.durationMs,
      ongoing: i.ongoing,
      lastStatusCode: i.lastStatusCode,
    })),
  });
};
