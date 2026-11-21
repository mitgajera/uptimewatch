import { Schema, model, models, Types, Model } from "mongoose";

export type NotificationKind = "DOWN" | "UP" | "SSL_EXPIRY" | "TEST";

export interface INotification {
  _id: Types.ObjectId;
  userId: string; // Clerk user id (User._id)
  websiteId?: Types.ObjectId | null;
  kind?: NotificationKind | null;
  subject?: string | null;
  message: string;
  sent: boolean;
  /** Delivery attempts so far; delivery is abandoned after a few failures. */
  attempts: number;
  lastError?: string | null;
  /** Hashes of the targets that already accepted this alert (never re-sent). */
  deliveredTo: string[];
  /** Earliest time of the next delivery attempt (retry backoff). */
  nextAttemptAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true, index: true },
    websiteId: { type: Schema.Types.ObjectId, ref: "Website", default: null },
    kind: { type: String, enum: ["DOWN", "UP", "SSL_EXPIRY", "TEST"], default: null },
    subject: { type: String, default: null },
    message: { type: String, required: true },
    sent: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null, maxlength: 1000 },
    deliveredTo: { type: [String], default: [] },
    nextAttemptAt: { type: Date, default: null },
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
