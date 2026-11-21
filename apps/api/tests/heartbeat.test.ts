import { describe, expect, test } from "bun:test";
import { evaluateHeartbeat, generateHeartbeatToken, heartbeatDeadline } from "../monitor/heartbeat";

const T0 = Date.UTC(2024, 0, 1, 12);

describe("heartbeatDeadline", () => {
  test("is the last ping plus period plus grace", () => {
    expect(
      heartbeatDeadline({ lastHeartbeatAt: new Date(T0), intervalSeconds: 3600, graceSeconds: 300 })
    ).toBe(T0 + 3900 * 1000);
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
