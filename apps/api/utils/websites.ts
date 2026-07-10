import type { Response } from "express";
import { Website } from "db/client";

/**
 * Fetch a single website scoped to a user. If none matches, responds with a
 * 404 and returns null so callers can `if (!website) return;`.
 */
export async function findUserWebsiteOr404(
  res: Response,
  filter: { websiteId: string; userId?: string; disabled?: boolean }
) {
  const query: Record<string, unknown> = {
    _id: filter.websiteId,
    userId: filter.userId,
  };
  if (filter.disabled !== undefined) query.disabled = filter.disabled;

  const website = await Website.findOne(query).lean();
  if (!website) {
    res.status(404).json({ error: "Website not found." });
    return null;
  }
  return website;
}
