import cron from "node-cron";
import { Website, WebsiteTick, Notification, Incident } from "db/client";
import { runHttpCheck } from "../monitor/httpCheck";
import { evaluateTransition } from "../monitor/transition";
import { isDue, mapSettledWithConcurrency } from "../monitor/schedule";
import { downAlert, recoveryAlert } from "../monitor/messages";

const CONCURRENCY = Math.max(1, Number(process.env.MONITOR_CONCURRENCY) || 25);

function log(message: string, data: Record<string, any> = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MONITOR] ${message}`, data);
}

/**
 * Check a single website: measure latency + status, persist a tick, and
 * open/close incidents + fire UP/DOWN notifications when the state changes.
 */
async function checkWebsite(website: any) {
  const result = await runHttpCheck(website);
  const { status, latency, statusCode, errorType, errorMessage } = result;
  if (status === "DOWN") {
    log("Website check failed", { url: website.url, statusCode, errorType, errorMessage });
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

let running = false;

/** Check every active monitor whose interval has elapsed. */
export async function runDueChecks(now = Date.now()) {
  // A slow run must not overlap the next minute's run and double-check sites.
  if (running) {
    log("Previous run still in progress; skipping this tick");
    return;
  }
  running = true;

  try {
    const websites = await Website.find({ disabled: false, paused: { $ne: true } }).lean();
    const due = websites.filter((w) => isDue(w, now));
    if (due.length === 0) return;

    log(`Checking ${due.length} of ${websites.length} website(s)`);
    // Settle individually so a failure checking or persisting one website
    // (e.g. a transient DB write error) doesn't abort the others.
    const results = await mapSettledWithConcurrency(due, CONCURRENCY, checkWebsite);
    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        log("Failed to check website", {
          url: due[i]?.url,
          websiteId: due[i]?._id,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  } catch (err) {
    log("Error running monitor", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    running = false;
  }
}

export const scheduleMonitor = () => {
  cron.schedule("* * * * *", () => runDueChecks());
};
