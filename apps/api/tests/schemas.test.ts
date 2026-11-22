import { describe, expect, test } from "bun:test";
import {
  bulkMonitorSchema,
  createAlertChannelSchema,
  createMonitorSchema,
  createStatusPageSchema,
  incidentUpdateSchema,
  updateAlertChannelSchema,
  updateMonitorSchema,
  updateStatusPageSchema,
} from "../validation";

describe("monitor types", () => {
  test("tcp needs host and port; dns needs host; heartbeat needs neither", () => {
    expect(createMonitorSchema.safeParse({ type: "tcp", host: "db.example.com", port: 5432 }).success).toBe(true);
    expect(createMonitorSchema.safeParse({ type: "tcp", host: "db.example.com" }).success).toBe(false);
    expect(createMonitorSchema.safeParse({ type: "tcp", port: 22 }).success).toBe(false);
    expect(
      createMonitorSchema.safeParse({ type: "dns", host: "_dmarc.example.com", dnsRecordType: "TXT" }).success
    ).toBe(true);
    expect(createMonitorSchema.safeParse({ type: "dns" }).success).toBe(false);
    expect(createMonitorSchema.safeParse({ type: "heartbeat" }).success).toBe(true);
  });

  test("validates hosts, ports, record types and expected text", () => {
    const tcp = (o: object) => createMonitorSchema.safeParse({ type: "tcp", host: "h.dev", port: 1, ...o }).success;
    expect(tcp({ host: "10.0.0.1" })).toBe(true); // shape only; SSRF is checked by the controller
    expect(tcp({ host: "2001:db8::1" })).toBe(true);
    expect(tcp({ host: "not a host" })).toBe(false);
    expect(tcp({ host: "a".repeat(254) })).toBe(false);
    expect(tcp({ port: 0 })).toBe(false);
    expect(tcp({ port: 65_536 })).toBe(false);
    expect(createMonitorSchema.safeParse({ type: "dns", host: "x.dev", dnsRecordType: "SRV" }).success).toBe(false);
    expect(
      createMonitorSchema.safeParse({ type: "dns", host: "x.dev", dnsExpected: "a".repeat(201) }).success
    ).toBe(false);
  });
});

describe("http request options", () => {
  const http = (o: object) => createMonitorSchema.safeParse({ url: "https://x.dev", ...o });

  test("methods, keyword modes and degraded thresholds", () => {
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]) expect(http({ method }).success).toBe(true);
    expect(http({ method: "TRACE" }).success).toBe(false);
    expect(http({ keywordMode: "absent" }).success).toBe(true);
    expect(http({ keywordMode: "regex" }).success).toBe(false);
    expect(http({ degradedThresholdMs: null }).success).toBe(true);
    expect(http({ degradedThresholdMs: 100 }).success).toBe(true);
    expect(http({ degradedThresholdMs: 99 }).success).toBe(false);
    expect(http({ degradedThresholdMs: 30_001 }).success).toBe(false);
  });

  test("headers: at most 10, safe names, no Host/Content-Length, bounded values", () => {
    expect(http({ headers: [{ name: "X-Api-Key", value: "abc" }] }).success).toBe(true);
    expect(
      http({ headers: Array.from({ length: 11 }, (_, i) => ({ name: `X-${i}`, value: "" })) }).success
    ).toBe(false);
    expect(http({ headers: [{ name: "Bad Name", value: "x" }] }).success).toBe(false);
    expect(http({ headers: [{ name: "host", value: "x" }] }).success).toBe(false);
    expect(http({ headers: [{ name: "Content-Length", value: "1" }] }).success).toBe(false);
    expect(http({ headers: [{ name: "X-A", value: "a".repeat(1001) }] }).success).toBe(false);
    expect(http({ headers: [{ name: "X-A", value: "a\r\nInjected: 1" }] }).success).toBe(false);
  });

  test("body is capped at 10 000 characters", () => {
    expect(http({ body: "a".repeat(10_000) }).success).toBe(true);
    expect(http({ body: "a".repeat(10_001) }).success).toBe(false);
  });
});

describe("tags, routing and reminders", () => {
  test("tags are trimmed, lower-cased, de-duplicated and validated", () => {
    const ok = updateMonitorSchema.safeParse({ tags: [" Prod ", "prod", "eu_west-1"] });
    expect(ok.data?.tags).toEqual(["prod", "eu_west-1"]);
    expect(updateMonitorSchema.safeParse({ tags: ["bad!"] }).success).toBe(false);
    expect(updateMonitorSchema.safeParse({ tags: [""] }).success).toBe(false);
    expect(updateMonitorSchema.safeParse({ tags: ["a".repeat(25)] }).success).toBe(false);
    expect(
      updateMonitorSchema.safeParse({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).success
    ).toBe(false);
  });

  test("alert channel ids must be object ids", () => {
    expect(updateMonitorSchema.safeParse({ alertChannelIds: ["65a000000000000000000001"] }).success).toBe(true);
    expect(updateMonitorSchema.safeParse({ alertChannelIds: [] }).success).toBe(true);
    expect(updateMonitorSchema.safeParse({ alertChannelIds: ["nope"] }).success).toBe(false);
  });

  test("reminders use the fixed set of intervals", () => {
    for (const reminderMinutes of [0, 15, 30, 60, 240, 1440]) {
      expect(updateMonitorSchema.safeParse({ reminderMinutes }).success).toBe(true);
    }
    expect(updateMonitorSchema.safeParse({ reminderMinutes: 5 }).success).toBe(false);
  });

  test("the monitor type is fixed after creation", () => {
    expect(updateMonitorSchema.safeParse({ type: "tcp" }).success).toBe(false);
  });
});

describe("bulk schema", () => {
  const ID = "65a000000000000000000001";
  test("1-100 ids and a known action; tag actions need a tag", () => {
    expect(bulkMonitorSchema.safeParse({ ids: [ID], action: "pause" }).success).toBe(true);
    expect(bulkMonitorSchema.safeParse({ ids: [], action: "pause" }).success).toBe(false);
    expect(bulkMonitorSchema.safeParse({ ids: Array(101).fill(ID), action: "pause" }).success).toBe(false);
    expect(bulkMonitorSchema.safeParse({ ids: [ID], action: "explode" }).success).toBe(false);
    expect(bulkMonitorSchema.safeParse({ ids: [ID], action: "addTag" }).success).toBe(false);
    expect(bulkMonitorSchema.safeParse({ ids: [ID], action: "addTag", tag: " Prod " }).data?.tag).toBe("prod");
  });
});

describe("alert channel, status page and incident schemas", () => {
  test("telegram channels need a well-formed chat id", () => {
    const base = { type: "telegram", target: "1:x" };
    expect(createAlertChannelSchema.safeParse(base).success).toBe(false);
    expect(createAlertChannelSchema.safeParse({ ...base, chatId: "-100123" }).success).toBe(true);
    expect(createAlertChannelSchema.safeParse({ ...base, chatId: "@my_channel" }).success).toBe(true);
    expect(createAlertChannelSchema.safeParse({ ...base, chatId: "abc" }).success).toBe(false);
    for (const type of ["teams", "googlechat", "ntfy"]) {
      expect(createAlertChannelSchema.safeParse({ type, target: "https://x" }).success).toBe(true);
    }
    expect(updateAlertChannelSchema.safeParse({ chatId: "42" }).success).toBe(true);
  });

  test("status page branding", () => {
    const page = (o: object) => createStatusPageSchema.safeParse({ slug: "acme", title: "Acme", ...o });
    expect(page({ logoUrl: "" }).success).toBe(true);
    expect(page({ logoUrl: "https://cdn.acme.dev/logo.png" }).success).toBe(true);
    expect(page({ logoUrl: "http://cdn.acme.dev/logo.png" }).success).toBe(false);
    expect(page({ logoUrl: `https://a.dev/${"a".repeat(500)}` }).success).toBe(false);
    expect(page({ accentColor: "#10B981" }).data?.accentColor).toBe("#10b981");
    expect(page({ accentColor: "red" }).success).toBe(false);
    expect(page({ announcement: "a".repeat(501) }).success).toBe(false);
    expect(updateStatusPageSchema.safeParse({ showIncidentHistory: false }).success).toBe(true);
  });

  test("incident updates", () => {
    expect(incidentUpdateSchema.safeParse({ message: "Fixing", status: "identified", public: true }).success).toBe(true);
    expect(incidentUpdateSchema.safeParse({ message: " ", status: "identified", public: true }).success).toBe(false);
    expect(
      incidentUpdateSchema.safeParse({ message: "a".repeat(2001), status: "monitoring", public: false }).success
    ).toBe(false);
    expect(incidentUpdateSchema.safeParse({ message: "x", status: "done", public: false }).success).toBe(false);
    expect(incidentUpdateSchema.safeParse({ message: "x", status: "resolved" }).success).toBe(false);
  });
});
