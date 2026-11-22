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

const Incident = {
  find: mock((..._a: any[]) => query<any[]>([])),
  findOne: mock((..._a: any[]) => query<any>(null)),
  findOneAndUpdate: mock((..._a: any[]) => query<any>(null)),
};
const Website = { find: mock((..._a: any[]) => query<any[]>([])) };
mockDb({ Incident, Website });

const { listIncidents, getIncident, acknowledgeIncident, addIncidentUpdate, exportIncidents } = await import(
  "../controllers/incidentController"
);

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
    set(h: Record<string, string>) {
      Object.assign(res.headers, h);
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

const I1 = "65a0000000000000000000a1";
const W1 = "65a000000000000000000001";

const incident = (over: Record<string, unknown> = {}) => ({
  _id: I1,
  websiteId: W1,
  userId: "user_1",
  startedAt: new Date("2026-01-01T00:00:00Z"),
  resolvedAt: null,
  durationMs: null,
  ongoing: true,
  lastStatusCode: 503,
  errorType: "HTTP_STATUS",
  errorMessage: "Unexpected HTTP 503",
  acknowledgedAt: null,
  updates: [],
  ...over,
});

beforeEach(() => {
  for (const m of [...Object.values(Incident), Website.find]) m.mockReset();
  Incident.find.mockReturnValue(query([]));
  Incident.findOne.mockReturnValue(query(null));
  Incident.findOneAndUpdate.mockReturnValue(query(null));
  Website.find.mockReturnValue(query([{ _id: W1, name: "", url: "https://api.acme.dev/health", type: "http" }]));
});

describe("listIncidents", () => {
  const list = async (q: Record<string, string> = {}) => {
    const res = mockRes();
    await listIncidents(mockReq({ query: q as any }), res);
    return res;
  };

  test("serializes IncidentDetail with the monitor's name or URL host", async () => {
    Incident.find.mockReturnValue(
      query([
        incident({
          updates: [{ _id: "u1", at: new Date("2026-01-01T00:05:00Z"), message: "Looking", status: "investigating", public: true }],
        }),
      ])
    );
    const res = await list();
    expect(res.body).toEqual({
      incidents: [
        {
          id: I1,
          websiteId: W1,
          monitorName: "api.acme.dev",
          monitorUrl: "https://api.acme.dev/health",
          startedAt: "2026-01-01T00:00:00.000Z",
          resolvedAt: null,
          durationMs: null,
          ongoing: true,
          lastStatusCode: 503,
          errorType: "HTTP_STATUS",
          errorMessage: "Unexpected HTTP 503",
          acknowledgedAt: null,
          updates: [
            { id: "u1", at: "2026-01-01T00:05:00.000Z", message: "Looking", status: "investigating", public: true },
          ],
        },
      ],
      nextBefore: null,
    });
    expect(Incident.find.mock.calls[0]![0]).toEqual({ userId: "user_1" });
  });

  test("filters by status, monitor and cursor", async () => {
    await list({ status: "open" });
    expect(Incident.find.mock.calls[0]![0]).toEqual({ userId: "user_1", ongoing: true, acknowledgedAt: null });
    await list({ status: "acknowledged" });
    expect(Incident.find.mock.calls[1]![0]).toEqual({ userId: "user_1", ongoing: true, acknowledgedAt: { $ne: null } });
    await list({ status: "resolved", websiteId: W1, before: "2026-02-01T00:00:00Z" });
    expect(Incident.find.mock.calls[2]![0]).toEqual({
      userId: "user_1",
      ongoing: false,
      websiteId: W1,
      startedAt: { $lt: new Date("2026-02-01T00:00:00Z") },
    });
  });

  test("returns a cursor when the page is full", async () => {
    const q = query([incident(), incident({ _id: "x", startedAt: new Date("2025-12-31T00:00:00Z") })]);
    Incident.find.mockReturnValue(q);
    const res = await list({ limit: "2" });
    expect(q.limit).toHaveBeenCalledWith(2);
    expect(res.body.nextBefore).toBe("2025-12-31T00:00:00.000Z");
  });

  test("rejects bad filters", async () => {
    expect((await list({ status: "weird" })).statusCode).toBe(400);
    expect((await list({ websiteId: "nope" })).statusCode).toBe(400);
    expect((await list({ before: "yesterday" })).statusCode).toBe(400);
  });
});

describe("getIncident", () => {
  test("scopes to the user and 404s otherwise", async () => {
    const res = mockRes();
    await getIncident(mockReq({ params: { incidentId: I1 } as any }), res);
    expect(res.statusCode).toBe(404);
    expect(Incident.findOne.mock.calls[0]![0]).toEqual({ _id: I1, userId: "user_1" });

    Incident.findOne.mockReturnValue(query(incident()));
    const ok = mockRes();
    await getIncident(mockReq({ params: { incidentId: I1 } as any }), ok);
    expect(ok.body).toMatchObject({ id: I1, monitorName: "api.acme.dev" });

    const bad = mockRes();
    await getIncident(mockReq({ params: { incidentId: "nope" } as any }), bad);
    expect(bad.statusCode).toBe(400);
  });
});

describe("acknowledgeIncident", () => {
  test("sets acknowledgedAt once", async () => {
    const at = new Date("2026-01-01T00:10:00Z");
    Incident.findOneAndUpdate.mockReturnValue(query(incident({ acknowledgedAt: at })));
    const res = mockRes();
    await acknowledgeIncident(mockReq({ params: { incidentId: I1 } as any }), res);
    const [filter, update] = Incident.findOneAndUpdate.mock.calls[0]!;
    expect(filter).toEqual({ _id: I1, userId: "user_1", acknowledgedAt: null });
    expect(update.$set.acknowledgedAt).toBeInstanceOf(Date);
    expect(res.body.acknowledgedAt).toBe(at.toISOString());
  });

  test("is idempotent: an already acknowledged incident is returned unchanged", async () => {
    const at = new Date("2026-01-01T00:10:00Z");
    Incident.findOne.mockReturnValue(query(incident({ acknowledgedAt: at })));
    const res = mockRes();
    await acknowledgeIncident(mockReq({ params: { incidentId: I1 } as any }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.acknowledgedAt).toBe(at.toISOString());
  });

  test("404s for someone else's incident", async () => {
    const res = mockRes();
    await acknowledgeIncident(mockReq({ params: { incidentId: I1 } as any }), res);
    expect(res.statusCode).toBe(404);
  });
});

describe("addIncidentUpdate", () => {
  test("appends a validated update", async () => {
    Incident.findOneAndUpdate.mockReturnValue(
      query(incident({ updates: [{ _id: "u9", at: new Date(), message: "Fixed DNS", status: "identified", public: true }] }))
    );
    const res = mockRes();
    await addIncidentUpdate(
      mockReq({ params: { incidentId: I1 } as any, body: { message: " Fixed DNS ", status: "identified", public: true } }),
      res
    );
    expect(res.statusCode).toBe(200);
    const [filter, update] = Incident.findOneAndUpdate.mock.calls[0]!;
    expect(filter).toMatchObject({ _id: I1, userId: "user_1" });
    expect(update.$push.updates).toMatchObject({ message: "Fixed DNS", status: "identified", public: true });
    expect(res.body.updates[0]).toMatchObject({ id: "u9", message: "Fixed DNS" });
  });

  test("rejects invalid bodies and unknown incidents", async () => {
    const bad = mockRes();
    await addIncidentUpdate(mockReq({ params: { incidentId: I1 } as any, body: { message: "", status: "x" } }), bad);
    expect(bad.statusCode).toBe(400);
    expect(Incident.findOneAndUpdate).not.toHaveBeenCalled();

    const missing = mockRes();
    await addIncidentUpdate(
      mockReq({ params: { incidentId: I1 } as any, body: { message: "hi", status: "monitoring", public: false } }),
      missing
    );
    expect(missing.statusCode).toBe(404);
  });
});

describe("exportIncidents", () => {
  test("exports the user's incidents as CSV", async () => {
    Incident.find.mockReturnValue(
      query([
        incident({ errorMessage: "a, b" }),
        incident({
          _id: "i2",
          ongoing: false,
          resolvedAt: new Date("2026-01-01T01:00:00Z"),
          durationMs: 3_600_000,
          lastStatusCode: null,
          errorType: null,
          errorMessage: null,
        }),
      ])
    );
    const res = mockRes();
    await exportIncidents(mockReq(), res);
    expect(Incident.find.mock.calls[0]![0]).toEqual({ userId: "user_1" });
    expect(res.headers["Content-Disposition"]).toBe('attachment; filename="incidents.csv"');
    const lines = (res.body as string).split("\r\n");
    expect(lines[0]).toBe(
      "id,monitor,started_at,resolved_at,duration_ms,status,acknowledged_at,status_code,error_type,error_message"
    );
    expect(lines[1]).toBe(`${I1},api.acme.dev,2026-01-01T00:00:00.000Z,,,open,,503,HTTP_STATUS,"a, b"`);
    expect(lines[2]).toBe("i2,api.acme.dev,2026-01-01T00:00:00.000Z,2026-01-01T01:00:00.000Z,3600000,resolved,,,,");
  });
});
