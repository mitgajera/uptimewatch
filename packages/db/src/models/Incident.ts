import { Schema, model, models, Types, Model } from "mongoose";
import { CHECK_ERROR_TYPES, type CheckErrorType } from "./WebsiteTick";

export interface IIncident {
  _id: Types.ObjectId;
  websiteId: Types.ObjectId;
  userId: string; // Clerk user id (User._id)
  startedAt: Date;
  resolvedAt?: Date | null;
  durationMs?: number | null;
  ongoing: boolean;
  lastStatusCode?: number | null;
  /** Cause of the failure that opened the incident. */
  errorType?: CheckErrorType | null;
  errorMessage?: string | null;
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
    errorType: { type: String, enum: [...CHECK_ERROR_TYPES, null], default: null },
    errorMessage: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

export const Incident: Model<IIncident> =
  (models.Incident as Model<IIncident>) || model<IIncident>("Incident", incidentSchema);
