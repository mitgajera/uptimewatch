import type { Request, Response } from "express";
import { Website, WebsiteTick } from "db/client";
import { findUserWebsiteOr404, isValidId } from "../utils/websites";
import { assertSafeUrl, UnsafeUrlError } from "../utils/ssrf";
import { MONITOR_DEFAULTS } from "db/constants";
import { createMonitorSchema, parseBody, updateMonitorSchema } from "../validation";

// Map a lean Mongo document's `_id` to `id` (recursively for ticks) so the
// frontend can keep using `id` instead of `_id`.
const serializeTick = (tick: any) => ({
  ...tick,
  id: String(tick._id),
});

// Legacy monitors predate the config fields, and lean() skips schema
// defaults, so fill them in for a consistent API shape.
const serializeWebsite = (website: any, websiteTicks: any[] = []) => ({
  ...MONITOR_DEFAULTS,
  consecutiveFailures: 0,
  ...website,
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

// create a monitor
export const createWebsite = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const body = parseBody(createMonitorSchema, req, res);
  if (!body) return;

  // The server fetches this URL on a schedule, so it must not target
  // private/internal hosts (SSRF).
  if (!(await ensureSafeUrl(body.url, res))) return;

  const count = await Website.countDocuments({ userId, disabled: false });
  if (count >= MAX_MONITORS_PER_USER) {
    res.status(403).json({ message: `Monitor limit reached (${MAX_MONITORS_PER_USER}).` });
    return;
  }

  const website = await Website.create({ ...body, userId, disabled: false });
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
  if (body.url !== undefined && !(await ensureSafeUrl(body.url, res))) return;

  const update: Record<string, unknown> = { ...body };
  if (body.url !== undefined) {
    // A new target invalidates the failure streak and certificate data.
    Object.assign(update, {
      consecutiveFailures: 0,
      sslExpiresAt: null,
      sslIssuer: null,
      sslCheckedAt: null,
      sslAlertedThreshold: null,
    });
  }

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

// get a single monitor's configuration and current state
export const getWebsite = async (req: Request, res: Response) => {
  const website = await findUserWebsiteOr404(res, {
    websiteId: req.params.websiteId!,
    userId: req.userId!,
    disabled: false,
  });
  if (!website) return;
  res.json(serializeWebsite(website));
};

// The dashboard only renders the most recent window of ticks per website;
// longer history is served by the bucketed analytics endpoint.
export const RECENT_TICKS_WINDOW_MS = 30 * 60 * 1000;

const recentSince = () => new Date(Date.now() - RECENT_TICKS_WINDOW_MS);

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

// get all websites for the logged-in user, each with its recent ticks
export const getAllWebsites = async (req: Request, res: Response) => {
  const userId = req.userId;

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

  res.json({
    websites: websites.map((website) =>
      serializeWebsite(website, ticksByWebsite.get(String(website._id)) ?? [])
    ),
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
