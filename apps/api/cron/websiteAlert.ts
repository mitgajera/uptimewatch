import { AlertChannel, Notification, User, Website } from "db/client";
import { deliver } from "../notify/channels";
import { deliverToTargets, MAX_DELIVERY_ATTEMPTS, resolveTargets } from "../notify/dispatch";

const BATCH_SIZE = 100;

function log(message: string, data: Record<string, unknown> = {}) {
  console.log(`[${new Date().toISOString()}] [ALERTS] ${message}`, data);
}

let running = false;

export interface DispatchDeps {
  deliver: typeof deliver;
}

/** Deliver pending notifications to each user's alert channels. */
export async function dispatchPendingNotifications(deps: DispatchDeps = { deliver }) {
  if (running) return;
  running = true;

  try {
    const now = new Date();
    const notifications = await Notification.find({
      sent: false,
      attempts: { $not: { $gte: MAX_DELIVERY_ATTEMPTS } },
      $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
    })
      .sort({ createdAt: 1 })
      .limit(BATCH_SIZE)
      .lean();
    if (notifications.length === 0) return;

    const userIds = [...new Set(notifications.map((n) => n.userId))];
    const websiteIds = [
      ...new Set(notifications.filter((n) => n.websiteId).map((n) => String(n.websiteId))),
    ];
    const [users, channels, websites] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select("email").lean(),
      // Disabled channels too: they decide whether the account-email fallback applies.
      AlertChannel.find({ userId: { $in: userIds } }).lean(),
      websiteIds.length
        ? Website.find({ _id: { $in: websiteIds } }).select("alertChannelIds").lean()
        : Promise.resolve([]),
    ]);
    const emailByUser = new Map(users.map((u) => [String(u._id), u.email]));
    // Per-monitor routing: which channels each monitor's alerts go to.
    const routesByWebsite = new Map(
      (websites as { _id: unknown; alertChannelIds?: unknown[] }[]).map((w) => [
        String(w._id),
        (w.alertChannelIds ?? []).map(String),
      ])
    );

    for (const notif of notifications) {
      const targets = resolveTargets(
        channels
          .filter((c) => c.userId === notif.userId)
          .map((c) => ({
            id: String(c._id),
            type: c.type,
            target: c.target,
            chatId: c.chatId ?? null,
            enabled: c.enabled,
          })),
        emailByUser.get(notif.userId),
        notif.websiteId ? routesByWebsite.get(String(notif.websiteId)) ?? [] : []
      );

      const outcome = await deliverToTargets(
        {
          kind: notif.kind,
          subject: notif.subject || "UptimeWatch alert",
          message: notif.message,
          websiteId: notif.websiteId ? String(notif.websiteId) : null,
          createdAt: notif.createdAt,
        },
        targets,
        notif,
        deps.deliver,
        now.getTime()
      );

      await Notification.updateOne({ _id: notif._id }, { $set: outcome });
      if (outcome.lastError) {
        log("Delivery problem", { notificationId: notif._id, error: outcome.lastError });
      }
    }
  } catch (err) {
    log("Error dispatching notifications", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    running = false;
  }
}
