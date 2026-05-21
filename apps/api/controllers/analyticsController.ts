import type { Request, Response } from "express";
import { Website, WebsiteTick, Incident } from "db/client";

const RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.ceil((p / 100) * sortedAsc.length) - 1
  );
  return Math.round(sortedAsc[Math.max(0, idx)]);
}

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
  const avgUptime = ticks.length ? (upTicks / ticks.length) * 100 : 100;
  const avgResponse =
    ticks.length > 0
      ? Math.round(ticks.reduce((a, t) => a + (t.latency || 0), 0) / ticks.length)
      : 0;

  const activeIncidents = websiteIds.length
    ? await Incident.countDocuments({ userId, ongoing: true })
    : 0;

  res.json({
    totalMonitors: websites.length,
    up,
    down,
    avgUptime: Math.round(avgUptime * 100) / 100,
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

  const website = await Website.findOne({ _id: websiteId, userId }).lean();
  if (!website) {
    res.status(404).json({ error: "Website not found." });
    return;
  }

  const ticks = await WebsiteTick.find({
    websiteId: website._id,
    createdAt: { $gte: since },
  })
    .select("status latency createdAt")
    .sort({ createdAt: 1 })
    .lean();

  const total = ticks.length;
  const upCount = ticks.filter((t) => t.status === "UP").length;
  const uptime = total ? (upCount / total) * 100 : 100;

  const latencies = ticks.map((t) => t.latency || 0).sort((a, b) => a - b);
  const avg =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

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
    uptime: Math.round(uptime * 100) / 100,
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

  const website = await Website.findOne({ _id: websiteId, userId }).lean();
  if (!website) {
    res.status(404).json({ error: "Website not found." });
    return;
  }

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
