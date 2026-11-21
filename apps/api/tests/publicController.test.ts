import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import { mockDb } from "./helpers/mockDb";

function query<T>(result: T) {
  const q: any = { select: () => q, sort: () => q, limit: () => q, lean: async () => result };
  return q;
}

const StatusPage = { findOne: mock((..._a: any[]) => query<any>(null)) };
const Website = { find: mock((..._a: any[]) => query<any[]>([])) };
const WebsiteTick = { aggregate: mock(async (..._a: any[]) => [] as any[]) };
const Incident = { find: mock((..._a: any[]) => query<any[]>([])) };
mockDb({ StatusPage, Website, WebsiteTick, Incident });

const { getPublicStatusPage, getStatusBadge, clearPublicCache } = await import(
  "../controllers/publicController"
);

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    headers: {} as Record<string, string>,
    set(k: string | Record<string, string>, v?: string) {
      if (typeof k === "string") res.headers[k] = v!;
      else Object.assign(res.headers, k);
      return res;
    },
    send(payload: unknown) {
      res.body = payload;
      return res;
    },
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
const req = (slug: string) => ({ params: { slug } }) as unknown as Request;

const A = "65a000000000000000000001";
const B = "65a000000000000000000002";

beforeEach(() => {
  clearPublicCache();
  for (const m of [StatusPage.findOne, Website.find, WebsiteTick.aggregate, Incident.find]) {
    m.mockReset();
  }
  StatusPage.findOne.mockReturnValue(query(null));
  Website.find.mockReturnValue(query([]));
  WebsiteTick.aggregate.mockResolvedValue([]);
  Incident.find.mockReturnValue(query([]));
});

describe("getPublicStatusPage", () => {
  test("404s for unknown or unpublished pages", async () => {
    const res = mockRes();
    await getPublicStatusPage(req("acme"), res);
    expect(res.statusCode).toBe(404);
    expect(StatusPage.findOne.mock.calls[0]![0]).toEqual({ slug: "acme", published: true });
  });

  test("summarizes monitors in the owner's order without exposing URLs", async () => {
    StatusPage.findOne.mockReturnValue(
      query({ title: "Acme", description: "", websiteIds: [B, A] })
    );
    Website.find.mockReturnValue(
      query([
        { _id: A, name: "API", url: "https://api.acme.dev/secret-path", isDown: true, lastCheckedAt: new Date() },
        { _id: B, name: "", url: "https://www.acme.dev/", lastCheckedAt: new Date() },
      ])
    );
    const today = new Date().toISOString().slice(0, 10);
    WebsiteTick.aggregate.mockResolvedValue([{ _id: { w: A, day: today }, total: 4, up: 3 }]);
    Incident.find.mockReturnValue(
      query([{ _id: "i1", websiteId: A, startedAt: new Date(), ongoing: true }])
    );

    const res = mockRes();
    await getPublicStatusPage(req("ACME"), res);

    expect(res.body.status).toBe("partial_outage");
    expect(res.body.monitors.map((m: any) => m.name)).toEqual(["www.acme.dev", "API"]);
    const api = res.body.monitors[1];
    expect(api).toMatchObject({ status: "down", uptime: 75 });
    expect(api.days).toHaveLength(90);
    expect(api.days.at(-1)).toEqual({ date: today, uptime: 75 });
    expect(JSON.stringify(res.body)).not.toContain("secret-path");
    expect(res.body.incidents[0]).toMatchObject({ monitor: "API", ongoing: true });
  });

  test("serves repeat requests from cache", async () => {
    StatusPage.findOne.mockReturnValue(query({ title: "Acme", websiteIds: [] }));
    await getPublicStatusPage(req("acme"), mockRes());
    await getPublicStatusPage(req("acme"), mockRes());
    expect(StatusPage.findOne).toHaveBeenCalledTimes(1);
  });
});

describe("getStatusBadge", () => {
  test("renders the page status as an embeddable SVG", async () => {
    StatusPage.findOne.mockReturnValue(query({ title: "Acme", websiteIds: [] }));
    const res = mockRes();
    await getStatusBadge({ params: { slug: "acme" }, query: { label: "acme" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect((res as any).headers["Content-Type"]).toContain("image/svg+xml");
    expect((res as any).headers["Cross-Origin-Resource-Policy"]).toBe("cross-origin");
    expect(res.body).toContain(">acme</text>");
    expect(res.body).toContain(">unknown</text>");
  });

  test("404s with an unknown badge for missing pages", async () => {
    const res = mockRes();
    await getStatusBadge({ params: { slug: "nope" }, query: {} } as any, res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toContain("<svg");
  });
});
