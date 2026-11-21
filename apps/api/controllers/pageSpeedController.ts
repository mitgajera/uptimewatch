import type { Request, Response } from "express";
import axios from "axios";
import { findUserWebsiteOr404 } from "../utils/websites";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
/** Lighthouse runs are slow and quota-limited; reuse recent results. */
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, { expires: number; data: unknown }>();

/**
 * GET /website/:websiteId/pagespeed?strategy=desktop|mobile
 * Proxies Google PageSpeed Insights so the API key stays server-side.
 */
export const getPageSpeed = async (req: Request, res: Response) => {
  const website = await findUserWebsiteOr404(res, {
    websiteId: req.params.websiteId!,
    userId: req.userId!,
    disabled: false,
  });
  if (!website) return;

  const key = process.env.PSI_API_KEY;
  if (!key) {
    res.status(503).json({ message: "PageSpeed Insights is not configured (PSI_API_KEY)." });
    return;
  }

  const strategy = req.query.strategy === "mobile" ? "mobile" : "desktop";
  const cacheKey = `${website.url}|${strategy}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    res.json(hit.data);
    return;
  }

  const params = new URLSearchParams({ url: website.url, key, strategy });
  for (const c of CATEGORIES) params.append("category", c);

  try {
    const { data } = await axios.get(`${PSI_ENDPOINT}?${params}`, { timeout: 60_000 });
    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, data });
    res.json(data);
  } catch (err) {
    const e = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
    const message = e.response?.data?.error?.message || "PageSpeed Insights request failed.";
    res.status(502).json({ message });
  }
};
