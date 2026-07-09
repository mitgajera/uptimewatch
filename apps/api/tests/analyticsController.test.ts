import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";

// A minimal chainable Mongoose query stub: select/sort/limit return `this`, and
// `lean()` resolves to the preconfigured result. Controllers only ever await
// the terminal `.lean()`, so this faithfully models the query builder.
function query<T>(result: T) {
  const q: any = {
    select: () => q,
    sort: () => q,
    limit: () => q,
    lean: async () => result,
  };
  return q;
}

const Website = {
  find: mock(() => query<any[]>([])),
  findOne: mock(() => query<any>(null)),
};
const WebsiteTick = {
  find: mock(() => query<any[]>([])),
};
const Incident = {
  find: mock(() => query<any[]>([])),
  countDocuments: mock(async () => 0),
};

mock.module("db/client", () => ({ Website, WebsiteTick, Incident }));

const { getDashboardStats, getWebsiteAnalytics, getWebsiteIncidents } =
  await import("../controllers/analyticsController");

// Fake Express req/res capturing status + json.
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

function mockReq(overrides: Partial<Request> = {}) {
  return {
    userId: "user_1",
    params: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => {
  for (const m of [
    Website.find,
    Website.findOne,
    WebsiteTick.find,
    Incident.find,
    Incident.countDocuments,
  ]) {
    m.mockReset();
  }
  Website.find.mockReturnValue(query<any[]>([]));
  Website.findOne.mockReturnValue(query<any>(null));
  WebsiteTick.find.mockReturnValue(query<any[]>([]));
  Incident.find.mockReturnValue(query<any[]>([]));
  Incident.countDocuments.mockResolvedValue(0);
});

describe("getDashboardStats", () => {
  test("returns 100% uptime defaults when the user has no monitors", async () => {
    const res = mockRes();
    await getDashboardStats(mockReq(), res);

    expect(res.body).toEqual({
      totalMonitors: 0,
      up: 0,
      down: 0,
      avgUptime: 100,
      avgResponseTime: 0,
      activeIncidents: 0,
      checksLast24h: 0,
    });
    // With no websites, ticks/incident queries are skipped entirely.
    expect(WebsiteTick.find).not.toHaveBeenCalled();
    expect(Incident.countDocuments).not.toHaveBeenCalled();
  });

  test("aggregates up/down counts, uptime %, and avg latency", async () => {
    Website.find.mockReturnValue(
      query([
        { _id: "w1", isDown: false },
        { _id: "w2", isDown: true },
        { _id: "w3", isDown: false },
      ])
    );
    WebsiteTick.find.mockReturnValue(
      query([
        { status: "UP", latency: 100 },
        { status: "UP", latency: 200 },
        { status: "DOWN", latency: 300 },
        { status: "UP", latency: 400 },
      ])
    );
    Incident.countDocuments.mockResolvedValue(1);

    const res = mockRes();
    await getDashboardStats(mockReq(), res);

    expect(res.body).toMatchObject({
      totalMonitors: 3,
      up: 2,
      down: 1,
      avgUptime: 75, // 3 of 4 ticks UP
      avgResponseTime: 250, // mean of 100/200/300/400
      activeIncidents: 1,
      checksLast24h: 4,
    });
  });
});

describe("getWebsiteAnalytics", () => {
  test("404s when the website is not found / not owned by the user", async () => {
    Website.findOne.mockReturnValue(query(null));
    const res = mockRes();
    await getWebsiteAnalytics(
      mockReq({ params: { websiteId: "missing" } as any }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "Website not found." });
    expect(WebsiteTick.find).not.toHaveBeenCalled();
  });

  test("computes uptime, latency percentiles, and a bucketed series", async () => {
    Website.findOne.mockReturnValue(query({ _id: "w1" }));
    const base = new Date("2024-01-01T00:00:00.000Z").getTime();
    WebsiteTick.find.mockReturnValue(
      query([
        { status: "UP", latency: 100, createdAt: new Date(base) },
        { status: "UP", latency: 200, createdAt: new Date(base + 1000) },
        { status: "DOWN", latency: 300, createdAt: new Date(base + 2000) },
        { status: "UP", latency: 400, createdAt: new Date(base + 3000) },
      ])
    );

    const res = mockRes();
    await getWebsiteAnalytics(
      mockReq({ params: { websiteId: "w1" } as any, query: {} as any }),
      res
    );

    expect(res.body).toMatchObject({
      range: "24h",
      uptime: 75,
      totalChecks: 4,
      upChecks: 3,
      downChecks: 1,
    });
    expect(res.body.latency).toEqual({
      avg: 250,
      p50: 200,
      p95: 400,
      p99: 400,
      min: 100,
      max: 400,
    });
    // All four ticks fall in one 24h bucket, one of which was DOWN.
    expect(res.body.series).toHaveLength(1);
    expect(res.body.series[0]).toMatchObject({ avgLatency: 250, up: false });
  });

  test("falls back to defaults (100% uptime) when there are no ticks", async () => {
    Website.findOne.mockReturnValue(query({ _id: "w1" }));
    WebsiteTick.find.mockReturnValue(query([]));

    const res = mockRes();
    await getWebsiteAnalytics(mockReq({ params: { websiteId: "w1" } as any }), res);

    expect(res.body).toMatchObject({
      uptime: 100,
      totalChecks: 0,
      latency: { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 },
      series: [],
    });
  });

  test("honors a valid range query param and rejects invalid ones", async () => {
    Website.findOne.mockReturnValue(query({ _id: "w1" }));
    WebsiteTick.find.mockReturnValue(query([]));

    const resValid = mockRes();
    await getWebsiteAnalytics(
      mockReq({ params: { websiteId: "w1" } as any, query: { range: "7d" } as any }),
      resValid
    );
    expect(resValid.body.range).toBe("7d");

    const resInvalid = mockRes();
    await getWebsiteAnalytics(
      mockReq({
        params: { websiteId: "w1" } as any,
        query: { range: "bogus" } as any,
      }),
      resInvalid
    );
    expect(resInvalid.body.range).toBe("24h");
  });
});

describe("getWebsiteIncidents", () => {
  test("404s when the website is not found", async () => {
    Website.findOne.mockReturnValue(query(null));
    const res = mockRes();
    await getWebsiteIncidents(
      mockReq({ params: { websiteId: "missing" } as any }),
      res
    );
    expect(res.statusCode).toBe(404);
    expect(Incident.find).not.toHaveBeenCalled();
  });

  test("serializes incidents with string ids", async () => {
    Website.findOne.mockReturnValue(query({ _id: "w1" }));
    Incident.find.mockReturnValue(
      query([
        {
          _id: 42,
          startedAt: new Date("2024-01-01T00:00:00Z"),
          resolvedAt: null,
          durationMs: null,
          ongoing: true,
          lastStatusCode: 503,
        },
      ])
    );

    const res = mockRes();
    await getWebsiteIncidents(mockReq({ params: { websiteId: "w1" } as any }), res);

    expect(res.body.incidents).toHaveLength(1);
    expect(res.body.incidents[0]).toMatchObject({
      id: "42",
      ongoing: true,
      lastStatusCode: 503,
    });
  });
});
