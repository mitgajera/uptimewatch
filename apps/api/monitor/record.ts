import { Website, WebsiteTick, Notification, Incident } from "db/client";
import type { CheckResult } from "./httpCheck";
import { evaluateTransition } from "./transition";
import { downAlert, recoveryAlert } from "./messages";

function log(message: string, data: Record<string, any> = {}) {
  console.log(`[${new Date().toISOString()}] [MONITOR] ${message}`, data);
}

/** Matches a monitor whose UP/DOWN state is still `isDown` (missing counts as up). */
function stateFilter(id: unknown, isDown: boolean) {
  return { _id: id, isDown: isDown ? true : { $ne: true } };
}

/**
 * Persist a check result for a monitor: write a tick, update its state, and
 * open/close incidents + queue DOWN/UP notifications when the state changes.
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
    await open.save();
  }

  await Notification.create({
    userId: website.userId,
    websiteId: website._id,
    kind: "UP",
    ...recoveryAlert(website, downtimeMs),
  });
}
