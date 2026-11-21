import type { Response } from "express";
import { Website } from "db/client";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/**
 * True when `id` is a well-formed Mongo ObjectId. Guards queries against
 * CastErrors (which would otherwise surface as 500s) for malformed ids.
 */
export function isValidId(id: unknown): id is string {
  return typeof id === "string" && OBJECT_ID_RE.test(id);
}

/**
 * Fetch a single website scoped to a user. If none matches, responds with a
 * 404 and returns null so callers can `if (!website) return;`. Malformed ids
 * get a 400.
 */
export async function findUserWebsiteOr404(
  res: Response,
  filter: { websiteId: string; userId?: string; disabled?: boolean }
) {
  if (!isValidId(filter.websiteId)) {
    res.status(400).json({ error: "Invalid website id." });
    return null;
  }

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
