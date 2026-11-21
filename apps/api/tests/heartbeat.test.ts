import { describe, expect, test } from "bun:test";
import { evaluateHeartbeat, generateHeartbeatToken, heartbeatDeadline, isHeartbeatDue } from "../monitor/heartbeat";

const T0 = Date.UTC(2024, 0, 1, 12);

describe("heartbeatDeadline", () => {
  test("is the last ping plus period plus grace", () => {
    expect(
      heartbeatDeadline({ lastHeartbeatAt: new Date(T0), intervalSeconds: 3600, graceSeconds: 300 })
    ).toBe(T0 + 3900 * 1000);
  });

  test("restarts the clock at the end of a maintenance window", () => {
    expect(
      heartbeatDeadline({
        lastHeartbeatAt: new Date(T0),
        maintenanceUntil: new Date(T0 + 10 * 3600_000),
        intervalSeconds: 3600,
        graceSeconds: 0,
      })
    ).toBe(T0 + 11 * 3600_000);
  });

  test("counts from creation before the first ping", () => {
    expect(heartbeatDeadline({ createdAt: new Date(T0), intervalSeconds: 60, graceSeconds: 0 })).toBe(
      T0 + 60_000
    );
  });
});

describe("evaluateHeartbeat", () => {
  const state = { lastHeartbeatAt: new Date(T0), intervalSeconds: 3600, graceSeconds: 300 };

  test("UP while within the period and grace", () => {
    expect(evaluateHeartbeat(state, T0 + 3899_000).status).toBe("UP");
  });

  test("DOWN with MISSED once overdue", () => {
    const result = evaluateHeartbeat(state, T0 + 2 * 3600_000);
    expect(result).toMatchObject({ status: "DOWN", errorType: "MISSED" });
    expect(result.errorMessage).toBe("No ping for 2h 0m");
  });

  test("explains when no ping ever arrived", () => {
    const result = evaluateHeartbeat({ createdAt: new Date(T0), intervalSeconds: 60, graceSeconds: 0 }, T0 + 120_000);
    expect(result.errorMessage).toBe("No ping received yet");
  });
});

describe("generateHeartbeatToken", () => {
  test("is URL-safe and unique", () => {
    const a = generateHeartbeatToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{27}$/);
    expect(generateHeartbeatToken()).not.toBe(a);
  });
});

describe("isHeartbeatDue", () => {
  const MIN = 60_000;
  const now = Date.parse("2026-01-02T00:00:00Z");
  // Daily heartbeat, 5 min grace, last checked 2 min ago.
  const daily = (over: Record<string, unknown> = {}) => ({
    intervalSeconds: 86_400,
    graceSeconds: 300,
    lastCheckedAt: new Date(now - 2 * MIN),
    ...over,
  });

  test("is due as soon as an up monitor's deadline passes, not a whole interval later", () => {
    expect(isHeartbeatDue(daily({ lastHeartbeatAt: new Date(now - 86_400_000 - 6 * MIN) }), now)).toBe(true);
  });

  test("waits for the interval while pings are on time", () => {
    expect(isHeartbeatDue(daily({ lastHeartbeatAt: new Date(now - 60 * MIN) }), now)).toBe(false);
  });

  test("does not re-evaluate an already-down monitor every minute", () => {
    expect(isHeartbeatDue(daily({ isDown: true, lastHeartbeatAt: new Date(0) }), now)).toBe(false);
  });

  test("respects pause and maintenance", () => {
    const late = { lastHeartbeatAt: new Date(0) };
    expect(isHeartbeatDue(daily({ ...late, paused: true }), now)).toBe(false);
    expect(isHeartbeatDue(daily({ ...late, maintenanceUntil: new Date(now + MIN) }), now)).toBe(false);
  });
});
