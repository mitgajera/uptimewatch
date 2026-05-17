import { Schema, model, models, Types, Model } from "mongoose";

export interface IWebsite {
  _id: Types.ObjectId;
  url: string;
  name: string;
  userId: string; // Clerk user id (User._id)
  disabled: boolean;
  isDown: boolean;
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
  },
  { timestamps: true }
);

export const Website: Model<IWebsite> =
  (models.Website as Model<IWebsite>) || model<IWebsite>("Website", websiteSchema);
