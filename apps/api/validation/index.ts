import { isIP } from "node:net";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  ALERT_CHANNEL_TYPES,
  DNS_RECORD_TYPES,
  FORBIDDEN_MONITOR_HEADERS,
  INCIDENT_UPDATE_STATUSES,
  KEYWORD_MODES,
  MAX_MONITOR_BODY,
  MAX_MONITOR_HEADERS,
  MAX_MONITOR_TAGS,
  MONITOR_INTERVALS,
  MONITOR_METHODS,
  MONITOR_TAG_RE,
  MONITOR_TYPES,
  REMINDER_MINUTES,
} from "db/constants";
import { isValidExpectedStatus } from "../monitor/expectedStatus";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

// Labels may contain underscores so DNS monitors can query e.g. _dmarc records.
const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9])?)(?:\.[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9])?)*\.?$/;

/** A hostname or an IP literal (IPv6 with or without brackets). */
export function isValidHost(host: string): boolean {
  if (host.length === 0 || host.length > 253) return false;
  if (isIP(host.replace(/^\[|\]$/g, ""))) return true;
  return HOSTNAME_RE.test(host);
}

/** Trim + lower-case a tag, then check it against the allowed shape. */
export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(MONITOR_TAG_RE, "Tags are 1-24 characters: a-z, 0-9, space, _ or -");

const headerSchema = z
  .object({
    name: z.string().trim().regex(/^[A-Za-z0-9-]{1,64}$/, "Header names are 1-64 letters, digits or dashes"),
    value: z
      .string()
      .max(1000)
      .refine((v) => !/[\r\n\0]/.test(v), { message: "Header values can't contain line breaks" }),
  })
  .strict()
  .refine((h) => !FORBIDDEN_MONITOR_HEADERS.includes(h.name.toLowerCase()), {
    message: "Host and Content-Length headers are set automatically",
    path: ["name"],
  });

const monitorFields = {
  name: z.string().trim().max(100),
  url: z.string().trim().min(1, "URL is required").max(2048),
  method: z.enum(MONITOR_METHODS),
  headers: z.array(headerSchema).max(MAX_MONITOR_HEADERS),
  body: z.string().max(MAX_MONITOR_BODY),
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
  keywordMode: z.enum(KEYWORD_MODES),
  followRedirects: z.boolean(),
  degradedThresholdMs: z.number().int().min(100).max(30_000).nullable(),
  host: z
    .string()
    .trim()
    .max(253)
    .refine(isValidHost, { message: "Enter a hostname or IP address" }),
  port: z.number().int().min(1).max(65_535),
  dnsRecordType: z.enum(DNS_RECORD_TYPES),
  dnsExpected: z.string().trim().max(200),
  failureThreshold: z.number().int().min(1).max(10),
  paused: z.boolean(),
  graceSeconds: z.number().int().min(0).max(86_400),
  tags: z
    .array(tagSchema)
    .max(MAX_MONITOR_TAGS)
    .transform((tags) => [...new Set(tags)]),
  alertChannelIds: z
    .array(objectId)
    .max(50)
    .transform((ids) => [...new Set(ids)]),
  reminderMinutes: z
    .number()
    .int()
    .refine((v) => (REMINDER_MINUTES as readonly number[]).includes(v), {
      message: `Reminders must be one of ${REMINDER_MINUTES.join(", ")} minutes`,
    }),
};

export const createMonitorSchema = z
  .object({ ...monitorFields, type: z.enum(MONITOR_TYPES) })
  .partial()
  .strict()
  .superRefine((m, ctx) => {
    const type = m.type ?? "http";
    // Heartbeats are pinged by the user's job, so only HTTP monitors need a URL.
    if (type === "http" && !m.url) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "URL is required" });
    }
    if ((type === "tcp" || type === "dns") && !m.host) {
      ctx.addIssue({ code: "custom", path: ["host"], message: "Host is required" });
    }
    if (type === "tcp" && m.port === undefined) {
      ctx.addIssue({ code: "custom", path: ["port"], message: "Port is required" });
    }
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
    /** Start a window of this many minutes, timed by the server's clock. */
    maintenanceMinutes: z.number().int().min(1).max(MAX_MAINTENANCE_MS / 60_000),
  })
  .partial()
  .strict();

export const BULK_ACTIONS = ["pause", "resume", "delete", "addTag", "removeTag"] as const;

export const bulkMonitorSchema = z
  .object({
    ids: z
      .array(objectId)
      .min(1)
      .max(100)
      .transform((ids) => [...new Set(ids)]),
    action: z.enum(BULK_ACTIONS),
    tag: tagSchema.optional(),
  })
  .strict()
  .refine((b) => (b.action !== "addTag" && b.action !== "removeTag") || b.tag !== undefined, {
    path: ["tag"],
    message: "A tag is required for this action",
  });

const telegramChatId = z
  .string()
  .trim()
  .regex(/^(?:-?\d+|@[A-Za-z0-9_]{5,})$/, "Use a numeric chat id or @channelname")
  .max(100);

export const createAlertChannelSchema = z
  .object({
    type: z.enum(ALERT_CHANNEL_TYPES as [string, ...string[]]),
    name: z.string().trim().max(100).optional(),
    target: z.string().trim().min(1).max(2048),
    chatId: telegramChatId.optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((c) => c.type !== "telegram" || c.chatId !== undefined, {
    path: ["chatId"],
    message: "Telegram channels need a chat id",
  });

export const updateAlertChannelSchema = z
  .object({
    name: z.string().trim().max(100),
    target: z.string().trim().min(1).max(2048),
    chatId: telegramChatId,
    enabled: z.boolean(),
  })
  .partial()
  .strict();

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
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => {
        if (v === "") return true;
        try {
          return new URL(v).protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "Logo must be an https URL" }
    ),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #ea580c")
    .transform((v) => v.toLowerCase()),
  announcement: z.string().trim().max(500),
  showIncidentHistory: z.boolean(),
};

export const createStatusPageSchema = z
  .object(statusPageFields)
  .partial()
  .required({ slug: true, title: true })
  .strict();

export const updateStatusPageSchema = z.object(statusPageFields).partial().strict();

export const incidentUpdateSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    status: z.enum(INCIDENT_UPDATE_STATUSES),
    public: z.boolean(),
  })
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
