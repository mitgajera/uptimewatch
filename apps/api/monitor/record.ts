import { Website, WebsiteTick, Notification, Incident } from "db/client";
import type { CheckResult } from "./httpCheck";
import { evaluateTransition } from "./transition";
import { downAlert, formatDuration, recoveryAlert, reminderAlert } from "./messages";

function log(message: string, data: Record<string, any> = {}) {
  console.log(`[${new Date().toISOString()}] [MONITOR] ${message}`, data);
}

/** Matches a monitor whose UP/DOWN state is still `isDown` (missing counts as up). */
function stateFilter(id: unknown, isDown: boolean) {
  return { _id: id, isDown: isDown ? true : { $ne: true } };
}

/**
 * Whether an UP check was slow enough to mark the monitor degraded. Only
 * http and tcp monitors have a meaningful response time.
 */
export function isDegradedResult(
  website: { type?: string; degradedThresholdMs?: number | null },
  result: Pick<CheckResult, "status" | "latency">
): boolean {
  const type = website.type ?? "http";
  if (type !== "http" && type !== "tcp") return false;
  const threshold = website.degradedThresholdMs;
  return result.status === "UP" && typeof threshold === "number" && threshold > 0 && result.latency > threshold;
}

/**
 * Persist a check result for a monitor: write a tick, update its state, and
 * open/close incidents + queue DOWN/UP notifications when the state changes.
 * While a monitor stays down, REMINDER notifications are queued every
 * `reminderMinutes`.
 *
 * `checkedAt` is when the check started, so slow checks don't push the next
 * one past its slot.
 *
 * A state change is claimed with a compare-and-set on `isDown`, so overlapping
 * recordings can't both emit it. If writing its incident or notification then
 * fails, the claim is rolled back so the next check emits the change again;
 * the incident write is idempotent, so the retry doesn't duplicate it.
 */
export async function recordCheckResult(website: any, result: CheckResult, checkedAt = new Date()) {
  const { status, latency, statusCode, errorType, errorMessage } = result;
  if (status === "DOWN") {
    log("Check failed", { websiteId: website._id, url: website.url, statusCode, errorType, errorMessage });
  }

  await WebsiteTick.create({
    websiteId: website._id,
    status,
    latency,
    statusCode,
    errorType,
    errorMessage,
  });

  const wasDown = Boolean(website.isDown);
  const { event, consecutiveFailures, isDown } = evaluateTransition({ ...website, isDown: wasDown }, result);

  const update = await Website.updateOne(stateFilter(website._id, wasDown), {
    $set: {
      isDown,
      consecutiveFailures,
      lastCheckedAt: checkedAt,
      lastStatusCode: statusCode,
      lastLatency: latency,
      lastErrorType: errorType,
      lastErrorMessage: errorMessage ? errorMessage.slice(0, 500) : null,
      isDegraded: isDegradedResult(website, result),
      // A new incident restarts the reminder schedule.
      ...(event === "WENT_DOWN" ? { lastReminderAt: null } : {}),
    },
  });

  if (update.matchedCount === 0) {
    // Another recording changed the state first; it owns any transition.
    log("Monitor state changed concurrently; skipping transition", { websiteId: website._id, event });
    return;
  }

  if (event) {
    try {
      if (event === "WENT_DOWN") await openIncident(website, result);
      else await closeIncident(website);
    } catch (err) {
      await Website.updateOne(stateFilter(website._id, isDown), { $set: { isDown: wasDown } }).catch(() => {});
      throw err;
    }
  } else if (wasDown && isDown) {
    await maybeQueueReminder(website, result, checkedAt.getTime());
  }

  log("Recorded tick", { url: website.url, status, latency: `${latency}ms` });
}

async function openIncident(website: any, result: CheckResult) {
  log("Website is down (new incident)", { url: website.url, websiteId: website._id });
  await Incident.updateOne(
    { websiteId: website._id, ongoing: true },
    {
      $setOnInsert: {
        websiteId: website._id,
        userId: website.userId,
        startedAt: new Date(),
        ongoing: true,
        lastStatusCode: result.statusCode,
        errorType: result.errorType,
        errorMessage: result.errorMessage,
        acknowledgedAt: null,
        updates: [],
      },
    },
    { upsert: true }
  );
  await Notification.create({
    userId: website.userId,
    websiteId: website._id,
    kind: "DOWN",
    ...downAlert(website, result),
  });
}

async function closeIncident(website: any) {
  log("Website recovered", { url: website.url, websiteId: website._id });

  const open = await Incident.findOne({ websiteId: website._id, ongoing: true }).sort({ startedAt: -1 });

  let downtimeMs: number | null = null;
  if (open) {
    const resolvedAt = new Date();
    downtimeMs = resolvedAt.getTime() - open.startedAt.getTime();
    open.resolvedAt = resolvedAt;
    open.ongoing = false;
    open.durationMs = downtimeMs;
    const entry = {
      at: resolvedAt,
      message: `Recovered automatically after ${formatDuration(downtimeMs)} of downtime.`,
      status: "resolved" as const,
      public: false,
    };
    if (Array.isArray(open.updates)) open.updates.push(entry as any);
    else open.updates = [entry as any];
    await open.save();
  }

  await Notification.create({
    userId: website.userId,
    websiteId: website._id,
    kind: "UP",
    ...recoveryAlert(website, downtimeMs),
  });
}

/**
 * Whether a reminder is due for a monitor that is still down: every
 * `reminderMinutes` after the incident started (or after the last reminder).
 */
export function reminderDue(
  state: { reminderMinutes?: number; lastReminderAt?: Date | string | null },
  incidentStartedAt: Date | string,
  now: number
): boolean {
  const minutes = state.reminderMinutes ?? 0;
  if (!minutes || minutes <= 0) return false;
  const started = new Date(incidentStartedAt).getTime();
  const last = state.lastReminderAt ? new Date(state.lastReminderAt).getTime() : 0;
  // A reminder from an earlier incident doesn't count.
  const base = Math.max(started, last);
  return now - base >= minutes * 60_000;
}

async function maybeQueueReminder(website: any, result: CheckResult, now: number) {
  if (!website.reminderMinutes || website.reminderMinutes <= 0) return;

  const incident = await Incident.findOne({ websiteId: website._id, ongoing: true }).sort({ startedAt: -1 });
  if (!incident || !reminderDue(website, incident.startedAt, now)) return;

  // Claim the reminder with a compare-and-set so overlapping runs send it once.
  const previous = website.lastReminderAt ?? null;
  const claim = await Website.updateOne(
    { _id: website._id, isDown: true, lastReminderAt: previous },
    { $set: { lastReminderAt: new Date(now) } }
  );
  if (claim.matchedCount === 0) return;

  try {
    await Notification.create({
      userId: website.userId,
      websiteId: website._id,
      kind: "REMINDER",
      ...reminderAlert(website, now - new Date(incident.startedAt).getTime(), result),
    });
  } catch (err) {
    // Release the claim so the next check retries the reminder.
    await Website.updateOne(
      { _id: website._id, lastReminderAt: new Date(now) },
      { $set: { lastReminderAt: previous } }
    ).catch(() => {});
    throw err;
  }
}
