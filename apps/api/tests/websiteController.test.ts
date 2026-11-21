import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";

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
};
const WebsiteTick = {
  find: mock((_filter: any) => query<any[]>([])),
};

mock.module("db/client", () => ({ Website, WebsiteTick }));

const { getAllWebsites, disableWebsite, RECENT_TICKS_WINDOW_MS } = await import(
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
  for (const m of [Website.find, Website.findOne, Website.updateOne, WebsiteTick.find]) {
    m.mockReset();
  }
  Website.find.mockReturnValue(query([]));
  WebsiteTick.find.mockReturnValue(query([]));
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
    expect(a.id).toBe("a");
    expect(a.websiteTicks.map((t: any) => t.id)).toEqual(["t1", "t3"]);
    expect(b.websiteTicks.map((t: any) => t.id)).toEqual(["t2"]);
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
