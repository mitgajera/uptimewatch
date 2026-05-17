import mongoose from "mongoose";

export { User } from "./models/User";
export type { IUser } from "./models/User";
export { Website } from "./models/Website";
export type { IWebsite } from "./models/Website";
export { WebsiteTick } from "./models/WebsiteTick";
export type { IWebsiteTick, WebsiteStatus } from "./models/WebsiteTick";
export { Notification } from "./models/Notification";
export type { INotification } from "./models/Notification";
export { Incident } from "./models/Incident";
export type { IIncident } from "./models/Incident";

let connectionPromise: Promise<typeof mongoose> | null = null;

/**
 * Connect to MongoDB. Safe to call multiple times — the underlying connection
 * is memoized so repeated calls reuse the same connection.
 */
export async function connectDB(uri?: string): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (!connectionPromise) {
    const mongoUri =
      uri || process.env.MONGODB_URI || "mongodb://localhost:27017/uptimewatch";

    mongoose.set("strictQuery", true);
    connectionPromise = mongoose.connect(mongoUri).then((m) => {
      console.log("[DB] Connected to MongoDB");
      return m;
    });
  }

  return connectionPromise;
}

export { mongoose };
