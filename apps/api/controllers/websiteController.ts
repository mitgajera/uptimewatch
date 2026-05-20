import type { Request, Response } from "express";
import { Website, WebsiteTick } from "db/client";

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

  // Basic URL validation.
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    res.status(400).json({ message: "Invalid URL. Include http:// or https://" });
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

// get website status (with its ticks)
export const getWebsiteStatus = async (req: Request, res: Response) => {
  const websiteId = req.query.websiteId as string;
  const userId = req.userId!;

  const website = await Website.findOne({
    _id: websiteId,
    userId,
    disabled: false,
  }).lean();

  if (!website) {
    res.status(404).json({ error: "Website not found." });
    return;
  }

  const websiteTicks = await WebsiteTick.find({ websiteId: website._id })
    .sort({ createdAt: -1 })
    .lean();

  res.json(serializeWebsite(website, websiteTicks));
};

// get all websites for the logged-in user
export const getAllWebsites = async (req: Request, res: Response) => {
  const userId = req.userId;

  const websites = await Website.find({
    userId,
    disabled: false,
  }).lean();

  const websitesWithTicks = await Promise.all(
    websites.map(async (website) => {
      const websiteTicks = await WebsiteTick.find({ websiteId: website._id })
        .sort({ createdAt: -1 })
        .lean();
      return serializeWebsite(website, websiteTicks);
    })
  );

  res.json({ websites: websitesWithTicks });
};

// disable (soft-delete) a website
export const disableWebsite = async (req: Request, res: Response) => {
  const userId = req.userId;
  const websiteId = req.params.websiteId;

  if (!websiteId) {
    res.status(400).json({ error: "Missing websiteId in URL" });
    return;
  }

  try {
    await Website.updateOne(
      { _id: websiteId, userId },
      { $set: { disabled: true } }
    );

    res.json({ message: "Website disabled successfully" });
  } catch (error) {
    console.error("Failed to disable website:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
