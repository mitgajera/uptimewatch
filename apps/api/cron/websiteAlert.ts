import cron from "node-cron";
import { Notification, User } from "db/client";
import { sendEmail } from "../lib/email";

export const scheduleWebsiteAlert = () => {
  cron.schedule("*/2 * * * *", async () => {
    console.log("[CRON] Checking for unsent notifications...");

    try {
      const notifications = await Notification.find({ sent: false })
        .limit(10)
        .lean();

      for (const notif of notifications) {
        if (!notif.userId) continue;

        const user = await User.findById(notif.userId).select("email").lean();
        if (!user?.email) continue;

        try {
          const result = await sendEmail({
            to: user.email,
            subject: "New Notification",
            text: notif.message,
          });

          if (!result.ok) {
            console.error(
              `[CRON] Email not sent for notif ${notif._id}: ${result.error}`
            );
            continue;
          }

          await Notification.updateOne({ _id: notif._id }, { $set: { sent: true } });

          if (result.skipped) {
            console.log(`[CRON] Email paused; marked notif ${notif._id} as sent`);
            continue;
          }

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
