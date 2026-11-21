import { Schema, model, models, Types, Model } from "mongoose";
import { ALERT_CHANNEL_TYPES, type AlertChannelType } from "../constants";

export type { AlertChannelType };

export interface IAlertChannel {
  _id: Types.ObjectId;
  userId: string; // Clerk user id (User._id)
  type: AlertChannelType;
  name: string;
  /** Email address for "email", webhook URL for the others. */
  target: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const alertChannelSchema = new Schema<IAlertChannel>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ALERT_CHANNEL_TYPES, required: true },
    name: { type: String, default: "", maxlength: 100 },
    target: { type: String, required: true, maxlength: 2048 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AlertChannel: Model<IAlertChannel> =
  (models.AlertChannel as Model<IAlertChannel>) ||
  model<IAlertChannel>("AlertChannel", alertChannelSchema);
