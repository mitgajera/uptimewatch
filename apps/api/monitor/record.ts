import { Website, WebsiteTick, Notification, Incident } from "db/client";
import type { CheckResult } from "./httpCheck";
import { evaluateTransition } from "./transition";
import { downAlert, recoveryAlert } from "./messages";

function log(message: string, data: Record<string, any> = {}) {
  console.log(`[${new Date().toISOString()}] [MONITOR] ${message}`, data);
}

/**
 * Persist a check result for a monitor: write a tick, update its state, and
 * open/close incidents + queue DOWN/UP notifications when the state changes.
 */
export async function recordCheckResult(website: any, result: CheckResult) {
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

  const { event, consecutiveFailures, isDown } = evaluateTransition(website, result);

  await Website.updateOne(
    { _id: website._id },
    {
      $set: {
        isDown,
        consecutiveFailures,
        lastCheckedAt: new Date(),
        lastStatusCode: statusCode,
        lastLatency: latency,
        lastErrorType: errorType,
      },
    }
  );

  if (event === "WENT_DOWN") {
    log("Website is down (new incident)", { url: website.url, websiteId: website._id });
    await Incident.create({
      websiteId: website._id,
      userId: website.userId,
      startedAt: new Date(),
      ongoing: true,
      lastStatusCode: statusCode,
      errorType,
      errorMessage,
    });
    await Notification.create({
      userId: website.userId,
      websiteId: website._id,
      kind: "DOWN",
      ...downAlert(website, result),
    });
  }

  else if (event === "RECOVERED") {
    log("Website recovered", { url: website.url, websiteId: website._id });

    const openIncident = await Incident.findOne({
      websiteId: website._id,
      ongoing: true,
    }).sort({ startedAt: -1 });

    let downtimeMs: number | null = null;
    if (openIncident) {
      const resolvedAt = new Date();
      downtimeMs = resolvedAt.getTime() - openIncident.startedAt.getTime();
      openIncident.resolvedAt = resolvedAt;
      openIncident.ongoing = false;
      openIncident.durationMs = downtimeMs;
      await openIncident.save();
    }

    await Notification.create({
      userId: website.userId,
      websiteId: website._id,
      kind: "UP",
      ...recoveryAlert(website, downtimeMs),
    });
  }

  log("Recorded tick", { url: website.url, status, latency: `${latency}ms` });
}
