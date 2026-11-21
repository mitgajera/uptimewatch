import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import { mockDb } from "./helpers/mockDb";

function query<T>(result: T) {
  const q: any = { sort: () => q, lean: async () => result };
  return q;
}

const AlertChannel = {
  find: mock(() => query<any[]>([])),
  findOne: mock((..._a: any[]) => query<any>(null)),
  findOneAndUpdate: mock((..._a: any[]) => query<any>(null)),
  countDocuments: mock(async () => 0),
  create: mock(async (doc: any) => ({ toObject: () => ({ _id: "c1", ...doc }) })),
  deleteOne: mock(async (..._a: any[]) => ({})),
};
mockDb({ AlertChannel });

const { createAlertChannel, updateAlertChannel, deleteAlertChannel } = await import(
  "../controllers/alertChannelController"
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

const ID = "65a000000000000000000001";

beforeEach(() => {
  for (const m of Object.values(AlertChannel)) m.mockReset();
  AlertChannel.countDocuments.mockResolvedValue(0);
  AlertChannel.create.mockImplementation(async (doc: any) => ({
    toObject: () => ({ _id: "c1", ...doc }),
  }));
  AlertChannel.findOne.mockReturnValue(query(null));
  AlertChannel.findOneAndUpdate.mockReturnValue(query(null));
});

describe("createAlertChannel", () => {
  test("creates a valid Slack channel", async () => {
    const res = mockRes();
    await createAlertChannel(
      mockReq({
        body: { type: "slack", name: "Ops", target: "https://hooks.slack.com/services/T/B/x" },
      }),
      res
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ id: "c1", type: "slack", name: "Ops", enabled: true });
  });

  test("rejects a target that does not match the channel type", async () => {
    const res = mockRes();
    await createAlertChannel(mockReq({ body: { type: "slack", target: "https://evil.dev/hook" } }), res);
    expect(res.statusCode).toBe(400);
    expect(AlertChannel.create).not.toHaveBeenCalled();
  });

  test("enforces the channel limit", async () => {
    AlertChannel.countDocuments.mockResolvedValue(10);
    const res = mockRes();
    await createAlertChannel(mockReq({ body: { type: "email", target: "ops@acme.dev" } }), res);
    expect(res.statusCode).toBe(403);
  });
});

describe("update/delete", () => {
  test("404s for channels owned by someone else", async () => {
    const res = mockRes();
    await updateAlertChannel(
      mockReq({ params: { channelId: ID } as any, body: { enabled: false } }),
      res
    );
    expect(res.statusCode).toBe(404);
    expect(AlertChannel.findOne.mock.calls[0]![0]).toEqual({ _id: ID, userId: "user_1" });
  });

  test("re-validates a changed target against the stored type", async () => {
    AlertChannel.findOne.mockReturnValue(query({ _id: ID, type: "email", target: "a@b.dev" }));
    const res = mockRes();
    await updateAlertChannel(
      mockReq({ params: { channelId: ID } as any, body: { target: "not-an-email" } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  test("deletes an owned channel", async () => {
    AlertChannel.findOne.mockReturnValue(query({ _id: ID, type: "email", target: "a@b.dev" }));
    const res = mockRes();
    await deleteAlertChannel(mockReq({ params: { channelId: ID } as any }), res);
    expect(res.statusCode).toBe(200);
    expect(AlertChannel.deleteOne).toHaveBeenCalledWith({ _id: ID, userId: "user_1" });
  });
});
