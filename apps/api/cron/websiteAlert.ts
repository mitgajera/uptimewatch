import cron from "node-cron";
import { Notification, User } from "db/client";
import { sendEmail } from "../lib/email"; // email helper

export const scheduleWebsiteAlert = () => {
  cron.schedule("*/2 * * * *", async () => {
    console.log("[CRON] Checking for unsent notifications...");

    try {
      const notifications = await Notification.find({ sent: false })
        .limit(10) // avoid spikes
        .lean();

      for (const notif of notifications) {
        if (!notif.userId) continue;

        const user = await User.findById(notif.userId).select("email").lean();
        if (!user || !user.email) continue;

        try {
          await sendEmail({
            to: user.email,
            subject: "🔔 New Notification",
            text: notif.message,
          });

          await Notification.updateOne({ _id: notif._id }, { $set: { sent: true } });

          console.log(`[CRON] Sent and updated notif ${notif._id}`);
        } catch (err) {
          console.error(`[CRON] Failed to send notif ${notif._id}:`, err);
        }
      }
    } catch (err) {
      console.error("[CRON] Error fetching notifications:", err);
    }
  });
};
