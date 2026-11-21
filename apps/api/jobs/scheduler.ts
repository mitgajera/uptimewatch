import cron from "node-cron";
import { Lease } from "db/client";
import { acquireLease } from "./lease";
import { runDueChecks } from "../cron/monitor";
import { dispatchPendingNotifications } from "../cron/websiteAlert";
import { runSslChecks } from "../cron/sslCheck";

interface Job {
  name: string;
  schedule: string;
  /** How long a run may hold the job before another instance can take over. */
  leaseMs: number;
  run: () => Promise<void>;
}

const JOBS: Job[] = [
  { name: "monitor", schedule: "* * * * *", leaseMs: 55_000, run: () => runDueChecks() },
  { name: "alerts", schedule: "* * * * *", leaseMs: 55_000, run: () => dispatchPendingNotifications() },
  // Every 15 minutes pick up monitors whose certificate data is stale.
  { name: "ssl", schedule: "*/15 * * * *", leaseMs: 14 * 60_000, run: () => runSslChecks() },
];

/**
 * Start all background jobs. Safe to call from several processes: each run
 * first takes a per-job lease in Mongo, so only one instance executes it.
 */
export function startScheduledJobs() {
  for (const job of JOBS) {
    const lease = `job:${job.name}`;
    let running = false;
    cron.schedule(job.schedule, async () => {
      // This process still owns the lease during a long run, so guard locally too.
      if (running) return;
      let renew: ReturnType<typeof setInterval> | undefined;
      try {
        if (!(await acquireLease(Lease, lease, job.leaseMs))) return;
        running = true;
        // Keep the lease while the run lasts, so a slow run can't be taken
        // over and executed a second time by another instance.
        renew = setInterval(() => {
          acquireLease(Lease, lease, job.leaseMs).catch((err) =>
            console.error(`[JOBS] ${job.name} lease renewal failed:`, err instanceof Error ? err.message : err)
          );
        }, job.leaseMs / 3);
        await job.run();
      } catch (err) {
        console.error(`[JOBS] ${job.name} failed:`, err instanceof Error ? err.message : err);
      } finally {
        clearInterval(renew);
        running = false;
      }
    });
  }
  console.log(`[JOBS] Scheduled: ${JOBS.map((j) => j.name).join(", ")}`);
}
