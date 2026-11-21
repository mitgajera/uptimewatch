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

// The alert worker polls for unsent notifications.
notificationSchema.index({ sent: 1, createdAt: 1 });

// Notifications are a delivery queue, not history (incidents hold that).
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) ||
  model<INotification>("Notification", notificationSchema);
