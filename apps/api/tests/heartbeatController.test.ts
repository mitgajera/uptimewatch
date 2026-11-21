import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request, Response } from "express";
import { mockDb } from "./helpers/mockDb";

const Website = { findOneAndUpdate: mock((..._a: any[]) => ({ lean: async () => null as any })) };
mockDb({ Website });

const recordCheckResult = mock(async (..._a: any[]) => {});
mock.module("../monitor/record", () => ({ recordCheckResult }));

const { receiveHeartbeat } = await import("../controllers/heartbeatController");

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
const req = (token: string) => ({ params: { token } }) as unknown as Request;
const TOKEN = "abcdefghijklmnopqrstuvwxyz0";
const found = (doc: any) => Website.findOneAndUpdate.mockReturnValue({ lean: async () => doc });

beforeEach(() => {
  Website.findOneAndUpdate.mockReset();
  recordCheckResult.mockReset();
  found(null);
});

describe("receiveHeartbeat", () => {
  test("404s malformed tokens without touching the database", async () => {
    const res = mockRes();
    await receiveHeartbeat(req("../../etc"), res);
    expect(res.statusCode).toBe(404);
    expect(Website.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("404s unknown tokens", async () => {
    const res = mockRes();
    await receiveHeartbeat(req(TOKEN), res);
    expect(res.statusCode).toBe(404);
    expect(Website.findOneAndUpdate.mock.calls[0]![0]).toEqual({
      heartbeatToken: TOKEN,
      type: "heartbeat",
      disabled: false,
    });
  });

  test("records the ping time", async () => {
    found({ _id: "w1", isDown: false });
    const res = mockRes();
    await receiveHeartbeat(req(TOKEN), res);
    expect(res.body.ok).toBe(true);
    expect(Website.findOneAndUpdate.mock.calls[0]![1].$set.lastHeartbeatAt).toBeInstanceOf(Date);
    expect(recordCheckResult).not.toHaveBeenCalled();
  });

  test("recovers a down monitor immediately", async () => {
    found({ _id: "w1", isDown: true });
    await receiveHeartbeat(req(TOKEN), mockRes());
    expect(recordCheckResult).toHaveBeenCalledTimes(1);
    expect(recordCheckResult.mock.calls[0]![1]).toMatchObject({ status: "UP" });
  });

  test("does not recover paused monitors", async () => {
    found({ _id: "w1", isDown: true, paused: true });
    await receiveHeartbeat(req(TOKEN), mockRes());
    expect(recordCheckResult).not.toHaveBeenCalled();
  });
});
