import type { Request, Response } from "express";
import { z } from "zod";
import { ALERT_CHANNEL_TYPES, MONITOR_INTERVALS } from "db/constants";
import { isValidExpectedStatus } from "../monitor/expectedStatus";

const monitorFields = {
  name: z.string().trim().max(100),
  url: z.string().trim().min(1, "URL is required").max(2048),
  method: z.enum(["GET", "HEAD", "POST"]),
  intervalSeconds: z
    .number()
    .int()
    .refine((v) => (MONITOR_INTERVALS as readonly number[]).includes(v), {
      message: `Interval must be one of ${MONITOR_INTERVALS.join(", ")} seconds`,
    }),
  timeoutMs: z.number().int().min(1000).max(30_000),
  expectedStatus: z
    .string()
    .trim()
    .refine(isValidExpectedStatus, { message: 'Use codes and ranges like "200-299,301"' }),
  keyword: z.string().max(200),
  followRedirects: z.boolean(),
  failureThreshold: z.number().int().min(1).max(10),
  paused: z.boolean(),
  graceSeconds: z.number().int().min(0).max(86_400),
};

export const createMonitorSchema = z
  .object({ ...monitorFields, type: z.enum(["http", "heartbeat"]) })
  .partial()
  .strict()
  // Heartbeats are pinged by the user's job, so only HTTP monitors need a URL.
  .refine((m) => m.type === "heartbeat" || Boolean(m.url), {
    path: ["url"],
    message: "URL is required",
  });

const MAX_MAINTENANCE_MS = 7 * 24 * 60 * 60 * 1000;

export const updateMonitorSchema = z
  .object({
    ...monitorFields,
    /** ISO time a maintenance window ends, or null to end it now. */
    maintenanceUntil: z
      .string()
      .datetime({ offset: true })
      .refine((v) => new Date(v).getTime() - Date.now() <= MAX_MAINTENANCE_MS, {
        message: "Maintenance windows can last at most 7 days",
      })
      .nullable(),
  })
  .partial()
  .strict();

export const createAlertChannelSchema = z
  .object({
    type: z.enum(ALERT_CHANNEL_TYPES as [string, ...string[]]),
    name: z.string().trim().max(100).optional(),
    target: z.string().trim().min(1).max(2048),
    enabled: z.boolean().optional(),
  })
  .strict();

export const updateAlertChannelSchema = z
  .object({
    name: z.string().trim().max(100),
    target: z.string().trim().min(1).max(2048),
    enabled: z.boolean(),
  })
  .partial()
  .strict();

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

const statusPageFields = {
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/,
      "3-48 characters: lowercase letters, numbers and dashes"
    ),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  websiteIds: z.array(objectId).max(50),
  published: z.boolean(),
};

export const createStatusPageSchema = z
  .object(statusPageFields)
  .partial()
  .required({ slug: true, title: true })
  .strict();

export const updateStatusPageSchema = z.object(statusPageFields).partial().strict();

/**
 * Validate `req.body` against `schema`. On failure responds 400 with the
 * first issue as `message` (for simple UIs) plus every issue, and returns null.
 */
export function parseBody<S extends z.ZodType>(
  schema: S,
  req: Request,
  res: Response
): z.infer<S> | null {
  const result = schema.safeParse(req.body ?? {});
  if (result.success) return result.data;

  const issues = result.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  const first = issues[0];
  res.status(400).json({
    message: first ? (first.path ? `${first.path}: ${first.message}` : first.message) : "Invalid request",
    issues,
  });
  return null;
}
