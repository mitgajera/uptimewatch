import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import { mockDb } from "./helpers/mockDb";

function query<T>(result: T) {
  const q: any = { select: () => q, sort: () => q, limit: () => q, lean: async () => result };
  return q;
}

const Website = { find: mock((..._a: any[]) => query<any[]>([])) };
const WebsiteTick = { aggregate: mock(async (..._a: any[]) => [] as any[]) };
const Incident = {
  find: mock((..._a: any[]) => query<any[]>([])),
  countDocuments: mock(async (..._a: any[]) => 0),
};
mockDb({ Website, WebsiteTick, Incident });

const { getOverview, monitorBucket, buildLatencySeries } = await import("../controllers/overviewController");

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as Response & { statusCode: number; body: any };
}
const req = { userId: "user_1", params: {}, query: {} } as unknown as Request;
const DAY = 86_400_000;

beforeEach(() => {
  for (const m of [Website.find, WebsiteTick.aggregate, Incident.find, Incident.countDocuments]) m.mockReset();
  Website.find.mockReturnValue(query([]));
  WebsiteTick.aggregate.mockResolvedValue([]);
  Incident.find.mockReturnValue(query([]));
  Incident.countDocuments.mockResolvedValue(0);
});

describe("monitorBucket", () => {
  const now = Date.now();
  test("buckets are exclusive, in priority order", () => {
    const checked = new Date(now - 60_000);
    expect(monitorBucket({ paused: true, isDown: true }, now)).toBe("paused");
    expect(monitorBucket({ maintenanceUntil: new Date(now + 1000), isDown: true }, now)).toBe("maintenance");
    expect(monitorBucket({}, now)).toBe("pending");
    expect(monitorBucket({ lastCheckedAt: checked, isDown: true, isDegraded: true }, now)).toBe("down");
    expect(monitorBucket({ lastCheckedAt: checked, isDegraded: true }, now)).toBe("degraded");
    expect(monitorBucket({ lastCheckedAt: checked }, now)).toBe("up");
  });
});

describe("buildLatencySeries", () => {
  test("24 hourly points ending with the current hour; null without data", () => {
    const now = Date.UTC(2026, 0, 1, 12, 30);
    const hour = Date.UTC(2026, 0, 1, 12);
    const series = buildLatencySeries([{ _id: hour, avg: 123.6 }], now);
    expect(series).toHaveLength(24);
    expect(series[23]).toEqual({ t: hour, avg: 124 });
    expect(series[0]).toEqual({ t: hour - 23 * 3_600_000, avg: null });
  });
});

describe("getOverview", () => {
  test("is all-empty for a new user, without aggregating", async () => {
    const res = mockRes();
    await getOverview(req, res);
    expect(WebsiteTick.aggregate).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      counts: { total: 0, up: 0, down: 0, degraded: 0, paused: 0, maintenance: 0, pending: 0 },
      uptime24h: null,
      uptime7d: null,
      avgLatency24h: null,
      openIncidents: 0,
      recentIncidents: [],
      sslExpiring: [],
    });
    expect(res.body.latencySeries).toHaveLength(24);
  });

  test("returns the contract shape from one aggregation", async () => {
    const now = Date.now();
    const checked = new Date(now - 60_000);
    Website.find.mockReturnValue(
      query([
        { _id: "a", name: "API", url: "https://api.dev", type: "http", lastCheckedAt: checked, sslExpiresAt: new Date(now + 10 * DAY + 3600_000) },
        { _id: "b", name: "", url: "https://down.dev", type: "http", lastCheckedAt: checked, isDown: true, sslExpiresAt: new Date(now + 3 * DAY + 3600_000) },
        { _id: "c", name: "DB", url: "", type: "tcp", host: "db.dev", port: 5432, lastCheckedAt: checked, isDegraded: true },
        { _id: "d", name: "Cron", url: "", type: "heartbeat", paused: true },
        { _id: "e", name: "Far", url: "https://far.dev", type: "http", lastCheckedAt: checked, sslExpiresAt: new Date(now + 90 * DAY) },
      ])
    );
    const hour = Math.floor(now / 3_600_000) * 3_600_000;
    WebsiteTick.aggregate.mockResolvedValue([
      {
        week: [{ total: 100, up: 95 }],
        day: [{ total: 10, up: 9 }],
        dayLatency: [{ avg: 210.4 }],
        hourly: [{ _id: hour, avg: 200 }],
      },
    ]);
    Incident.countDocuments.mockResolvedValue(1);
    Incident.find.mockReturnValue(
      query([{ _id: "i1", websiteId: "b", startedAt: new Date(now - 60_000), ongoing: true, updates: [] }])
    );

    const res = mockRes();
    await getOverview(req, res);

    expect(WebsiteTick.aggregate).toHaveBeenCalledTimes(1);
    const pipeline = WebsiteTick.aggregate.mock.calls[0]![0] as any[];
    // Latency only covers http and tcp monitors.
    expect(pipeline[1].$facet.hourly[0].$match.websiteId).toEqual({ $in: ["a", "b", "c", "e"] });

    expect(res.body.counts).toEqual({ total: 5, up: 2, down: 1, degraded: 1, paused: 1, maintenance: 0, pending: 0 });
    expect(res.body.uptime24h).toBe(90);
    expect(res.body.uptime7d).toBe(95);
    expect(res.body.avgLatency24h).toBe(210);
    expect(res.body.openIncidents).toBe(1);
    expect(res.body.latencySeries[23]).toEqual({ t: hour, avg: 200 });
    expect(res.body.recentIncidents[0]).toMatchObject({ id: "i1", monitorName: "down.dev", ongoing: true });
    expect(res.body.sslExpiring.map((s: any) => [s.id, s.name, s.daysLeft])).toEqual([
      ["b", "down.dev", 3],
      ["a", "API", 10],
    ]);
    expect(res.body.sslExpiring[0]).toHaveProperty("url", "https://down.dev");
    expect(typeof res.body.sslExpiring[0].sslExpiresAt).toBe("string");
  });
});
