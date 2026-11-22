import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import { mockDb } from "./helpers/mockDb";

function query<T>(result: T) {
  const q: any = { sort: () => q, lean: async () => result };
  return q;
}

const StatusPage = {
  find: mock(() => query<any[]>([])),
  countDocuments: mock(async () => 0),
  create: mock(async (doc: any) => ({ toObject: () => ({ _id: "p1", ...doc }) })),
  findOneAndUpdate: mock((..._a: any[]) => query<any>(null)),
  deleteOne: mock(async (..._a: any[]) => ({ deletedCount: 1 })),
};
let owned: { _id: string; disabled?: boolean }[] = [];
const Website = {
  find: mock((..._a: any[]) => ({ select: () => ({ lean: async () => owned }) })),
};
mockDb({ StatusPage, Website });

const { createStatusPage, updateStatusPage, deleteStatusPage } = await import(
  "../controllers/statusPageController"
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
const mockReq = (o: Partial<Request> = {}) =>
  ({ userId: "user_1", params: {}, body: {}, ...o }) as unknown as Request;

const W1 = "65a000000000000000000001";
const W2 = "65a000000000000000000002";
const PAGE = "65a0000000000000000000aa";

beforeEach(() => {
  for (const m of Object.values(StatusPage)) m.mockReset();
  Website.find.mockClear();
  owned = [];
  StatusPage.countDocuments.mockResolvedValue(0);
  StatusPage.create.mockImplementation(async (doc: any) => ({
    toObject: () => ({ _id: "p1", ...doc }),
  }));
  StatusPage.findOneAndUpdate.mockReturnValue(query(null));
  StatusPage.deleteOne.mockResolvedValue({ deletedCount: 1 });
});

describe("createStatusPage", () => {
  test("creates a page for monitors the user owns", async () => {
    owned = [{ _id: W1 }, { _id: W2 }];
    const res = mockRes();
    await createStatusPage(
      mockReq({ body: { slug: "Acme", title: "Acme status", websiteIds: [W1, W2, W1] } }),
      res
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ slug: "acme", websiteIds: [W1, W2] });
    expect(Website.find.mock.calls[0]![0]).toEqual({ _id: { $in: [W1, W2] }, userId: "user_1" });
  });

  test("rejects monitors the user does not own", async () => {
    owned = [{ _id: W1 }];
    const res = mockRes();
    await createStatusPage(
      mockReq({ body: { slug: "acme", title: "Acme", websiteIds: [W1, W2] } }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(StatusPage.create).not.toHaveBeenCalled();
  });

  test("rejects invalid slugs", async () => {
    const res = mockRes();
    await createStatusPage(mockReq({ body: { slug: "-x", title: "Acme" } }), res);
    expect(res.statusCode).toBe(400);
  });

  test("reports taken slugs as 409", async () => {
    StatusPage.create.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    const res = mockRes();
    await createStatusPage(mockReq({ body: { slug: "acme", title: "Acme" } }), res);
    expect(res.statusCode).toBe(409);
  });
});

describe("update/delete", () => {
  test("drops deleted monitors instead of rejecting the edit", async () => {
    owned = [{ _id: W1 }, { _id: W2, disabled: true }];
    StatusPage.findOneAndUpdate.mockReturnValue(query({ _id: PAGE, slug: "acme", title: "Acme", websiteIds: [W1] }));
    const res = mockRes();
    await updateStatusPage(
      mockReq({ params: { statusPageId: PAGE } as any, body: { websiteIds: [W1, W2] } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(StatusPage.findOneAndUpdate.mock.calls[0]![1]).toEqual({ $set: { websiteIds: [W1] } });
  });

  test("saves and returns branding fields, with defaults for older pages", async () => {
    StatusPage.findOneAndUpdate.mockReturnValue(
      query({ _id: PAGE, slug: "acme", title: "Acme", websiteIds: [], accentColor: "#ff0000", announcement: "Hi" })
    );
    const res = mockRes();
    await updateStatusPage(
      mockReq({
        params: { statusPageId: PAGE } as any,
        body: { accentColor: "#FF0000", announcement: " Hi ", logoUrl: "", showIncidentHistory: false },
      }),
      res
    );
    expect(StatusPage.findOneAndUpdate.mock.calls[0]![1]).toEqual({
      $set: { accentColor: "#ff0000", announcement: "Hi", logoUrl: "", showIncidentHistory: false },
    });
    expect(res.body).toMatchObject({
      accentColor: "#ff0000",
      announcement: "Hi",
      logoUrl: "",
      showIncidentHistory: true,
    });

    const bad = mockRes();
    await updateStatusPage(
      mockReq({ params: { statusPageId: PAGE } as any, body: { logoUrl: "javascript:alert(1)" } }),
      bad
    );
    expect(bad.statusCode).toBe(400);
  });

  test("404s pages owned by someone else", async () => {
    const res = mockRes();
    await updateStatusPage(
      mockReq({ params: { statusPageId: PAGE } as any, body: { title: "New" } }),
      res
    );
    expect(res.statusCode).toBe(404);
    expect(StatusPage.findOneAndUpdate.mock.calls[0]![0]).toEqual({ _id: PAGE, userId: "user_1" });
  });

  test("deletes scoped to the user", async () => {
    StatusPage.deleteOne.mockResolvedValue({ deletedCount: 0 });
    const res = mockRes();
    await deleteStatusPage(mockReq({ params: { statusPageId: PAGE } as any }), res);
    expect(res.statusCode).toBe(404);
    expect(StatusPage.deleteOne).toHaveBeenCalledWith({ _id: PAGE, userId: "user_1" });
  });
});
