import type { Request, Response } from "express";
import { AlertChannel, Website, WebsiteTick } from "db/client";
import { findUserWebsiteOr404, isValidId } from "../utils/websites";
import { assertSafeUrl, UnsafeUrlError } from "../utils/ssrf";
import { MONITOR_DEFAULTS } from "db/constants";
import { RANGES, uptimePercent } from "../utils/stats";
import { generateHeartbeatToken } from "../monitor/heartbeat";
import { runMonitorCheck } from "../monitor/runCheck";
import { recordCheckResult } from "../monitor/record";
import { sendCsv, toCsv } from "../utils/csv";
import { monitorDisplayName } from "../utils/incidents";
import { bulkMonitorSchema, createMonitorSchema, parseBody, updateMonitorSchema } from "../validation";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SPARKLINE_HOURS = 24;
const CALENDAR_DAYS = 90;

/** A tick as the API returns it. */
const serializeTick = (tick: any) => ({
  ...tick,
  id: String(tick._id),
});

// Legacy monitors predate the config fields, and lean() skips schema
// defaults, so fill them in for a consistent API shape.
export const serializeWebsite = (website: any, websiteTicks: any[] = []) => ({
  ...MONITOR_DEFAULTS,
  isDown: false,
  isDegraded: false,
  consecutiveFailures: 0,
  lastCheckedAt: null,
  lastStatusCode: null,
  lastLatency: null,
  lastErrorType: null,
  lastErrorMessage: null,
  sslExpiresAt: null,
  sslIssuer: null,
  heartbeatToken: null,
  lastHeartbeatAt: null,
  maintenanceUntil: null,
  ...website,
  // Defaults for monitor types the field doesn't apply to.
  port: website.port ?? null,
  host: website.host ?? "",
  headers: website.headers ?? [],
  tags: website.tags ?? [],
  alertChannelIds: (website.alertChannelIds ?? []).map(String),
  id: String(website._id),
  websiteTicks: websiteTicks.map(serializeTick),
});

const MAX_MONITORS_PER_USER = Math.max(1, Number(process.env.MAX_MONITORS_PER_USER) || 50);

/** SSRF-validate a monitor URL; responds 400 and returns false when unsafe. */
async function ensureSafeUrl(url: string, res: Response): Promise<boolean> {
  try {
    await assertSafeUrl(url);
    return true;
  } catch (err) {
    const message =
      err instanceof UnsafeUrlError ? err.message : "Invalid URL. Include http:// or https://";
    res.status(400).json({ message });
    return false;
  }
}

/** SSRF-validate a TCP host (it's re-checked at connect time too). */
async function ensureSafeHost(host: string, res: Response): Promise<boolean> {
  const bare = host.replace(/^\[|\]$/g, "");
  try {
    await assertSafeUrl(`http://${bare.includes(":") ? `[${bare}]` : bare}/`);
    return true;
  } catch (err) {
    const message =
      err instanceof UnsafeUrlError
        ? err.message.replace(/^URL/, "Host")
        : "Enter a hostname or IP address";
    res.status(400).json({ message });
    return false;
  }
}

/** Every id must be one of the user's alert channels; responds 400 otherwise. */
async function ensureOwnedChannels(userId: string, ids: string[] | undefined, res: Response): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  const owned = await AlertChannel.countDocuments({ _id: { $in: ids }, userId });
  if (owned !== ids.length) {
    res.status(400).json({ message: "alertChannelIds: one or more alert channels were not found." });
    return false;
  }
  return true;
}

// create a monitor
export const createWebsite = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const body = parseBody(createMonitorSchema, req, res);
  if (!body) return;

  const type = body.type ?? "http";
  // The server connects to http/tcp targets on a schedule, so they must not
  // point at private/internal hosts (SSRF). DNS monitors only query resolvers.
  if (type === "http" && !(await ensureSafeUrl(body.url!, res))) return;
  if (type === "tcp" && !(await ensureSafeHost(body.host!, res))) return;
  if (!(await ensureOwnedChannels(userId, body.alertChannelIds, res))) return;

  const count = await Website.countDocuments({ userId, disabled: false });
  if (count >= MAX_MONITORS_PER_USER) {
    res.status(403).json({ message: `Monitor limit reached (${MAX_MONITORS_PER_USER}).` });
    return;
  }

  const typeFields: Record<string, unknown> =
    type === "heartbeat"
      ? { url: "", heartbeatToken: generateHeartbeatToken() }
      : type === "tcp" || type === "dns"
        ? { url: "" }
        : {};
  if (type !== "tcp") typeFields.port = null;
  if (type === "http" || type === "heartbeat") typeFields.host = "";

  const website = await Website.create({
    ...body,
    ...typeFields,
    userId,
    disabled: false,
  });
  res.status(201).json({ id: website._id });
};

// update a monitor's configuration (partial)
export const updateWebsite = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const websiteId = req.params.websiteId;
  if (!isValidId(websiteId)) {
    res.status(400).json({ error: "Invalid website id." });
    return;
  }

  const body = parseBody(updateMonitorSchema, req, res);
  if (!body) return;

  // Target fields need the stored monitor to validate against its type.
  const needsExisting = body.url !== undefined || body.host !== undefined || body.port !== undefined;
  const existing = needsExisting
    ? await Website.findOne({ _id: websiteId, userId, disabled: false }).select("type url host port").lean()
    : null;
  const type = (existing as any)?.type ?? "http";

  const { maintenanceMinutes, ...fields } = body;
  const update: Record<string, unknown> = { ...fields };
  // The URL only applies to http monitors; host/port to tcp/dns.
  if (existing && type !== "http") delete update.url;
  if (existing && type !== "tcp" && type !== "dns") delete update.host;
  if (existing && type !== "tcp") delete update.port;

  if (update.url !== undefined && !(await ensureSafeUrl(update.url as string, res))) return;
  if (type === "tcp" && update.host !== undefined && !(await ensureSafeHost(update.host as string, res))) return;
  if (!(await ensureOwnedChannels(userId, body.alertChannelIds, res))) return;

  // Windows are timed on the server so a skewed browser clock can't shorten them.
  if (maintenanceMinutes !== undefined) {
    update.maintenanceUntil = new Date(Date.now() + maintenanceMinutes * 60_000);
  }
  // Ending a window "now" (rather than clearing it) restarts heartbeat
  // deadlines from now, so a job paused for maintenance isn't instantly late.
  if (fields.maintenanceUntil === null) update.maintenanceUntil = new Date();

  // The edit form always re-sends the target; only a real change resets state.
  const targetChanged =
    existing &&
    ((update.url !== undefined && existing.url !== update.url) ||
      (update.host !== undefined && (existing as any).host !== update.host) ||
      (update.port !== undefined && (existing as any).port !== update.port));
  if (targetChanged) {
    // A new target invalidates the failure streak and certificate data.
    Object.assign(update, {
      consecutiveFailures: 0,
      isDegraded: false,
      sslExpiresAt: null,
      sslIssuer: null,
      sslCheckedAt: null,
      sslAlertedThreshold: null,
    });
  }
  // Turning the degraded threshold off clears the flag right away.
  if (fields.degradedThresholdMs === null) update.isDegraded = false;

  const website = await Website.findOneAndUpdate(
    { _id: websiteId, userId, disabled: false },
    { $set: update },
    { new: true, runValidators: true }
  ).lean();

  if (!website) {
    res.status(404).json({ error: "Website not found." });
    return;
  }
  res.json(serializeWebsite(website));
};

// The dashboard only renders the most recent window of ticks per website;
// longer history is served by the bucketed analytics endpoint.
export const RECENT_TICKS_WINDOW_MS = 30 * 60 * 1000;

const recentSince = () => new Date(Date.now() - RECENT_TICKS_WINDOW_MS);

// issue a new ping URL for a heartbeat monitor (e.g. after a leak)
export const rotateHeartbeatToken = async (req: Request, res: Response) => {
  const websiteId = req.params.websiteId;
  if (!isValidId(websiteId)) {
    res.status(400).json({ error: "Invalid website id." });
    return;
  }
  const website = await Website.findOneAndUpdate(
    { _id: websiteId, userId: req.userId!, disabled: false, type: "heartbeat" },
    { $set: { heartbeatToken: generateHeartbeatToken() } },
    { new: true }
  ).lean();
  if (!website) {
    res.status(404).json({ error: "Heartbeat monitor not found." });
    return;
  }
  res.json({ heartbeatToken: website.heartbeatToken });
};

// get a single monitor's configuration, current state and recent ticks
export const getWebsite = async (req: Request, res: Response) => {
  const website = await findUserWebsiteOr404(res, {
    websiteId: req.params.websiteId!,
    userId: req.userId!,
    disabled: false,
  });
  if (!website) return;

  const websiteTicks = await WebsiteTick.find({
    websiteId: website._id,
    createdAt: { $gte: recentSince() },
  })
    .sort({ createdAt: -1 })
    .lean();
  res.json(serializeWebsite(website, websiteTicks));
};

// get website status (with its recent ticks)
export const getWebsiteStatus = async (req: Request, res: Response) => {
  const websiteId = req.query.websiteId as string;
  const userId = req.userId!;

  const website = await findUserWebsiteOr404(res, {
    websiteId,
    userId,
    disabled: false,
  });
  if (!website) return;

  const websiteTicks = await WebsiteTick.find({
    websiteId: website._id,
    createdAt: { $gte: recentSince() },
  })
    .sort({ createdAt: -1 })
    .lean();

  res.json(serializeWebsite(website, websiteTicks));
};

/** Start of the UTC hour containing `ms`. */
const hourStart = (ms: number) => Math.floor(ms / HOUR_MS) * HOUR_MS;

/** Mongo expression for the start (epoch ms) of the hour containing `createdAt`. */
const HOUR_BUCKET = {
  $subtract: [{ $toLong: "$createdAt" }, { $mod: [{ $toLong: "$createdAt" }, HOUR_MS] }],
};

interface HourlyRow {
  _id: { w: unknown; h: number };
  total: number;
  up: number;
  latencySum: number;
}

/**
 * 24 hourly average latencies (oldest first, 0 for hours without data),
 * ending with the current hour.
 */
export function buildSparkline(rows: { h: number; total: number; latencySum: number }[], now: number): number[] {
  const byHour = new Map(rows.map((r) => [Number(r.h), r]));
  const current = hourStart(now);
  const points: number[] = [];
  for (let i = SPARKLINE_HOURS - 1; i >= 0; i--) {
    const row = byHour.get(current - i * HOUR_MS);
    points.push(row && row.total > 0 ? Math.round(row.latencySum / row.total) : 0);
  }
  return points;
}

// get all websites for the logged-in user, each with its recent ticks
export const getAllWebsites = async (req: Request, res: Response) => {
  const userId = req.userId;
  const now = Date.now();

  const websites = await Website.find({
    userId,
    disabled: false,
  }).lean();

  // One query for every website's recent ticks instead of one per website.
  const ticks = websites.length
    ? await WebsiteTick.find({
        websiteId: { $in: websites.map((w) => w._id) },
        createdAt: { $gte: recentSince() },
      })
        .sort({ createdAt: -1 })
        .lean()
    : [];

  const ticksByWebsite = new Map<string, typeof ticks>();
  for (const tick of ticks) {
    const key = String(tick.websiteId);
    const list = ticksByWebsite.get(key);
    if (list) list.push(tick);
    else ticksByWebsite.set(key, [tick]);
  }

  // One aggregation over the last 24h, grouped by monitor and hour: summed
  // for the 24h stats, and per hour for the sparkline.
  const hourly = websites.length
    ? await WebsiteTick.aggregate<HourlyRow>([
        {
          $match: {
            websiteId: { $in: websites.map((w) => w._id) },
            createdAt: { $gte: new Date(now - DAY_MS) },
          },
        },
        {
          $group: {
            _id: { w: "$websiteId", h: HOUR_BUCKET },
            total: { $sum: 1 },
            up: { $sum: { $cond: [{ $eq: ["$status", "UP"] }, 1, 0] } },
            latencySum: { $sum: "$latency" },
          },
        },
      ])
    : [];
  const rowsByWebsite = new Map<string, HourlyRow[]>();
  for (const row of hourly) {
    const key = String(row._id.w);
    const list = rowsByWebsite.get(key);
    if (list) list.push(row);
    else rowsByWebsite.set(key, [row]);
  }

  res.json({
    websites: websites.map((website) => {
      const rows = rowsByWebsite.get(String(website._id)) ?? [];
      const total = rows.reduce((n, r) => n + r.total, 0);
      const up = rows.reduce((n, r) => n + r.up, 0);
      const latencySum = rows.reduce((n, r) => n + r.latencySum, 0);
      // Heartbeats have no response time; their ticks record 0.
      const timed = website.type !== "heartbeat";
      return {
        ...serializeWebsite(website, ticksByWebsite.get(String(website._id)) ?? []),
        uptime24h: total ? uptimePercent(up, total) : null,
        avgLatency24h: total && timed ? Math.round(latencySum / total) : null,
        checks24h: total,
        sparkline: timed
          ? buildSparkline(
              rows.map((r) => ({ h: r._id.h, total: r.total, latencySum: r.latencySum })),
              now
            )
          : new Array(SPARKLINE_HOURS).fill(0),
      };
    }),
  });
};

// disable (soft-delete) a website
export const disableWebsite = async (req: Request, res: Response) => {
  const userId = req.userId;
  const websiteId = req.params.websiteId;

  if (!isValidId(websiteId)) {
    res.status(400).json({ error: "Invalid website id." });
    return;
  }

  const result = await Website.updateOne(
    { _id: websiteId, userId, disabled: false },
    { $set: { disabled: true } }
  );

  if (result.matchedCount === 0) {
    res.status(404).json({ error: "Website not found." });
    return;
  }

  res.json({ message: "Website disabled successfully" });
};

// ---------------------------------------------------------------------------
// Manual checks

const MANUAL_CHECK_COOLDOWN_MS = 10_000;
/** Last manual check per monitor (per instance; enough to stop hammering). */
const lastManualCheck = new Map<string, number>();

/** Injectable so tests don't hit the network or the check engine. */
export const manualCheckDeps = {
  run: runMonitorCheck,
  record: recordCheckResult,
  now: () => Date.now(),
};

/** Test hook. */
export function resetManualCheckLimits() {
  lastManualCheck.clear();
}

// run a check now and record it like a scheduled one
export const checkWebsiteNow = async (req: Request, res: Response) => {
  const website = await findUserWebsiteOr404(res, {
    websiteId: req.params.websiteId!,
    userId: req.userId!,
    disabled: false,
  });
  if (!website) return;
  if (website.type === "heartbeat") {
    res.status(400).json({ message: "Heartbeat monitors are checked by their pings, not on demand." });
    return;
  }

  const id = String(website._id);
  const now = manualCheckDeps.now();
  const last = lastManualCheck.get(id);
  if (last !== undefined && now - last < MANUAL_CHECK_COOLDOWN_MS) {
    const wait = Math.ceil((MANUAL_CHECK_COOLDOWN_MS - (now - last)) / 1000);
    res.set("Retry-After", String(wait));
    res.status(429).json({ message: `This monitor was just checked. Try again in ${wait}s.` });
    return;
  }
  lastManualCheck.set(id, now);
  // Keep the map bounded on long-running instances.
  if (lastManualCheck.size > 10_000) {
    for (const [key, at] of lastManualCheck) if (now - at >= MANUAL_CHECK_COOLDOWN_MS) lastManualCheck.delete(key);
  }

  const checkedAt = new Date(now);
  const result = await manualCheckDeps.run(website);
  await manualCheckDeps.record(website, result, checkedAt);
  res.json({
    status: result.status,
    latency: result.latency,
    statusCode: result.statusCode,
    errorType: result.errorType,
    errorMessage: result.errorMessage,
    checkedAt: checkedAt.toISOString(),
  });
};

// ---------------------------------------------------------------------------
// Bulk actions

export const bulkUpdateWebsites = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const body = parseBody(bulkMonitorSchema, req, res);
  if (!body) return;

  const filter: Record<string, unknown> = { _id: { $in: body.ids }, userId, disabled: false };
  let update: Record<string, unknown>;
  switch (body.action) {
    case "pause":
      update = { $set: { paused: true } };
      break;
    case "resume":
      update = { $set: { paused: false } };
      break;
    case "delete":
      update = { $set: { disabled: true } };
      break;
    case "addTag":
      // Monitors already at the tag limit are skipped.
      filter["tags.9"] = { $exists: false };
      update = { $addToSet: { tags: body.tag } };
      break;
    case "removeTag":
      update = { $pull: { tags: body.tag } };
      break;
  }

  const result = await Website.updateMany(filter, update);
  res.json({ updated: result.matchedCount });
};

// ---------------------------------------------------------------------------
// Check history, calendar and export

const serializeCheck = (t: any) => ({
  id: String(t._id),
  websiteId: String(t.websiteId),
  status: t.status,
  latency: t.latency,
  statusCode: t.statusCode ?? null,
  errorType: t.errorType ?? null,
  errorMessage: t.errorMessage ?? null,
  region: t.region ?? null,
  createdAt: new Date(t.createdAt).toISOString(),
});

const MAX_CHECKS_PAGE = 200;

/** Parse a `limit` query value, clamped to 1..max. */
export function parseLimit(raw: unknown, fallback: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, Math.floor(n));
}

/** Parse a `before` ISO cursor; undefined when absent, null when malformed. */
export function parseBefore(raw: unknown): Date | undefined | null {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// page through a monitor's checks, newest first
export const getWebsiteChecks = async (req: Request, res: Response) => {
  const website = await findUserWebsiteOr404(res, {
    websiteId: req.params.websiteId!,
    userId: req.userId!,
  });
  if (!website) return;

  const limit = parseLimit(req.query.limit, 50, MAX_CHECKS_PAGE);
  const before = parseBefore(req.query.before);
  if (before === null) {
    res.status(400).json({ message: "before must be an ISO date." });
    return;
  }
  const status = req.query.status;
  if (status !== undefined && status !== "UP" && status !== "DOWN") {
    res.status(400).json({ message: "status must be UP or DOWN." });
    return;
  }

  const filter: Record<string, unknown> = { websiteId: website._id };
  if (before) filter.createdAt = { $lt: before };
  if (status) filter.status = status;

  const ticks = await WebsiteTick.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  const last = ticks[ticks.length - 1];
  res.json({
    checks: ticks.map(serializeCheck),
    nextBefore: ticks.length === limit && last ? new Date(last.createdAt).toISOString() : null,
  });
};

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** One entry per UTC day for the last `days` days, oldest first. */
export function buildCalendar(
  rows: { day: string; total: number; down: number }[],
  now: number,
  days = CALENDAR_DAYS
) {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: { date: string; uptime: number | null; checks: number; downChecks: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = isoDay(now - i * DAY_MS);
    const row = byDay.get(date);
    const checks = row?.total ?? 0;
    const downChecks = row?.down ?? 0;
    out.push({
      date,
      uptime: checks > 0 ? uptimePercent(checks - downChecks, checks) : null,
      checks,
      downChecks,
    });
  }
  return out;
}

// daily uptime for the last 90 days
export const getWebsiteCalendar = async (req: Request, res: Response) => {
  const website = await findUserWebsiteOr404(res, {
    websiteId: req.params.websiteId!,
    userId: req.userId!,
  });
  if (!website) return;

  const now = Date.now();
  // From the start of the oldest UTC day shown.
  const since = new Date(Date.parse(isoDay(now - (CALENDAR_DAYS - 1) * DAY_MS)));
  const rows = await WebsiteTick.aggregate<{ _id: string; total: number; down: number }>([
    { $match: { websiteId: website._id, createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        total: { $sum: 1 },
        down: { $sum: { $cond: [{ $eq: ["$status", "DOWN"] }, 1, 0] } },
      },
    },
  ]);
  res.json({
    days: buildCalendar(
      rows.map((r) => ({ day: r._id, total: r.total, down: r.down })),
      now
    ),
  });
};

const CSV_HEADER = ["time", "status", "status_code", "latency_ms", "error_type", "error_message"];

/** Filesystem-friendly slug for download names. */
export const fileSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "monitor";

// download a monitor's checks as CSV
export const exportWebsiteChecks = async (req: Request, res: Response) => {
  const website = await findUserWebsiteOr404(res, {
    websiteId: req.params.websiteId!,
    userId: req.userId!,
  });
  if (!website) return;

  const range = typeof req.query.range === "string" && req.query.range in RANGES ? req.query.range : "24h";
  const ticks = await WebsiteTick.find({
    websiteId: website._id,
    createdAt: { $gte: new Date(Date.now() - RANGES[range]!) },
  })
    .select("status latency statusCode errorType errorMessage createdAt")
    .sort({ createdAt: 1 })
    .lean();

  const csv = toCsv(
    CSV_HEADER,
    ticks.map((t) => [
      new Date(t.createdAt).toISOString(),
      t.status,
      t.statusCode ?? "",
      t.latency,
      t.errorType ?? "",
      t.errorMessage ?? "",
    ])
  );
  sendCsv(res, `${fileSlug(monitorDisplayName(website))}-checks-${range}.csv`, csv);
};
