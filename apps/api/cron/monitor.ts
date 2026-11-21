import { Website } from "db/client";
import { runHttpCheck } from "../monitor/httpCheck";
import { recordCheckResult } from "../monitor/record";
import { evaluateHeartbeat, isHeartbeatDue } from "../monitor/heartbeat";
import { isDue, mapSettledWithConcurrency, SCHEDULE_GRACE_MS } from "../monitor/schedule";

const CONCURRENCY = Math.max(1, Number(process.env.MONITOR_CONCURRENCY) || 25);

function log(message: string, data: Record<string, any> = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [MONITOR] ${message}`, data);
}

/** Check a monitor (fetch its URL, or evaluate its heartbeat) and record the result. */
async function checkWebsite(website: any) {
  // Stamp the start, so a slow check doesn't push the next one past its slot.
  const startedAt = new Date();
  if (website.type === "heartbeat") {
    // A missed deadline is already conclusive, so alert on the first miss.
    const result = evaluateHeartbeat(website, startedAt.getTime());
    await recordCheckResult({ ...website, failureThreshold: 1 }, result, startedAt);
    return;
  }
  await recordCheckResult(website, await runHttpCheck(website), startedAt);
}

/** Intervals are at least a minute, so anything checked more recently can't be due. */
const MIN_INTERVAL_MS = 60_000;

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
    // Heartbeats are always loaded: their deadline, not lastCheckedAt, decides.
    const websites = await Website.find({
      disabled: false,
      paused: { $ne: true },
      $or: [
        { type: "heartbeat" },
        { lastCheckedAt: null },
        { lastCheckedAt: { $lte: new Date(now - MIN_INTERVAL_MS + SCHEDULE_GRACE_MS) } },
      ],
    }).lean();
    const due = websites.filter((w) => (w.type === "heartbeat" ? isHeartbeatDue(w, now) : isDue(w, now)));
    if (due.length === 0) return;

    log(`Checking ${due.length} of ${websites.length} candidate website(s)`);
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
