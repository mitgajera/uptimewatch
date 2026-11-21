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
};

export const createMonitorSchema = z
  .object(monitorFields)
  .partial()
  .required({ url: true })
  .strict();

export const updateMonitorSchema = z.object(monitorFields).partial().strict();

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
