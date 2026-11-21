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

  test("never shows 100% when any check failed", () => {
    expect(overallUptime([{ day: "a", total: 130_000, up: 129_999 }])).toBe(99.99);
  });
});

describe("statuses", () => {
  test("monitor status", () => {
    expect(monitorPublicStatus({ paused: true, isDown: true })).toBe("paused");
    expect(monitorPublicStatus({ isDown: true })).toBe("down");
    expect(monitorPublicStatus({ lastCheckedAt: new Date() })).toBe("up");
    expect(monitorPublicStatus({})).toBe("unknown");
    expect(
      monitorPublicStatus({ isDown: true, maintenanceUntil: new Date(NOW + 60_000) }, NOW)
    ).toBe("maintenance");
    expect(monitorPublicStatus({ maintenanceUntil: new Date(NOW - 1), lastCheckedAt: new Date() }, NOW)).toBe("up");
  });

  test("page status", () => {
    expect(pageStatus(["up", "up", "paused"])).toBe("operational");
    expect(pageStatus(["up", "down"])).toBe("partial_outage");
    expect(pageStatus(["down", "paused"])).toBe("major_outage");
    expect(pageStatus(["paused"])).toBe("unknown");
    expect(pageStatus([])).toBe("unknown");
    expect(pageStatus(["up", "maintenance"])).toBe("maintenance");
    expect(pageStatus(["down", "maintenance"])).toBe("major_outage");
  });
});
