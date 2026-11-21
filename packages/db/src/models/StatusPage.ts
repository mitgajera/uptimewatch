import { Schema, model, models, Types, Model } from "mongoose";

export interface IStatusPage {
  _id: Types.ObjectId;
  userId: string; // Clerk user id (User._id)
  /** Public URL segment: /status/<slug>. Lowercase letters, digits, dashes. */
  slug: string;
  title: string;
  description: string;
  websiteIds: Types.ObjectId[];
  /** Unpublished pages are only visible to their owner. */
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const statusPageSchema = new Schema<IStatusPage>(
  {
    userId: { type: String, required: true, index: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/,
    },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 500 },
    websiteIds: [{ type: Schema.Types.ObjectId, ref: "Website" }],
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const StatusPage: Model<IStatusPage> =
  (models.StatusPage as Model<IStatusPage>) ||
  model<IStatusPage>("StatusPage", statusPageSchema);
