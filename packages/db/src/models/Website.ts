import { Schema, model, models, Types, Model } from "mongoose";
import { MONITOR_DEFAULTS, MONITOR_INTERVALS, type MonitorMethod, type MonitorType } from "../constants";

export type { MonitorMethod, MonitorType };
export { MONITOR_DEFAULTS, MONITOR_INTERVALS };

export interface IWebsite {
  _id: Types.ObjectId;
  type: MonitorType;
  /** Target URL for http monitors; empty for heartbeats. */
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
  /** While in the future, checks and alerts are suspended for planned work. */
  maintenanceUntil?: Date | null;

  // Heartbeat monitors
  /** Secret path segment for the ping URL. */
  heartbeatToken?: string | null;
  graceSeconds: number;
  lastHeartbeatAt?: Date | null;

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
    type: { type: String, enum: ["http", "heartbeat"], default: MONITOR_DEFAULTS.type },
    url: {
      type: String,
      default: "",
      required: function (this: { type?: MonitorType }) {
        return this.type !== "heartbeat";
      },
    },
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

    maintenanceUntil: { type: Date, default: null },
    heartbeatToken: { type: String, default: null },
    graceSeconds: { type: Number, min: 0, max: 86_400, default: MONITOR_DEFAULTS.graceSeconds },
    lastHeartbeatAt: { type: Date, default: null },

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

// Ping lookups; sparse because http monitors have no token.
websiteSchema.index(
  { heartbeatToken: 1 },
  { unique: true, partialFilterExpression: { heartbeatToken: { $type: "string" } } }
);

// The scheduler scans active monitors on every tick.
websiteSchema.index({ disabled: 1, paused: 1, lastCheckedAt: 1 });

export const Website: Model<IWebsite> =
  (models.Website as Model<IWebsite>) || model<IWebsite>("Website", websiteSchema);
