import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mockDb } from "./helpers/mockDb";

let found: any[] = [];
const Website = {
  find: mock((..._a: any[]) => ({ lean: async () => found })),
  updateOne: mock(async (..._a: any[]) => ({ matchedCount: 1 })),
};
const Notification = { create: mock(async (..._a: any[]) => ({})) };
mockDb({ Website, Notification });

const { runSslChecks } = await import("../cron/sslCheck");

const NOW = Date.parse("2026-06-01T00:00:00Z");
const DAY = 86_400_000;
const deps = (validTo: Date) => ({
  assertSafeUrl: mock(async () => {}),
  fetchCertificate: mock(async () => ({ validTo, issuer: "CA" })),
});
const site = { _id: "w1", userId: "u1", url: "https://example.com", name: "Example" };

beforeEach(() => {
  found = [site];
  Website.find.mockClear();
  Website.updateOne.mockClear();
  Website.updateOne.mockImplementation(async () => ({ matchedCount: 1 }));
  Notification.create.mockClear();
  Notification.create.mockImplementation(async () => ({}));
});

describe("runSslChecks", () => {
  test("skips monitors in a maintenance window", async () => {
    await runSslChecks(NOW, deps(new Date(NOW + 5 * DAY)));
    const query = Website.find.mock.calls[0]![0];
    expect(query.$and).toContainEqual({
      $or: [{ maintenanceUntil: null }, { maintenanceUntil: { $lte: new Date(NOW) } }],
    });
  });

  test("records the certificate only if the monitor still has the checked URL", async () => {
    await runSslChecks(NOW, deps(new Date(NOW + 5 * DAY)));
    const [filter, update] = Website.updateOne.mock.calls[0]!;
    expect(filter).toEqual({ _id: "w1", url: "https://example.com" });
    expect(update.$set.sslAlertedThreshold).toBe(7);
    expect(Notification.create.mock.calls[0]![0]).toMatchObject({ kind: "SSL_EXPIRY" });
  });

  test("sends nothing when the URL changed mid-check", async () => {
    Website.updateOne.mockImplementation(async () => ({ matchedCount: 0 }));
    await runSslChecks(NOW, deps(new Date(NOW + 5 * DAY)));
    expect(Notification.create).not.toHaveBeenCalled();
  });

  test("un-marks the threshold when the alert can't be queued", async () => {
    Notification.create.mockImplementation(async () => {
      throw new Error("db down");
    });
    found = [{ ...site, sslAlertedThreshold: 14 }];
    await runSslChecks(NOW, deps(new Date(NOW + 5 * DAY)));
    expect(Website.updateOne.mock.calls[1]).toEqual([
      { _id: "w1" },
      { $set: { sslAlertedThreshold: 14, sslCheckedAt: null } },
    ]);
  });
});
