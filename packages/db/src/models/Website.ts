import { Schema, model, models, Types, Model } from "mongoose";
import {
  DNS_RECORD_TYPES,
  KEYWORD_MODES,
  MONITOR_DEFAULTS,
  MONITOR_INTERVALS,
  MONITOR_METHODS,
  MONITOR_TYPES,
  REMINDER_MINUTES,
  type DnsRecordType,
  type KeywordMode,
  type MonitorHeader,
  type MonitorMethod,
  type MonitorType,
} from "../constants";

export type { MonitorMethod, MonitorType, KeywordMode, DnsRecordType, MonitorHeader };
export { MONITOR_DEFAULTS, MONITOR_INTERVALS };

export interface IWebsite {
  _id: Types.ObjectId;
  type: MonitorType;
  /** Target URL for http monitors; empty for the other types. */
  url: string;
  /** Target host for tcp and dns monitors; empty otherwise. */
  host: string;
  /** TCP port (tcp monitors only). */
  port?: number | null;
  dnsRecordType: DnsRecordType;
  /** Text some DNS answer must contain (case-insensitive); empty = any answer is UP. */
  dnsExpected: string;
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
  /** If set, the response body must contain (or, with keywordMode "absent", must not contain) this text. */
  keyword: string;
  keywordMode: KeywordMode;
  /** Extra request headers sent with http checks. */
  headers: MonitorHeader[];
  /** Request body, sent only for POST/PUT/PATCH. */
  body: string;
  followRedirects: boolean;
  /** An UP check slower than this marks the monitor degraded (null = off). */
  degradedThresholdMs?: number | null;
  /** Consecutive failed checks required before an incident is opened. */
  failureThreshold: number;
  paused: boolean;
  /** While in the future, checks and alerts are suspended for planned work. */
  maintenanceUntil?: Date | null;
  tags: string[];
  /** Channels that receive this monitor's alerts; empty = all enabled channels. */
  alertChannelIds: Types.ObjectId[];
  /** While down, re-alert every N minutes (0 = off). */
  reminderMinutes: number;

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
  lastErrorMessage?: string | null;
  isDegraded: boolean;
  /** When the last REMINDER for the current incident was queued. */
  lastReminderAt?: Date | null;

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
    type: { type: String, enum: MONITOR_TYPES, default: MONITOR_DEFAULTS.type },
    url: {
      type: String,
      default: "",
      required: function (this: { type?: MonitorType }) {
        return (this.type ?? "http") === "http";
      },
    },
    host: { type: String, default: MONITOR_DEFAULTS.host, maxlength: 253 },
    port: { type: Number, min: 1, max: 65_535, default: null },
    dnsRecordType: { type: String, enum: DNS_RECORD_TYPES, default: MONITOR_DEFAULTS.dnsRecordType },
    dnsExpected: { type: String, default: MONITOR_DEFAULTS.dnsExpected, maxlength: 200 },
    name: { type: String, default: "" },
    userId: { type: String, required: true, index: true },
    disabled: { type: Boolean, default: false },
    isDown: { type: Boolean, default: false },

    method: { type: String, enum: MONITOR_METHODS, default: MONITOR_DEFAULTS.method },
    intervalSeconds: {
      type: Number,
      enum: MONITOR_INTERVALS,
      default: MONITOR_DEFAULTS.intervalSeconds,
    },
    timeoutMs: { type: Number, min: 1000, max: 30_000, default: MONITOR_DEFAULTS.timeoutMs },
    expectedStatus: { type: String, default: MONITOR_DEFAULTS.expectedStatus },
    keyword: { type: String, default: MONITOR_DEFAULTS.keyword, maxlength: 200 },
    keywordMode: { type: String, enum: KEYWORD_MODES, default: MONITOR_DEFAULTS.keywordMode },
    headers: {
      type: [
        {
          _id: false,
          name: { type: String, required: true, maxlength: 64 },
          value: { type: String, default: "", maxlength: 1000 },
        },
      ],
      default: [],
    },
    body: { type: String, default: MONITOR_DEFAULTS.body, maxlength: 10_000 },
    followRedirects: { type: Boolean, default: MONITOR_DEFAULTS.followRedirects },
    degradedThresholdMs: { type: Number, min: 100, max: 30_000, default: null },
    failureThreshold: {
      type: Number,
      min: 1,
      max: 10,
      default: MONITOR_DEFAULTS.failureThreshold,
    },
    paused: { type: Boolean, default: MONITOR_DEFAULTS.paused },
    tags: { type: [String], default: [] },
    alertChannelIds: { type: [{ type: Schema.Types.ObjectId, ref: "AlertChannel" }], default: [] },
    reminderMinutes: {
      type: Number,
      enum: REMINDER_MINUTES,
      default: MONITOR_DEFAULTS.reminderMinutes,
    },

    maintenanceUntil: { type: Date, default: null },
    heartbeatToken: { type: String, default: null },
    graceSeconds: { type: Number, min: 0, max: 86_400, default: MONITOR_DEFAULTS.graceSeconds },
    lastHeartbeatAt: { type: Date, default: null },

    consecutiveFailures: { type: Number, default: 0 },
    lastCheckedAt: { type: Date, default: null },
    lastStatusCode: { type: Number, default: null },
    lastLatency: { type: Number, default: null },
    lastErrorType: { type: String, default: null },
    lastErrorMessage: { type: String, default: null, maxlength: 500 },
    isDegraded: { type: Boolean, default: false },
    lastReminderAt: { type: Date, default: null },

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
