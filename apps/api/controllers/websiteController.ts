import type { Request, Response } from "express";
import { Website, WebsiteTick } from "db/client";
import { findUserWebsiteOr404, isValidId } from "../utils/websites";
import { assertSafeUrl, UnsafeUrlError } from "../utils/ssrf";

// Map a lean Mongo document's `_id` to `id` (recursively for ticks) so the
// frontend can keep using `id` instead of `_id`.
const serializeTick = (tick: any) => ({
  ...tick,
  id: String(tick._id),
});

const serializeWebsite = (website: any, websiteTicks: any[] = []) => ({
  ...website,
  id: String(website._id),
  websiteTicks: websiteTicks.map(serializeTick),
});

// create website (free — no on-chain payment required)
export const createWebsite = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { url, name } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({ message: "Missing or invalid url" });
    return;
  }

  // Validate the URL and ensure it does not target private/internal hosts
  // (SSRF protection — the server fetches this URL every minute).
  try {
    await assertSafeUrl(url);
  } catch (err) {
    const message =
      err instanceof UnsafeUrlError
        ? err.message
        : "Invalid URL. Include http:// or https://";
    res.status(400).json({ message });
    return;
  }

  const website = await Website.create({
    userId,
    url,
    name: typeof name === "string" ? name.trim() : "",
    disabled: false,
  });

  res.json({ id: website._id });
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
