import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mockDb } from "./helpers/mockDb";

const WebsiteTick = { create: mock(async (..._a: any[]) => ({})) };
const Website = { updateOne: mock(async (..._a: any[]) => ({ matchedCount: 1 })) };
const Incident = {
  updateOne: mock(async (..._a: any[]) => ({})),
  findOne: mock((..._a: any[]) => ({ sort: async () => null as any })),
};
const Notification = { create: mock(async (..._a: any[]) => ({})) };
mockDb({ Website, WebsiteTick, Incident, Notification });

const { recordCheckResult, reminderDue } = await import("../monitor/record");

const UP = { status: "UP", latency: 120, statusCode: 200, errorType: null, errorMessage: null } as const;
const DOWN = { status: "DOWN", latency: 0, statusCode: 503, errorType: "HTTP_STATUS", errorMessage: "503" } as const;
const site = (over: Record<string, unknown> = {}) => ({
  _id: "w1",
  userId: "u1",
  url: "https://example.com",
  name: "Example",
  failureThreshold: 1,
  consecutiveFailures: 0,
  isDown: false,
  ...over,
});

beforeEach(() => {
  for (const m of [WebsiteTick.create, Website.updateOne, Incident.updateOne, Incident.findOne, Notification.create]) {
    m.mockClear();
  }
  Website.updateOne.mockImplementation(async () => ({ matchedCount: 1 }));
  Notification.create.mockImplementation(async () => ({}));
  Incident.findOne.mockImplementation(() => ({ sort: async () => null }));
});

describe("recordCheckResult", () => {
  test("writes a tick and state stamped with the check start time", async () => {
    const startedAt = new Date("2026-01-01T00:00:00Z");
    await recordCheckResult(site(), UP, startedAt);

    expect(WebsiteTick.create).toHaveBeenCalledTimes(1);
    const [filter, update] = Website.updateOne.mock.calls[0]!;
    expect(filter).toEqual({ _id: "w1", isDown: { $ne: true } });
    expect(update.$set).toMatchObject({ isDown: false, consecutiveFailures: 0, lastCheckedAt: startedAt });
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test("WENT_DOWN opens one incident idempotently and queues a DOWN alert", async () => {
    await recordCheckResult(site(), DOWN);

    expect(Website.updateOne.mock.calls[0]![1].$set.isDown).toBe(true);
    const [filter, update, opts] = Incident.updateOne.mock.calls[0]!;
    expect(filter).toEqual({ websiteId: "w1", ongoing: true });
    expect(update.$setOnInsert).toMatchObject({ userId: "u1", ongoing: true, errorType: "HTTP_STATUS" });
    expect(opts).toEqual({ upsert: true });
    expect(Notification.create.mock.calls[0]![0]).toMatchObject({ websiteId: "w1", kind: "DOWN" });
  });

  test("RECOVERED closes the open incident and queues an UP alert", async () => {
    const incident = { startedAt: new Date(Date.now() - 60_000), ongoing: true, save: mock(async () => {}) } as any;
    Incident.findOne.mockImplementation(() => ({ sort: async () => incident }));

    await recordCheckResult(site({ isDown: true }), UP);

    expect(Website.updateOne.mock.calls[0]![0]).toEqual({ _id: "w1", isDown: true });
    expect(incident.ongoing).toBe(false);
    expect(incident.durationMs).toBeGreaterThanOrEqual(60_000);
    expect(incident.save).toHaveBeenCalled();
    expect(Notification.create.mock.calls[0]![0]).toMatchObject({ kind: "UP" });
  });

  test("skips the transition when another recording changed the state first", async () => {
    Website.updateOne.mockImplementation(async () => ({ matchedCount: 0 }));

    await recordCheckResult(site(), DOWN);

    expect(Incident.updateOne).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test("rolls the state back when the alert can't be queued, so the next check retries", async () => {
    Notification.create.mockImplementation(async () => {
      throw new Error("db down");
    });

    await expect(recordCheckResult(site(), DOWN)).rejects.toThrow("db down");

    expect(Website.updateOne).toHaveBeenCalledTimes(2);
    const [filter, update] = Website.updateOne.mock.calls[1]!;
    expect(filter).toEqual({ _id: "w1", isDown: true });
    expect(update).toEqual({ $set: { isDown: false } });
  });

  test("a sub-threshold failure changes no state", async () => {
    await recordCheckResult(site({ failureThreshold: 3 }), DOWN);

    expect(Website.updateOne.mock.calls[0]![1].$set).toMatchObject({ isDown: false, consecutiveFailures: 1 });
    expect(Incident.updateOne).not.toHaveBeenCalled();
  });
});

describe("recordCheckResult: degraded, errors and recovery notes", () => {
  test("stores the error message with the state", async () => {
    await recordCheckResult(site({ failureThreshold: 3 }), DOWN);
    expect(Website.updateOne.mock.calls[0]![1].$set).toMatchObject({ lastErrorType: "HTTP_STATUS", lastErrorMessage: "503" });
  });

  test("an UP check slower than the threshold marks the monitor degraded", async () => {
    await recordCheckResult(site({ degradedThresholdMs: 100 }), UP); // 120ms
    expect(Website.updateOne.mock.calls[0]![1].$set.isDegraded).toBe(true);

    await recordCheckResult(site({ degradedThresholdMs: 500 }), UP);
    expect(Website.updateOne.mock.calls[1]![1].$set.isDegraded).toBe(false);

    // Off by default, and never for failed checks or dns monitors.
    await recordCheckResult(site(), UP);
    expect(Website.updateOne.mock.calls[2]![1].$set.isDegraded).toBe(false);
    await recordCheckResult(site({ degradedThresholdMs: 100, failureThreshold: 3 }), { ...DOWN, latency: 5000 });
    expect(Website.updateOne.mock.calls[3]![1].$set.isDegraded).toBe(false);
    await recordCheckResult(site({ type: "dns", degradedThresholdMs: 100 }), UP);
    expect(Website.updateOne.mock.calls[4]![1].$set.isDegraded).toBe(false);
  });

  test("recovery appends an automatic, private resolved update", async () => {
    const incident = { startedAt: new Date(Date.now() - 120_000), ongoing: true, updates: [] as any[], save: mock(async () => {}) } as any;
    Incident.findOne.mockImplementation(() => ({ sort: async () => incident }));
    await recordCheckResult(site({ isDown: true }), UP);
    expect(incident.updates).toHaveLength(1);
    expect(incident.updates[0]).toMatchObject({ status: "resolved", public: false });
    expect(incident.updates[0].at).toBeInstanceOf(Date);
  });

  test("a new incident resets the reminder schedule", async () => {
    await recordCheckResult(site(), DOWN);
    expect(Website.updateOne.mock.calls[0]![1].$set.lastReminderAt).toBeNull();
  });
});

describe("reminders", () => {
  const MIN = 60_000;

  test("reminderDue counts from the incident start, then from the last reminder", () => {
    const start = new Date(0);
    expect(reminderDue({ reminderMinutes: 0 }, start, 999 * MIN)).toBe(false);
    expect(reminderDue({ reminderMinutes: 15 }, start, 14 * MIN)).toBe(false);
    expect(reminderDue({ reminderMinutes: 15 }, start, 15 * MIN)).toBe(true);
    expect(reminderDue({ reminderMinutes: 15, lastReminderAt: new Date(15 * MIN) }, start, 20 * MIN)).toBe(false);
    expect(reminderDue({ reminderMinutes: 15, lastReminderAt: new Date(15 * MIN) }, start, 30 * MIN)).toBe(true);
    // A reminder from an earlier incident doesn't delay this one.
    expect(reminderDue({ reminderMinutes: 15, lastReminderAt: new Date(-5 * MIN) }, start, 15 * MIN)).toBe(true);
  });

  test("queues a REMINDER while a monitor stays down, claimed with compare-and-set", async () => {
    const startedAt = new Date(Date.now() - 20 * MIN);
    Incident.findOne.mockImplementation(() => ({ sort: async () => ({ startedAt }) }));
    const checkedAt = new Date();

    await recordCheckResult(site({ isDown: true, reminderMinutes: 15, lastReminderAt: null }), DOWN, checkedAt);

    const [claimFilter, claimUpdate] = Website.updateOne.mock.calls[1]!;
    expect(claimFilter).toEqual({ _id: "w1", isDown: true, lastReminderAt: null });
    expect(claimUpdate).toEqual({ $set: { lastReminderAt: checkedAt } });
    const notif = Notification.create.mock.calls[0]![0];
    expect(notif).toMatchObject({ kind: "REMINDER", websiteId: "w1", userId: "u1" });
    expect(notif.subject).toContain("still DOWN");
  });

  test("no reminder before it is due, when off, or when another run claimed it", async () => {
    Incident.findOne.mockImplementation(() => ({ sort: async () => ({ startedAt: new Date(Date.now() - 5 * MIN) }) }));
    await recordCheckResult(site({ isDown: true, reminderMinutes: 15 }), DOWN);
    expect(Notification.create).not.toHaveBeenCalled();

    Incident.findOne.mockImplementation(() => ({ sort: async () => ({ startedAt: new Date(Date.now() - 60 * MIN) }) }));
    await recordCheckResult(site({ isDown: true, reminderMinutes: 0 }), DOWN);
    expect(Notification.create).not.toHaveBeenCalled();

    Website.updateOne.mockImplementation(async (filter: any) => ({ matchedCount: "lastReminderAt" in filter ? 0 : 1 }));
    await recordCheckResult(site({ isDown: true, reminderMinutes: 15 }), DOWN);
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test("no reminder on recovery", async () => {
    Incident.findOne.mockImplementation(() => ({
      sort: async () => ({ startedAt: new Date(Date.now() - 60 * MIN), updates: [], save: async () => {} }),
    }));
    await recordCheckResult(site({ isDown: true, reminderMinutes: 15 }), UP);
    expect(Notification.create.mock.calls.map((c: any) => c[0].kind)).toEqual(["UP"]);
  });
});
