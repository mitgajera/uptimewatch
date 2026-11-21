import { Schema, model, models, Model } from "mongoose";

/**
 * A named, expiring lock used so only one process runs each background job
 * at a time when the API/worker is scaled to several instances.
 */
export interface ILease {
  _id: string; // lease name, e.g. "job:monitor"
  owner: string;
  expiresAt: Date;
}

const leaseSchema = new Schema<ILease>(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false, versionKey: false }
);

export const Lease: Model<ILease> =
  (models.Lease as Model<ILease>) || model<ILease>("Lease", leaseSchema);
