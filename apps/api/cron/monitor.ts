import cron from "node-cron";
import axios from "axios";
import { Website, WebsiteTick, Notification, Incident } from "db/client";

function log(message: string, data: Record<string, any> = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MONITOR] ${message}`, data);
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Check a single website: measure latency + status, persist a tick, and
 * open/close incidents + fire UP/DOWN notifications when the state changes.
 */
async function checkWebsite(website: any) {
  const startTime = Date.now();
  let status: "UP" | "DOWN" = "DOWN";
  let latency = REQUEST_TIMEOUT_MS;
  let statusCode: number | null = null;

  try {
    const response = await axios.get(website.url, {
      timeout: REQUEST_TIMEOUT_MS,
      // Treat any non-5xx response as "reachable"; only 5xx / network errors are DOWN.
      validateStatus: (code) => code < 500,
      headers: { "User-Agent": "UptimeWatch/1.0 (+https://uptimewatch.app)" },
    });
    latency = Date.now() - startTime;
    statusCode = response.status;
    status = response.status < 500 ? "UP" : "DOWN";
  } catch (error: any) {
    latency = Date.now() - startTime;
    status = "DOWN";
    statusCode = error?.response?.status ?? null;
    log("Website check failed", {
      url: website.url,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await WebsiteTick.create({
    websiteId: website._id,
    status,
    latency,
    statusCode,
  });

  const label = website.name || website.url;

  // State-change: went DOWN
  if (status === "DOWN" && !website.isDown) {
    log("Website is down (new incident)", { url: website.url, websiteId: website._id });
    await Website.updateOne({ _id: website._id }, { $set: { isDown: true } });
    await Incident.create({
      websiteId: website._id,
      userId: website.userId,
      startedAt: new Date(),
      ongoing: true,
      lastStatusCode: statusCode,
    });
    await Notification.create({
      userId: website.userId,
      message: `🚨 ${label} is DOWN${statusCode ? ` (HTTP ${statusCode})` : ""}.`,
    });
  }

  // State-change: recovered
  else if (status === "UP" && website.isDown) {
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
