import { Schema, model, models, Types, Model } from "mongoose";
import { CHECK_ERROR_TYPES, type CheckErrorType } from "./WebsiteTick";
import { INCIDENT_UPDATE_STATUSES, type IncidentUpdateStatus } from "../constants";

export type { IncidentUpdateStatus };

/** A timeline entry on an incident (posted by the owner or the monitor). */
export interface IIncidentUpdate {
  _id: Types.ObjectId;
  at: Date;
  message: string;
  status: IncidentUpdateStatus;
  /** Shown on public status pages. */
  public: boolean;
}

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
  acknowledgedAt?: Date | null;
  updates: IIncidentUpdate[];
  createdAt: Date;
  updatedAt: Date;
}

const incidentUpdateSchema = new Schema<IIncidentUpdate>({
  at: { type: Date, required: true, default: Date.now },
  message: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: INCIDENT_UPDATE_STATUSES, required: true },
  public: { type: Boolean, default: false },
});

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
    acknowledgedAt: { type: Date, default: null },
    updates: { type: [incidentUpdateSchema], default: [] },
  },
  { timestamps: true }
);

// The incidents list pages through a user's incidents newest first.
incidentSchema.index({ userId: 1, startedAt: -1 });

export const Incident: Model<IIncident> =
  (models.Incident as Model<IIncident>) || model<IIncident>("Incident", incidentSchema);
