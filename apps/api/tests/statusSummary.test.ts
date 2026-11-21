import { describe, expect, test } from "bun:test";
import {
  buildDailyBars,
  monitorPublicStatus,
  overallUptime,
  pageStatus,
} from "../statusPages/summary";

const NOW = Date.UTC(2024, 0, 10, 15);

describe("buildDailyBars", () => {
  test("produces one bar per day, oldest first, with gaps as null", () => {
    const bars = buildDailyBars(
      [
        { day: "2024-01-10", total: 4, up: 3 },
        { day: "2024-01-08", total: 10, up: 10 },
      ],
      NOW,
      3
    );
    expect(bars).toEqual([
      { date: "2024-01-08", uptime: 100 },
      { date: "2024-01-09", uptime: null },
      { date: "2024-01-10", uptime: 75 },
    ]);
  });
});

describe("overallUptime", () => {
  test("weights days by check count", () => {
    expect(
      overallUptime([
        { day: "a", total: 1, up: 0 },
        { day: "b", total: 99, up: 99 },
      ])
    ).toBe(99);
    expect(overallUptime([])).toBeNull();
  });
});

describe("statuses", () => {
  test("monitor status", () => {
    expect(monitorPublicStatus({ paused: true, isDown: true })).toBe("paused");
    expect(monitorPublicStatus({ isDown: true })).toBe("down");
    expect(monitorPublicStatus({ lastCheckedAt: new Date() })).toBe("up");
    expect(monitorPublicStatus({})).toBe("unknown");
  });

  test("page status", () => {
    expect(pageStatus(["up", "up", "paused"])).toBe("operational");
    expect(pageStatus(["up", "down"])).toBe("partial_outage");
    expect(pageStatus(["down", "paused"])).toBe("major_outage");
    expect(pageStatus(["paused"])).toBe("unknown");
    expect(pageStatus([])).toBe("unknown");
  });
});
