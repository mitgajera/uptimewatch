import { describe, expect, test } from "bun:test";
import { createMonitorSchema, updateMonitorSchema } from "../validation";

describe("monitor validation", () => {
  test("requires a url on create and accepts optional config", () => {
    expect(createMonitorSchema.safeParse({}).success).toBe(false);
    const ok = createMonitorSchema.safeParse({
      url: " https://x.dev ",
      intervalSeconds: 300,
      expectedStatus: "200-299,401",
      failureThreshold: 3,
    });
    expect(ok.success).toBe(true);
    expect(ok.data?.url).toBe("https://x.dev");
  });

  test("rejects unsupported intervals, bad status specs and unknown fields", () => {
    expect(updateMonitorSchema.safeParse({ intervalSeconds: 61 }).success).toBe(false);
    expect(updateMonitorSchema.safeParse({ expectedStatus: "2xx" }).success).toBe(false);
    expect(updateMonitorSchema.safeParse({ failureThreshold: 0 }).success).toBe(false);
    expect(updateMonitorSchema.safeParse({ userId: "someone-else" }).success).toBe(false);
  });

  test("accepts maintenance windows up to 7 days, or null to end one", () => {
    const inOneHour = new Date(Date.now() + 3600_000).toISOString();
    const inTenDays = new Date(Date.now() + 10 * 86400_000).toISOString();
    expect(updateMonitorSchema.safeParse({ maintenanceUntil: inOneHour }).success).toBe(true);
    expect(updateMonitorSchema.safeParse({ maintenanceUntil: null }).success).toBe(true);
    expect(updateMonitorSchema.safeParse({ maintenanceUntil: inTenDays }).success).toBe(false);
    expect(updateMonitorSchema.safeParse({ maintenanceUntil: "tomorrow" }).success).toBe(false);
  });

  test("allows partial updates", () => {
    expect(updateMonitorSchema.safeParse({ paused: true }).success).toBe(true);
  });
});
