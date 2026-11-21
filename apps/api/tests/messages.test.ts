import { describe, expect, test } from "bun:test";
import { downAlert, formatDuration, recoveryAlert, sslExpiryAlert } from "../monitor/messages";

describe("alert messages", () => {
  test("down alerts name the monitor and explain the cause", () => {
    const alert = downAlert(
      { name: "API", url: "https://api.dev" },
      { errorType: "HTTP_STATUS", errorMessage: "Unexpected HTTP 503", statusCode: 503 }
    );
    expect(alert.subject).toBe("🔴 API is DOWN");
    expect(alert.message).toContain("URL: https://api.dev");
    expect(alert.message).toContain("Reason: Unexpected HTTP status (HTTP 503)");
  });

  test("falls back to the URL when the monitor has no name", () => {
    const alert = downAlert(
      { name: "", url: "https://x.dev" },
      { errorType: "DNS", errorMessage: null, statusCode: null }
    );
    expect(alert.subject).toBe("🔴 https://x.dev is DOWN");
    expect(alert.message).toContain("Details: DNS lookup failed");
  });

  test("recovery alerts include the downtime", () => {
    const alert = recoveryAlert({ name: "API", url: "https://api.dev" }, 125_000);
    expect(alert.subject).toBe("🟢 API is back UP");
    expect(alert.message).toContain("Downtime: 2m 5s");
  });

  test("formatDuration scales units", () => {
    expect(formatDuration(42_000)).toBe("42s");
    expect(formatDuration(3_600_000 + 60_000)).toBe("1h 1m");
    expect(formatDuration(26 * 3_600_000)).toBe("1d 2h");
  });
});

describe("heartbeat alerts", () => {
  test("omit the URL line and fall back to a generic label", () => {
    const alert = downAlert(
      { name: "", url: "" },
      { errorType: "MISSED", errorMessage: "No ping for 2h 0m", statusCode: null }
    );
    expect(alert.subject).toBe("🔴 Heartbeat monitor is DOWN");
    expect(alert.message).not.toContain("URL:");
    expect(alert.message).toContain("Reason: Heartbeat not received");
  });
});

describe("sslExpiryAlert", () => {
  const cert = { validTo: new Date("2030-01-01T00:00:00Z"), issuer: "Let's Encrypt" };

  test("describes days remaining and the issuer", () => {
    const alert = sslExpiryAlert({ name: "Site", url: "https://site.dev" }, cert, 7);
    expect(alert.subject).toContain("expires in 7 day(s)");
    expect(alert.message).toContain("Issuer: Let's Encrypt");
  });

  test("handles already-expired certificates", () => {
    expect(sslExpiryAlert({ url: "https://site.dev" }, cert, -3).subject).toContain(
      "expired 3 day(s) ago"
    );
  });
});
