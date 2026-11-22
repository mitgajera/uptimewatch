import type { Request, Response } from "express";
import { StatusPage, Website } from "db/client";
import { DEFAULT_ACCENT_COLOR } from "db/constants";
import { isValidId } from "../utils/websites";
import { clearPublicCache } from "./publicController";
import { createStatusPageSchema, parseBody, updateStatusPageSchema } from "../validation";

const MAX_STATUS_PAGES_PER_USER = 5;

const serialize = (p: any) => ({
  id: String(p._id),
  slug: p.slug,
  title: p.title,
  description: p.description ?? "",
  websiteIds: (p.websiteIds ?? []).map(String),
  published: p.published ?? true,
  logoUrl: p.logoUrl ?? "",
  accentColor: p.accentColor ?? DEFAULT_ACCENT_COLOR,
  announcement: p.announcement ?? "",
  showIncidentHistory: p.showIncidentHistory ?? true,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/**
 * The ids to store: deduplicated, with deleted monitors dropped so a page that
 * still lists one stays editable. Null if any id isn't the user's monitor.
 */
async function resolveWebsiteIds(userId: string, ids: string[]): Promise<string[] | null> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const owned = await Website.find({ _id: { $in: unique }, userId }).select("_id disabled").lean();
  if (owned.length !== unique.length) return null;
  const active = new Set(owned.filter((w: any) => !w.disabled).map((w: any) => String(w._id)));
  return unique.filter((id) => active.has(id));
}

export const listStatusPages = async (req: Request, res: Response) => {
  const pages = await StatusPage.find({ userId: req.userId! }).sort({ createdAt: 1 }).lean();
  res.json({ statusPages: pages.map(serialize) });
};

export const createStatusPage = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const body = parseBody(createStatusPageSchema, req, res);
  if (!body) return;

  const websiteIds = await resolveWebsiteIds(userId, body.websiteIds ?? []);
  if (!websiteIds) {
    res.status(400).json({ message: "One or more monitors were not found." });
    return;
  }
  if ((await StatusPage.countDocuments({ userId })) >= MAX_STATUS_PAGES_PER_USER) {
    res.status(403).json({ message: `Status page limit reached (${MAX_STATUS_PAGES_PER_USER}).` });
    return;
  }

  try {
    const page = await StatusPage.create({ ...body, websiteIds, userId });
    clearPublicCache();
    res.status(201).json(serialize(page.toObject()));
  } catch (err) {
    if (isDuplicateKey(err)) {
      res.status(409).json({ message: "That URL is already taken." });
      return;
    }
    throw err;
  }
};

export const updateStatusPage = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const id = req.params.statusPageId;
  if (!isValidId(id)) {
    res.status(400).json({ error: "Invalid status page id." });
    return;
  }

  const body = parseBody(updateStatusPageSchema, req, res);
  if (!body) return;
  const websiteIds = body.websiteIds ? await resolveWebsiteIds(userId, body.websiteIds) : undefined;
  if (websiteIds === null) {
    res.status(400).json({ message: "One or more monitors were not found." });
    return;
  }

  const update = websiteIds ? { ...body, websiteIds } : body;
  try {
    const page = await StatusPage.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!page) {
      res.status(404).json({ error: "Status page not found." });
      return;
    }
    // Unpublishing, renaming or removing monitors must show up immediately.
    clearPublicCache();
    res.json(serialize(page));
  } catch (err) {
    if (isDuplicateKey(err)) {
      res.status(409).json({ message: "That URL is already taken." });
      return;
    }
    throw err;
  }
};

export const deleteStatusPage = async (req: Request, res: Response) => {
  const id = req.params.statusPageId;
  if (!isValidId(id)) {
    res.status(400).json({ error: "Invalid status page id." });
    return;
  }
  const result = await StatusPage.deleteOne({ _id: id, userId: req.userId! });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "Status page not found." });
    return;
  }
  clearPublicCache();
  res.json({ message: "Status page deleted." });
};
