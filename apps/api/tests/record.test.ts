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

const { recordCheckResult } = await import("../monitor/record");

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
