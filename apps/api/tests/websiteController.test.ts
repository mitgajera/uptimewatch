import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import { mockDb } from "./helpers/mockDb";

// Chainable Mongoose query stub; controllers await the terminal `.lean()`.
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
  updateOne: mock(async () => ({ matchedCount: 1 })),
  countDocuments: mock(async () => 0),
  create: mock(async (doc: any) => ({ _id: "new-id", ...doc })),
  findOneAndUpdate: mock((..._args: any[]) => query<any>(null)),
};
const WebsiteTick = {
  find: mock((_filter: any) => query<any[]>([])),
  aggregate: mock(async (..._a: any[]) => [] as any[]),
};

mockDb({ Website, WebsiteTick });

const {
  getAllWebsites,
  getWebsite,
  disableWebsite,
  createWebsite,
  updateWebsite,
  RECENT_TICKS_WINDOW_MS,
} =
  await import(
  "../controllers/websiteController"
);

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

const mockReq = (overrides: Partial<Request> = {}) =>
  ({ userId: "user_1", params: {}, query: {}, body: {}, ...overrides }) as unknown as Request;

beforeEach(() => {
  for (const m of [
    Website.find,
    Website.findOne,
    Website.updateOne,
    Website.countDocuments,
    Website.create,
    Website.findOneAndUpdate,
    WebsiteTick.find,
    WebsiteTick.aggregate,
  ]) {
    m.mockReset();
  }
  Website.countDocuments.mockResolvedValue(0);
  Website.create.mockImplementation(async (doc: any) => ({ _id: "new-id", ...doc }));
  Website.findOneAndUpdate.mockReturnValue(query(null));
  Website.find.mockReturnValue(query([]));
  WebsiteTick.find.mockReturnValue(query([]));
  WebsiteTick.aggregate.mockResolvedValue([]);
  Website.updateOne.mockResolvedValue({ matchedCount: 1 });
});

describe("getAllWebsites", () => {
  test("skips the tick query when the user has no websites", async () => {
    const res = mockRes();
    await getAllWebsites(mockReq(), res);
    expect(res.body).toEqual({ websites: [] });
    expect(WebsiteTick.find).not.toHaveBeenCalled();
  });

  test("fetches only recent ticks in a single query and groups them per website", async () => {
    Website.find.mockReturnValue(
      query([
        { _id: "a", url: "https://a.dev" },
        { _id: "b", url: "https://b.dev" },
      ])
    );
    WebsiteTick.find.mockReturnValue(
      query([
        { _id: "t1", websiteId: "a", status: "UP" },
        { _id: "t2", websiteId: "b", status: "DOWN" },
        { _id: "t3", websiteId: "a", status: "UP" },
      ])
    );

    const before = Date.now();
    const res = mockRes();
    await getAllWebsites(mockReq(), res);

    expect(WebsiteTick.find).toHaveBeenCalledTimes(1);
    const filter = WebsiteTick.find.mock.calls[0]![0];
    expect(filter.websiteId).toEqual({ $in: ["a", "b"] });
    const since = filter.createdAt.$gte.getTime();
    expect(since).toBeGreaterThanOrEqual(before - RECENT_TICKS_WINDOW_MS - 50);
    expect(since).toBeLessThanOrEqual(Date.now() - RECENT_TICKS_WINDOW_MS + 50);

    const [a, b] = res.body.websites;
    // No 24h aggregate rows -> null stats rather than a misleading 100%.
    expect(b).toMatchObject({ uptime24h: null, avgLatency24h: null, checks24h: 0 });
    expect(a.id).toBe("a");
    expect(a.websiteTicks.map((t: any) => t.id)).toEqual(["t1", "t3"]);
    expect(b.websiteTicks.map((t: any) => t.id)).toEqual(["t2"]);
  });
});

describe("getAllWebsites 24h stats", () => {
  test("attaches uptime, latency and check counts from the aggregate", async () => {
    Website.find.mockReturnValue(query([{ _id: "a", url: "https://a.dev" }]));
    WebsiteTick.aggregate.mockResolvedValue([{ _id: "a", total: 8, up: 7, avgLatency: 123.4 }]);
    const res = mockRes();
    await getAllWebsites(mockReq(), res);
    expect(res.body.websites[0]).toMatchObject({
      uptime24h: 87.5,
      avgLatency24h: 123,
      checks24h: 8,
    });
  });
});

describe("disableWebsite", () => {
  test("400s on a malformed id", async () => {
    const res = mockRes();
    await disableWebsite(mockReq({ params: { websiteId: "nope" } as any }), res);
    expect(res.statusCode).toBe(400);
    expect(Website.updateOne).not.toHaveBeenCalled();
  });

  test("404s when nothing matched", async () => {
    Website.updateOne.mockResolvedValue({ matchedCount: 0 });
    const res = mockRes();
    await disableWebsite(
      mockReq({ params: { websiteId: "65a000000000000000000001" } as any }),
      res
    );
    expect(res.statusCode).toBe(404);
  });

  test("scopes the update to the requesting user", async () => {
    const res = mockRes();
    await disableWebsite(
      mockReq({ params: { websiteId: "65a000000000000000000001" } as any }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(Website.updateOne).toHaveBeenCalledWith(
      { _id: "65a000000000000000000001", userId: "user_1", disabled: false },
      { $set: { disabled: true } }
    );
  });
});

// A public IP literal avoids DNS lookups in the SSRF check.
const PUBLIC_URL = "https://1.1.1.1/health";
const ID = "65a000000000000000000001";

describe("createWebsite", () => {
  test("creates a monitor with validated config", async () => {
    const res = mockRes();
    await createWebsite(
      mockReq({ body: { url: PUBLIC_URL, name: " API ", intervalSeconds: 300 } }),
      res
    );
    expect(res.statusCode).toBe(201);
    expect(Website.create).toHaveBeenCalledWith({
      url: PUBLIC_URL,
      name: "API",
      intervalSeconds: 300,
      userId: "user_1",
      disabled: false,
    });
  });

  test("rejects invalid config and private targets", async () => {
    const bad = mockRes();
    await createWebsite(mockReq({ body: { url: PUBLIC_URL, intervalSeconds: 7 } }), bad);
    expect(bad.statusCode).toBe(400);
    expect(bad.body.message).toContain("intervalSeconds");

    const priv = mockRes();
    await createWebsite(mockReq({ body: { url: "http://127.0.0.1" } }), priv);
    expect(priv.statusCode).toBe(400);
    expect(Website.create).not.toHaveBeenCalled();
  });

  test("enforces the per-user monitor limit", async () => {
    Website.countDocuments.mockResolvedValue(10_000);
    const res = mockRes();
    await createWebsite(mockReq({ body: { url: PUBLIC_URL } }), res);
    expect(res.statusCode).toBe(403);
    expect(Website.create).not.toHaveBeenCalled();
  });
});

describe("createWebsite (heartbeat)", () => {
  test("creates a heartbeat without a URL and issues a ping token", async () => {
    const res = mockRes();
    await createWebsite(
      mockReq({ body: { type: "heartbeat", name: "Nightly backup", intervalSeconds: 86400 } }),
      res
    );
    expect(res.statusCode).toBe(201);
    const doc = Website.create.mock.calls[0]![0];
    expect(doc).toMatchObject({ type: "heartbeat", url: "", intervalSeconds: 86400 });
    expect(doc.heartbeatToken).toMatch(/^[A-Za-z0-9_-]{27}$/);
  });

  test("still requires a URL for HTTP monitors", async () => {
    const res = mockRes();
    await createWebsite(mockReq({ body: { name: "No URL" } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("url");
  });
});

describe("updateWebsite", () => {
  test("applies a partial update scoped to the user", async () => {
    Website.findOneAndUpdate.mockReturnValue(query({ _id: ID, url: PUBLIC_URL, paused: true }));
    const res = mockRes();
    await updateWebsite(mockReq({ params: { websiteId: ID } as any, body: { paused: true } }), res);

    expect(res.statusCode).toBe(200);
    expect(Website.findOneAndUpdate.mock.calls[0]![0]).toEqual({
      _id: ID,
      userId: "user_1",
      disabled: false,
    });
    expect(Website.findOneAndUpdate.mock.calls[0]![1]).toEqual({ $set: { paused: true } });
    // Defaults are filled in for fields missing on legacy documents.
    expect(res.body).toMatchObject({ id: ID, paused: true, expectedStatus: "200-399" });
  });

  test("resets failure and certificate state when the URL changes", async () => {
    Website.findOneAndUpdate.mockReturnValue(query({ _id: ID, url: PUBLIC_URL }));
    await updateWebsite(
      mockReq({ params: { websiteId: ID } as any, body: { url: PUBLIC_URL } }),
      mockRes()
    );
    expect(Website.findOneAndUpdate.mock.calls[0]![1].$set).toMatchObject({
      url: PUBLIC_URL,
      consecutiveFailures: 0,
      sslExpiresAt: null,
    });
  });

  test("404s for monitors the user does not own", async () => {
    const res = mockRes();
    await updateWebsite(mockReq({ params: { websiteId: ID } as any, body: { name: "x" } }), res);
    expect(res.statusCode).toBe(404);
  });

  test("rejects attempts to set protected fields", async () => {
    const res = mockRes();
    await updateWebsite(
      mockReq({ params: { websiteId: ID } as any, body: { userId: "attacker" } }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(Website.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("getWebsite", () => {
  test("returns the monitor with its recent ticks", async () => {
    Website.findOne.mockReturnValue(query({ _id: ID, url: PUBLIC_URL }));
    WebsiteTick.find.mockReturnValue(query([{ _id: "t1", websiteId: ID, status: "UP" }]));
    const res = mockRes();
    await getWebsite(mockReq({ params: { websiteId: ID } as any }), res);
    expect(res.body).toMatchObject({ id: ID, websiteTicks: [{ id: "t1" }] });
    expect(WebsiteTick.find.mock.calls[0]![0].websiteId).toBe(ID);
  });
});
