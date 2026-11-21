import { MONITOR_DEFAULTS } from "db/constants";

/** Cron fires roughly every minute; allow this much early drift. */
const SCHEDULE_GRACE_MS = 5_000;

export interface SchedulableMonitor {
  paused?: boolean;
  maintenanceUntil?: Date | string | null;
  intervalSeconds?: number;
  lastCheckedAt?: Date | string | null;
}

export function inMaintenance(
  monitor: { maintenanceUntil?: Date | string | null },
  now: number
): boolean {
  return Boolean(monitor.maintenanceUntil) && new Date(monitor.maintenanceUntil!).getTime() > now;
}

/** Whether a monitor should be checked at `now` given its interval. */
export function isDue(monitor: SchedulableMonitor, now: number): boolean {
  if (monitor.paused || inMaintenance(monitor, now)) return false;
  if (!monitor.lastCheckedAt) return true;
  const intervalMs = (monitor.intervalSeconds ?? MONITOR_DEFAULTS.intervalSeconds) * 1000;
  return now - new Date(monitor.lastCheckedAt).getTime() >= intervalMs - SCHEDULE_GRACE_MS;
}

/**
 * Run `fn` over `items` with at most `limit` in flight, collecting settled
 * results in input order (like Promise.allSettled).
 */
export async function mapSettledWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await fn(items[index]!) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return results;
}
