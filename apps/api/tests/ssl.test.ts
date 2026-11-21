import { describe, expect, test } from "bun:test";
import { daysUntil, sslAlertThreshold } from "../monitor/ssl";

describe("sslAlertThreshold", () => {
  test("no alert while far from expiry", () => {
    expect(sslAlertThreshold(45, null)).toBeNull();
  });

  test("alerts at the tightest crossed threshold", () => {
    expect(sslAlertThreshold(30, null)).toBe(30);
    expect(sslAlertThreshold(10, null)).toBe(14);
    expect(sslAlertThreshold(3, null)).toBe(7);
    expect(sslAlertThreshold(0, null)).toBe(1);
    expect(sslAlertThreshold(-2, null)).toBe(1);
  });

  test("each threshold fires once", () => {
    expect(sslAlertThreshold(20, 30)).toBeNull();
    expect(sslAlertThreshold(13, 30)).toBe(14);
    expect(sslAlertThreshold(13, 14)).toBeNull();
    expect(sslAlertThreshold(6, 14)).toBe(7);
  });
});

describe("daysUntil", () => {
  test("floors to whole days", () => {
    const now = Date.UTC(2024, 0, 1);
    expect(daysUntil(new Date(Date.UTC(2024, 0, 15, 12)), now)).toBe(14);
    expect(daysUntil(new Date(Date.UTC(2023, 11, 31)), now)).toBe(-1);
  });
});
