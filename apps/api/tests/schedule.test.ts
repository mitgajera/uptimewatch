import { describe, expect, test } from "bun:test";
import { isDue, mapSettledWithConcurrency } from "../monitor/schedule";

const NOW = new Date("2024-01-01T12:00:00Z").getTime();
const ago = (s: number) => new Date(NOW - s * 1000);

describe("isDue", () => {
  test("never-checked monitors are due", () => {
    expect(isDue({ lastCheckedAt: null }, NOW)).toBe(true);
  });

  test("paused monitors are never due", () => {
    expect(isDue({ paused: true, lastCheckedAt: null }, NOW)).toBe(false);
  });

  test("monitors in a maintenance window are not due until it ends", () => {
    const until = new Date(NOW + 60_000);
    expect(isDue({ maintenanceUntil: until, lastCheckedAt: null }, NOW)).toBe(false);
    expect(isDue({ maintenanceUntil: new Date(NOW - 1), lastCheckedAt: null }, NOW)).toBe(true);
  });

  test("respects the interval with a little grace for cron drift", () => {
    expect(isDue({ intervalSeconds: 300, lastCheckedAt: ago(120) }, NOW)).toBe(false);
    expect(isDue({ intervalSeconds: 300, lastCheckedAt: ago(297) }, NOW)).toBe(true);
    expect(isDue({ intervalSeconds: 60, lastCheckedAt: ago(58) }, NOW)).toBe(true);
  });

  test("defaults to a 60s interval", () => {
    expect(isDue({ lastCheckedAt: ago(30) }, NOW)).toBe(false);
    expect(isDue({ lastCheckedAt: ago(60) }, NOW)).toBe(true);
  });
});

describe("mapSettledWithConcurrency", () => {
  test("bounds in-flight work and preserves order", async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapSettledWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      if (n === 3) throw new Error("boom");
      return n * 10;
    });

    expect(peak).toBe(2);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : "err"))).toEqual([
      10, 20, "err", 40, 50, 60,
    ]);
  });

  test("handles empty input", async () => {
    expect(await mapSettledWithConcurrency([], 5, async () => 1)).toEqual([]);
  });
});
