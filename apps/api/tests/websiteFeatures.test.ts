import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import { mockDb } from "./helpers/mockDb";

function query<T>(result: T) {
  const q: any = {
    select: () => q,
    sort: mock(() => q),
    limit: mock(() => q),
    lean: async () => result,
  };
  return q;
}

const Website = {
  find: mock((..._a: any[]) => query<any[]>([])),
  findOne: mock((..._a: any[]) => query<any>(null)),
  countDocuments: mock(async () => 0),
  create: mock(async (doc: any) => ({ _id: "new-id", ...doc })),
  findOneAndUpdate: mock((..._a: any[]) => query<any>(null)),
  updateMany: mock(async (..._a: any[]) => ({ matchedCount: 0 })),
};
const WebsiteTick = {
  find: mock((..._a: any[]) => query<any[]>([])),
  aggregate: mock(async (..._a: any[]) => [] as any[]),
};
const AlertChannel = { countDocuments: mock(async (..._a: any[]) => 0) };
mockDb({ Website, WebsiteTick, AlertChannel });

const ctrl = await import("../controllers/websiteController");
const {
  createWebsite,
  updateWebsite,
  bulkUpdateWebsites,
  checkWebsiteNow,
  getWebsiteChecks,
  getWebsiteCalendar,
  exportWebsiteChecks,
  manualCheckDeps,
  resetManualCheckLimits,
  buildSparkline,
} = ctrl;

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    set(k: string | Record<string, string>, v?: string) {
      if (typeof k === "string") res.headers[k] = v!;
      else Object.assign(res.headers, k);
      return res;
    },
    send(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as Response & { statusCode: number; body: any; headers: Record<string, string> };
}
const mockReq = (o: Partial<Request> = {}) =>
  ({ userId: "user_1", params: {}, query: {}, body: {}, ...o }) as unknown as Request;

const ID = "65a000000000000000000001";
const ID2 = "65a000000000000000000002";
const CH = "65a0000000000000000000c1";

const realDeps = { ...manualCheckDeps };

beforeEach(() => {
  for (const m of [
    ...Object.values(Website),
    ...Object.values(WebsiteTick),
    AlertChannel.countDocuments,
  ]) {
    (m as any).mockReset();
  }
  Website.find.mockReturnValue(query([]));
  Website.findOne.mockReturnValue(query(null));
  Website.countDocuments.mockResolvedValue(0);
  Website.create.mockImplementation(async (doc: any) => ({ _id: "new-id", ...doc }));
  Website.findOneAndUpdate.mockReturnValue(query(null));
  Website.updateMany.mockResolvedValue({ matchedCount: 0 });
  WebsiteTick.find.mockReturnValue(query([]));
  WebsiteTick.aggregate.mockResolvedValue([]);
  AlertChannel.countDocuments.mockResolvedValue(0);
  Object.assign(manualCheckDeps, realDeps);
  resetManualCheckLimits();
});

describe("createWebsite (tcp/dns)", () => {
  test("creates a tcp monitor without a URL", async () => {
    const res = mockRes();
    await createWebsite(mockReq({ body: { type: "tcp", name: "DB", host: "1.1.1.1", port: 5432 } }), res);
    expect(res.statusCode).toBe(201);
    expect(Website.create.mock.calls[0]![0]).toMatchObject({ type: "tcp", host: "1.1.1.1", port: 5432, url: "" });
  });

  test("rejects tcp monitors pointed at private addresses", async () => {
    const res = mockRes();
    await createWebsite(mockReq({ body: { type: "tcp", host: "127.0.0.1", port: 22 } }), res);
    expect(res.statusCode).toBe(400);
    expect(Website.create).not.toHaveBeenCalled();
  });

  test("creates a dns monitor (no SSRF lookup needed) with port cleared", async () => {
    const res = mockRes();
    await createWebsite(
      mockReq({ body: { type: "dns", host: "example.internal", dnsRecordType: "MX", dnsExpected: "mail" } }),
      res
    );
    expect(res.statusCode).toBe(201);
    expect(Website.create.mock.calls[0]![0]).toMatchObject({ type: "dns", dnsRecordType: "MX", port: null, url: "" });
  });

  test("alert channel ids must belong to the user", async () => {
    AlertChannel.countDocuments.mockResolvedValue(0);
    const res = mockRes();
    await createWebsite(mockReq({ body: { url: "https://1.1.1.1", alertChannelIds: [CH] } }), res);
    expect(res.statusCode).toBe(400);
    expect(AlertChannel.countDocuments.mock.calls[0]![0]).toEqual({ _id: { $in: [CH] }, userId: "user_1" });

    AlertChannel.countDocuments.mockResolvedValue(1);
    const ok = mockRes();
    await createWebsite(mockReq({ body: { url: "https://1.1.1.1", alertChannelIds: [CH], tags: ["Prod"] } }), ok);
    expect(ok.statusCode).toBe(201);
    expect(Website.create.mock.calls[0]![0]).toMatchObject({ alertChannelIds: [CH], tags: ["prod"] });
  });
});

describe("updateWebsite (new fields)", () => {
  test("clears the degraded flag when the threshold is turned off", async () => {
    Website.findOneAndUpdate.mockReturnValue(query({ _id: ID, url: "https://1.1.1.1" }));
    await updateWebsite(mockReq({ params: { websiteId: ID } as any, body: { degradedThresholdMs: null } }), mockRes());
    expect(Website.findOneAndUpdate.mock.calls[0]![1].$set).toEqual({ degradedThresholdMs: null, isDegraded: false });
  });

  test("a changed tcp host is SSRF-checked and resets state", async () => {
    Website.findOne.mockReturnValue(query({ _id: ID, type: "tcp", host: "1.1.1.1", port: 22 }));
    const bad = mockRes();
    await updateWebsite(mockReq({ params: { websiteId: ID } as any, body: { host: "10.0.0.1" } }), bad);
    expect(bad.statusCode).toBe(400);

    Website.findOneAndUpdate.mockReturnValue(query({ _id: ID, type: "tcp" }));
    await updateWebsite(mockReq({ params: { websiteId: ID } as any, body: { host: "8.8.8.8" } }), mockRes());
    expect(Website.findOneAndUpdate.mock.calls[0]![1].$set).toMatchObject({ host: "8.8.8.8", consecutiveFailures: 0 });
  });

  test("serializes new fields with defaults", async () => {
    Website.findOneAndUpdate.mockReturnValue(query({ _id: ID, url: "https://1.1.1.1", alertChannelIds: [CH] }));
    const res = mockRes();
    await updateWebsite(mockReq({ params: { websiteId: ID } as any, body: { paused: false } }), res);
    expect(res.body).toMatchObject({
      keywordMode: "contains",
      headers: [],
      body: "",
      degradedThresholdMs: null,
      tags: [],
      alertChannelIds: [CH],
      reminderMinutes: 0,
      isDegraded: false,
      lastErrorMessage: null,
      port: null,
    });
  });
});

describe("bulkUpdateWebsites", () => {
  const run = async (body: object) => {
    const res = mockRes();
    await bulkUpdateWebsites(mockReq({ body }), res);
    return res;
  };

  test("pause/resume/delete only touch the user's active monitors", async () => {
    Website.updateMany.mockResolvedValue({ matchedCount: 2 });
    const res = await run({ ids: [ID, ID2, ID], action: "pause" });
    expect(res.body).toEqual({ updated: 2 });
    expect(Website.updateMany.mock.calls[0]).toEqual([
      { _id: { $in: [ID, ID2] }, userId: "user_1", disabled: false },
      { $set: { paused: true } },
    ]);

    await run({ ids: [ID], action: "resume" });
    expect(Website.updateMany.mock.calls[1]![1]).toEqual({ $set: { paused: false } });
    await run({ ids: [ID], action: "delete" });
    expect(Website.updateMany.mock.calls[2]![1]).toEqual({ $set: { disabled: true } });
  });

  test("tags are normalized and capped at 10 per monitor", async () => {
    await run({ ids: [ID], action: "addTag", tag: " Prod " });
    const [filter, update] = Website.updateMany.mock.calls[0]!;
    expect(filter["tags.9"]).toEqual({ $exists: false });
    expect(update).toEqual({ $addToSet: { tags: "prod" } });

    await run({ ids: [ID], action: "removeTag", tag: "prod" });
    expect(Website.updateMany.mock.calls[1]![1]).toEqual({ $pull: { tags: "prod" } });
  });

  test("rejects bad input", async () => {
    expect((await run({ ids: [], action: "pause" })).statusCode).toBe(400);
    expect((await run({ ids: ["x"], action: "pause" })).statusCode).toBe(400);
    expect((await run({ ids: [ID], action: "addTag" })).statusCode).toBe(400);
    expect(Website.updateMany).not.toHaveBeenCalled();
  });
});

describe("checkWebsiteNow", () => {
  const result = { status: "UP", latency: 42, statusCode: 200, errorType: null, errorMessage: null } as const;

  test("runs and records a check, then rate-limits for 10s", async () => {
    Website.findOne.mockReturnValue(query({ _id: ID, url: "https://1.1.1.1", type: "http" }));
    let now = 1_000_000;
    manualCheckDeps.now = () => now;
    manualCheckDeps.run = mock(async () => result) as any;
    manualCheckDeps.record = mock(async () => {}) as any;

    const res = mockRes();
    await checkWebsiteNow(mockReq({ params: { websiteId: ID } as any }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ...result, checkedAt: new Date(now).toISOString() });
    expect(manualCheckDeps.record).toHaveBeenCalledTimes(1);

    now += 5_000;
    const limited = mockRes();
    await checkWebsiteNow(mockReq({ params: { websiteId: ID } as any }), limited);
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["Retry-After"]).toBe("5");

    now += 5_000;
    const again = mockRes();
    await checkWebsiteNow(mockReq({ params: { websiteId: ID } as any }), again);
    expect(again.statusCode).toBe(200);
  });

  test("heartbeats can't be checked on demand", async () => {
    Website.findOne.mockReturnValue(query({ _id: ID, type: "heartbeat" }));
    manualCheckDeps.run = mock(async () => result) as any;
    const res = mockRes();
    await checkWebsiteNow(mockReq({ params: { websiteId: ID } as any }), res);
    expect(res.statusCode).toBe(400);
    expect(manualCheckDeps.run).not.toHaveBeenCalled();
  });

  test("404s for other users' monitors", async () => {
    const res = mockRes();
    await checkWebsiteNow(mockReq({ params: { websiteId: ID } as any }), res);
    expect(res.statusCode).toBe(404);
  });
});

describe("getWebsiteChecks", () => {
  const tick = (i: number, status = "UP") => ({
    _id: `t${i}`,
    websiteId: ID,
    status,
    latency: 10,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 60 - i)),
  });

  test("pages newest first with a nextBefore cursor", async () => {
    Website.findOne.mockReturnValue(query({ _id: ID }));
    const q = query([tick(1), tick(2)]);
    WebsiteTick.find.mockReturnValue(q);
    const res = mockRes();
    await getWebsiteChecks(
      mockReq({
        params: { websiteId: ID } as any,
        query: { limit: "2", before: "2026-01-02T00:00:00.000Z", status: "DOWN" } as any,
      }),
      res
    );
    expect(WebsiteTick.find.mock.calls[0]![0]).toEqual({
      websiteId: ID,
      createdAt: { $lt: new Date("2026-01-02T00:00:00.000Z") },
      status: "DOWN",
    });
    expect(q.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(q.limit).toHaveBeenCalledWith(2);
    expect(res.body.checks.map((c: any) => c.id)).toEqual(["t1", "t2"]);
    expect(res.body.checks[0]).toMatchObject({ statusCode: null, errorType: null });
    expect(res.body.nextBefore).toBe(tick(2).createdAt.toISOString());
  });

  test("a short page has no cursor; limit is capped at 200", async () => {
    Website.findOne.mockReturnValue(query({ _id: ID }));
    const q = query([tick(1)]);
    WebsiteTick.find.mockReturnValue(q);
    const res = mockRes();
    await getWebsiteChecks(mockReq({ params: { websiteId: ID } as any, query: { limit: "5000" } as any }), res);
    expect(q.limit).toHaveBeenCalledWith(200);
    expect(res.body.nextBefore).toBeNull();
  });

  test("validates status and before", async () => {
    Website.findOne.mockReturnValue(query({ _id: ID }));
    const bad = mockRes();
    await getWebsiteChecks(mockReq({ params: { websiteId: ID } as any, query: { status: "MAYBE" } as any }), bad);
    expect(bad.statusCode).toBe(400);
    const badDate = mockRes();
    await getWebsiteChecks(mockReq({ params: { websiteId: ID } as any, query: { before: "soon" } as any }), badDate);
    expect(badDate.statusCode).toBe(400);
  });
});

describe("getWebsiteCalendar", () => {
  test("returns 90 days oldest first with uptime, checks and down checks", async () => {
    Website.findOne.mockReturnValue(query({ _id: ID }));
    const today = new Date().toISOString().slice(0, 10);
    WebsiteTick.aggregate.mockResolvedValue([{ _id: today, total: 4, down: 1 }]);
    const res = mockRes();
    await getWebsiteCalendar(mockReq({ params: { websiteId: ID } as any }), res);
    const days = res.body.days;
    expect(days).toHaveLength(90);
    expect(days[89]).toEqual({ date: today, uptime: 75, checks: 4, downChecks: 1 });
    expect(days[0]).toMatchObject({ uptime: null, checks: 0, downChecks: 0 });
    expect(days[0].date < days[89].date).toBe(true);
  });
});

describe("exportWebsiteChecks", () => {
  test("sends escaped CSV as an attachment", async () => {
    Website.findOne.mockReturnValue(query({ _id: ID, name: "My API", url: "https://1.1.1.1" }));
    WebsiteTick.find.mockReturnValue(
      query([
        {
          status: "DOWN",
          latency: 120,
          statusCode: 500,
          errorType: "HTTP_STATUS",
          errorMessage: 'Bad "gateway", retry\nlater',
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ])
    );
    const res = mockRes();
    await exportWebsiteChecks(mockReq({ params: { websiteId: ID } as any, query: { range: "7d" } as any }), res);
    expect(res.headers["Content-Type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers["Content-Disposition"]).toBe('attachment; filename="my-api-checks-7d.csv"');
    expect(res.body).toBe(
      "time,status,status_code,latency_ms,error_type,error_message\r\n" +
        '2026-01-01T00:00:00.000Z,DOWN,500,120,HTTP_STATUS,"Bad ""gateway"", retry\nlater"\r\n'
    );
  });
});

describe("buildSparkline", () => {
  test("24 hourly averages, oldest first, 0 for empty hours", () => {
    const now = Date.UTC(2026, 0, 1, 12, 30);
    const hour = Date.UTC(2026, 0, 1, 12);
    const points = buildSparkline(
      [
        { h: hour, total: 2, latencySum: 300 },
        { h: hour - 23 * 3_600_000, total: 1, latencySum: 50 },
        // Older than the window: ignored.
        { h: hour - 24 * 3_600_000, total: 1, latencySum: 999 },
      ],
      now
    );
    expect(points).toHaveLength(24);
    expect(points[0]).toBe(50);
    expect(points[23]).toBe(150);
    expect(points.slice(1, 23).every((p) => p === 0)).toBe(true);
  });
});
