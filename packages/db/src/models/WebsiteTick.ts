import { Schema, model, models, Types, Model } from "mongoose";

export type WebsiteStatus = "UP" | "DOWN";

export interface IWebsiteTick {
  _id: Types.ObjectId;
  websiteId: Types.ObjectId;
  status: WebsiteStatus;
  latency: number;
  statusCode?: number | null;
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
    // Optional label for the monitor that produced this tick (e.g. a region name).
    region: { type: String, default: "central" },
  },
  { timestamps: true }
);

// Fast range queries for analytics (per website, by time).
websiteTickSchema.index({ websiteId: 1, createdAt: -1 });

export const WebsiteTick: Model<IWebsiteTick> =
  (models.WebsiteTick as Model<IWebsiteTick>) ||
  model<IWebsiteTick>("WebsiteTick", websiteTickSchema);
