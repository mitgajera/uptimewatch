import type { Request, Response } from "express";
import { User } from "db/client";

/**
 * Sync the authenticated Clerk user into our database.
 * Called from the frontend after sign-in so we have the user's
 * email/name available for notifications.
 */
export const syncUser = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(403).json({ message: "Unauthorized. User not found in request." });
      return;
    }

    const { name, email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Missing email" });
      return;
    }

    await User.findByIdAndUpdate(
      userId,
      { name: name || "", email },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ message: "User synced successfully!" });
  } catch (err) {
    console.error("Sync user error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
