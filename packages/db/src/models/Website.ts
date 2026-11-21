import { Schema, model, models, Types, Model } from "mongoose";

export type MonitorMethod = "GET" | "HEAD" | "POST";

/** Allowed check intervals, in seconds. */
export const MONITOR_INTERVALS = [60, 120, 300, 600, 900, 1800, 3600] as const;

/** Defaults applied to monitors (including legacy documents missing a field). */
export const MONITOR_DEFAULTS = {
  method: "GET" as MonitorMethod,
  intervalSeconds: 60,
  timeoutMs: 10_000,
  expectedStatus: "200-399",
  keyword: "",
  followRedirects: true,
  failureThreshold: 2,
  paused: false,
};

export interface IWebsite {
  _id: Types.ObjectId;
  url: string;
  name: string;
  userId: string; // Clerk user id (User._id)
  disabled: boolean;
  isDown: boolean;

  // Check configuration
  method: MonitorMethod;
  intervalSeconds: number;
  timeoutMs: number;
  /** Comma-separated codes and ranges considered UP, e.g. "200-299,301". */
  expectedStatus: string;
  /** If set, the response body must contain this text to be UP. */
  keyword: string;
  followRedirects: boolean;
  /** Consecutive failed checks required before an incident is opened. */
  failureThreshold: number;
  paused: boolean;

  // Runtime state maintained by the monitor
  consecutiveFailures: number;
  lastCheckedAt?: Date | null;
  lastStatusCode?: number | null;
  lastLatency?: number | null;
  lastErrorType?: string | null;

  // TLS certificate tracking (https monitors only)
  sslExpiresAt?: Date | null;
  sslIssuer?: string | null;
  sslCheckedAt?: Date | null;
  /** Days-remaining threshold we last alerted for, to avoid repeat alerts. */
  sslAlertedThreshold?: number | null;

  createdAt: Date;
  updatedAt: Date;
}

const websiteSchema = new Schema<IWebsite>(
  {
    url: { type: String, required: true },
    name: { type: String, default: "" },
    userId: { type: String, required: true, index: true },
    disabled: { type: Boolean, default: false },
    isDown: { type: Boolean, default: false },

    method: { type: String, enum: ["GET", "HEAD", "POST"], default: MONITOR_DEFAULTS.method },
    intervalSeconds: {
      type: Number,
      enum: MONITOR_INTERVALS,
      default: MONITOR_DEFAULTS.intervalSeconds,
    },
    timeoutMs: { type: Number, min: 1000, max: 30_000, default: MONITOR_DEFAULTS.timeoutMs },
    expectedStatus: { type: String, default: MONITOR_DEFAULTS.expectedStatus },
    keyword: { type: String, default: MONITOR_DEFAULTS.keyword, maxlength: 200 },
    followRedirects: { type: Boolean, default: MONITOR_DEFAULTS.followRedirects },
    failureThreshold: {
      type: Number,
      min: 1,
      max: 10,
      default: MONITOR_DEFAULTS.failureThreshold,
    },
    paused: { type: Boolean, default: MONITOR_DEFAULTS.paused },

    consecutiveFailures: { type: Number, default: 0 },
    lastCheckedAt: { type: Date, default: null },
    lastStatusCode: { type: Number, default: null },
    lastLatency: { type: Number, default: null },
    lastErrorType: { type: String, default: null },

    sslExpiresAt: { type: Date, default: null },
    sslIssuer: { type: String, default: null },
    sslCheckedAt: { type: Date, default: null },
    sslAlertedThreshold: { type: Number, default: null },
  },
  { timestamps: true }
);

// The scheduler scans active monitors on every tick.
websiteSchema.index({ disabled: 1, paused: 1, lastCheckedAt: 1 });

export const Website: Model<IWebsite> =
  (models.Website as Model<IWebsite>) || model<IWebsite>("Website", websiteSchema);
