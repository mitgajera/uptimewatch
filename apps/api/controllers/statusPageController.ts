import type { Request, Response } from "express";
import { StatusPage, Website } from "db/client";
import { isValidId } from "../utils/websites";
import { createStatusPageSchema, parseBody, updateStatusPageSchema } from "../validation";

const MAX_STATUS_PAGES_PER_USER = 5;

const serialize = (p: any) => ({
  id: String(p._id),
  slug: p.slug,
  title: p.title,
  description: p.description ?? "",
  websiteIds: (p.websiteIds ?? []).map(String),
  published: p.published ?? true,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

/** True when every id is an active monitor owned by the user. */
async function ownsWebsites(userId: string, ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return true;
  const count = await Website.countDocuments({ _id: { $in: unique }, userId, disabled: false });
  return count === unique.length;
}

export const listStatusPages = async (req: Request, res: Response) => {
  const pages = await StatusPage.find({ userId: req.userId! }).sort({ createdAt: 1 }).lean();
  res.json({ statusPages: pages.map(serialize) });
};

export const createStatusPage = async (req: Request, res: Response) => {
  const userId = req.userId!;
  const body = parseBody(createStatusPageSchema, req, res);
  if (!body) return;

  if (!(await ownsWebsites(userId, body.websiteIds ?? []))) {
    res.status(400).json({ message: "One or more monitors were not found." });
    return;
  }
  if ((await StatusPage.countDocuments({ userId })) >= MAX_STATUS_PAGES_PER_USER) {
    res.status(403).json({ message: `Status page limit reached (${MAX_STATUS_PAGES_PER_USER}).` });
    return;
  }

  try {
    const page = await StatusPage.create({
      ...body,
      websiteIds: [...new Set(body.websiteIds ?? [])],
      userId,
    });
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
  if (body.websiteIds && !(await ownsWebsites(userId, body.websiteIds))) {
    res.status(400).json({ message: "One or more monitors were not found." });
    return;
  }

  const update = body.websiteIds ? { ...body, websiteIds: [...new Set(body.websiteIds)] } : body;
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
  res.json({ message: "Status page deleted." });
};
