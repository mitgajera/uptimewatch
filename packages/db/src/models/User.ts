import { Schema, model, models, Model } from "mongoose";

export interface IUser {
  _id: string; // Clerk user id
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    // We use the Clerk user id as the primary key so it stays in sync with auth.
    _id: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String, default: "" },
  },
  { timestamps: true, _id: false }
);

export const User: Model<IUser> =
  (models.User as Model<IUser>) || model<IUser>("User", userSchema);
