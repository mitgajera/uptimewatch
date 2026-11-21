import type { Request, Response } from "express";
import { Incident, StatusPage, Website, WebsiteTick } from "db/client";
import {
  buildDailyBars,
  monitorPublicStatus,
  overallUptime,
  pageStatus,
  STATUS_HISTORY_DAYS,
  type DailyCount,
} from "../statusPages/summary";
import { renderStatusBadge } from "../statusPages/badge";

const DAY_MS = 24 * 60 * 60 * 1000;
const INCIDENT_HISTORY_DAYS = 14;
/** Public pages can be popular; serve each from memory for a short while. */
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { expires: number; body: unknown }>();

/** Test hook. */
export function clearPublicCache() {
  cache.clear();
}

const hostnameOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "Monitor";
  }
};

async function buildStatusPage(slug: string, now: number) {
  const page = await StatusPage.findOne({ slug, published: true }).lean();
  if (!page) return null;

  const websites = await Website.find({ _id: { $in: page.websiteIds }, disabled: false })
    .select("name url paused isDown lastCheckedAt")
    .lean();
  const ids = websites.map((w) => w._id);

  const [rows, incidents] = ids.length
    ? await Promise.all([
        WebsiteTick.aggregate<{ _id: { w: unknown; day: string }; total: number; up: number }>([
          {
            $match: {
              websiteId: { $in: ids },
              createdAt: { $gte: new Date(now - STATUS_HISTORY_DAYS * DAY_MS) },
            },
          },
          {
            $group: {
              _id: {
                w: "$websiteId",
                day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              },
              total: { $sum: 1 },
              up: { $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] } },
            },
          },
        ]),
        Incident.find({
          websiteId: { $in: ids },
          startedAt: { $gte: new Date(now - INCIDENT_HISTORY_DAYS * DAY_MS) },
        })
          .sort({ startedAt: -1 })
          .limit(20)
          .lean(),
      ])
    : [[], []];

  const countsByWebsite = new Map<string, DailyCount[]>();
  for (const r of rows) {
    const key = String(r._id.w);
    const list = countsByWebsite.get(key) ?? [];
    list.push({ day: r._id.day, total: r.total, up: r.up });
    countsByWebsite.set(key, list);
  }

  // Keep the owner's chosen order; only expose a display name, never the URL.
  const order = new Map(page.websiteIds.map((id, i) => [String(id), i]));
  const monitors = websites
    .map((w) => {
      const counts = countsByWebsite.get(String(w._id)) ?? [];
      return {
        id: String(w._id),
        name: w.name?.trim() || hostnameOf(w.url),
        status: monitorPublicStatus(w),
        uptime: overallUptime(counts),
        days: buildDailyBars(counts, now),
      };
    })
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const nameById = new Map(monitors.map((m) => [m.id, m.name]));
  return {
    title: page.title,
    description: page.description ?? "",
    status: pageStatus(monitors.map((m) => m.status)),
    generatedAt: new Date(now).toISOString(),
    monitors,
    incidents: incidents.map((i) => ({
      id: String(i._id),
      monitor: nameById.get(String(i.websiteId)) ?? "Monitor",
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt ?? null,
      durationMs: i.durationMs ?? null,
      ongoing: i.ongoing,
    })),
  };
}

/** Resolve a public status page by slug through the short-lived cache. */
async function loadStatusPage(rawSlug: unknown) {
  const slug = String(rawSlug ?? "").toLowerCase();
  if (!/^[a-z0-9-]{3,48}$/.test(slug)) return null;

  const now = Date.now();
  const hit = cache.get(slug);
  if (hit && hit.expires > now) return hit.body as Awaited<ReturnType<typeof buildStatusPage>>;

  const body = await buildStatusPage(slug, now);
  cache.set(slug, { expires: now + CACHE_TTL_MS, body });
  return body;
}

/** GET /public/status-pages/:slug — no auth. */
export const getPublicStatusPage = async (req: Request, res: Response) => {
  const body = await loadStatusPage(req.params.slug);
  if (!body) {
    res.status(404).json({ error: "Status page not found." });
    return;
  }
  res.set("Cache-Control", "public, max-age=60");
  res.json(body);
};

/** GET /public/status-pages/:slug/badge.svg — embeddable status badge. */
export const getStatusBadge = async (req: Request, res: Response) => {
  const body = await loadStatusPage(req.params.slug);
  const label = typeof req.query.label === "string" && req.query.label ? req.query.label : "status";

  res.status(body ? 200 : 404);
  res.set({
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=60",
    // Badges are meant to be embedded on other sites (READMEs, footers).
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  res.send(renderStatusBadge(body?.status ?? "unknown", label));
};
