import { Schema, model, models, Types, Model } from "mongoose";

export interface IIncident {
  _id: Types.ObjectId;
  websiteId: Types.ObjectId;
  userId: string; // Clerk user id (User._id)
  startedAt: Date;
  resolvedAt?: Date | null;
  durationMs?: number | null;
  ongoing: boolean;
  lastStatusCode?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const incidentSchema = new Schema<IIncident>(
  {
    websiteId: {
      type: Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true,
    },
    userId: { type: String, required: true, index: true },
    startedAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    ongoing: { type: Boolean, default: true, index: true },
    lastStatusCode: { type: Number, default: null },
  },
  { timestamps: true }
);

export const Incident: Model<IIncident> =
  (models.Incident as Model<IIncident>) || model<IIncident>("Incident", incidentSchema);
