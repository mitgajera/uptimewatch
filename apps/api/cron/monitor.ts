import cron from "node-cron";
import { Website, WebsiteTick, Notification, Incident } from "db/client";
import { runHttpCheck } from "../monitor/httpCheck";
import { evaluateTransition } from "../monitor/transition";

function log(message: string, data: Record<string, any> = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MONITOR] ${message}`, data);
}

/**
 * Check a single website: measure latency + status, persist a tick, and
 * open/close incidents + fire UP/DOWN notifications when the state changes.
 */
async function checkWebsite(website: any) {
  const result = await runHttpCheck(website.url);
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

  const label = website.name || website.url;
  const event = evaluateTransition(website, result);

  if (event === "WENT_DOWN") {
    log("Website is down (new incident)", { url: website.url, websiteId: website._id });
    await Website.updateOne({ _id: website._id }, { $set: { isDown: true } });
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
      message: `🚨 ${label} is DOWN${statusCode ? ` (HTTP ${statusCode})` : ""}.`,
    });
  }

  else if (event === "RECOVERED") {
    log("Website recovered", { url: website.url, websiteId: website._id });
    await Website.updateOne({ _id: website._id }, { $set: { isDown: false } });

    const openIncident = await Incident.findOne({
      websiteId: website._id,
      ongoing: true,
    }).sort({ startedAt: -1 });

    if (openIncident) {
      const resolvedAt = new Date();
      openIncident.resolvedAt = resolvedAt;
      openIncident.ongoing = false;
      openIncident.durationMs = resolvedAt.getTime() - openIncident.startedAt.getTime();
      await openIncident.save();
    }

    await Notification.create({
      userId: website.userId,
      message: `🎉 ${label} is back ONLINE.`,
    });
  }

  log("Recorded tick", { url: website.url, status, latency: `${latency}ms` });
}

export const scheduleMonitor = () => {
  // Every minute, check every enabled website.
  cron.schedule("* * * * *", async () => {
    try {
      const websites = await Website.find({ disabled: false }).lean();
      if (websites.length === 0) return;

      log(`Checking ${websites.length} website(s)`);
      // Use allSettled so a failure checking or persisting one website (e.g. a
      // transient DB write error) doesn't abort the checks for every other site.
      const results = await Promise.allSettled(websites.map((w) => checkWebsite(w)));
      for (const [i, result] of results.entries()) {
        if (result.status === "rejected") {
          log("Failed to check website", {
            url: websites[i]?.url,
            websiteId: websites[i]?._id,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          });
        }
      }
    } catch (err) {
      log("Error running monitor", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
};
