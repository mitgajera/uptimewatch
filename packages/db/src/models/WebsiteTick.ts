import { Schema, model, models, Types, Model } from "mongoose";
import { CHECK_ERROR_TYPES, type CheckErrorType } from "../constants";

export type WebsiteStatus = "UP" | "DOWN";

export type { CheckErrorType };
export { CHECK_ERROR_TYPES };

export interface IWebsiteTick {
  _id: Types.ObjectId;
  websiteId: Types.ObjectId;
  status: WebsiteStatus;
  latency: number;
  statusCode?: number | null;
  errorType?: CheckErrorType | null;
  errorMessage?: string | null;
  region?: string;
  createdAt: Date;
  updatedAt: Date;
}

const websiteTickSchema = new Schema<IWebsiteTick>(
  {
    websiteId: {
      type: Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
    status: { type: String, enum: ["UP", "DOWN"], required: true },
    latency: { type: Number, required: true },
    statusCode: { type: Number, default: null },
    errorType: { type: String, enum: [...CHECK_ERROR_TYPES, null], default: null },
    errorMessage: { type: String, default: null, maxlength: 500 },
    // Optional label for the monitor that produced this tick (e.g. a region name).
    region: { type: String, default: "central" },
  },
  { timestamps: true }
);

// Fast range queries for analytics (per website, by time).
websiteTickSchema.index({ websiteId: 1, createdAt: -1 });

// Raw ticks are written once a minute per website, so keep them bounded.
// 90 days comfortably covers the longest analytics range (30d).
export const TICK_RETENTION_DAYS = 90;
websiteTickSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: TICK_RETENTION_DAYS * 24 * 60 * 60 }
);

export const WebsiteTick: Model<IWebsiteTick> =
  (models.WebsiteTick as Model<IWebsiteTick>) ||
  model<IWebsiteTick>("WebsiteTick", websiteTickSchema);
