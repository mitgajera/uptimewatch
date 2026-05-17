import { Schema, model, models, Types, Model } from "mongoose";

export interface INotification {
  _id: Types.ObjectId;
  userId: string; // Clerk user id (User._id)
  message: string;
  sent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true, index: true },
    message: { type: String, required: true },
    sent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) ||
  model<INotification>("Notification", notificationSchema);
