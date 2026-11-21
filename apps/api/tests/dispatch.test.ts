import { describe, expect, mock, test } from "bun:test";
import { deliverToTargets, MAX_DELIVERY_ATTEMPTS, resolveTargets } from "../notify/dispatch";

const alert = { kind: "DOWN", subject: "s", message: "m" };
const slack = { type: "slack" as const, target: "https://hooks.slack.com/services/a" };
const email = { type: "email" as const, target: "ops@acme.dev" };

describe("resolveTargets", () => {
  test("uses configured channels when present", () => {
    expect(resolveTargets([slack], "me@acme.dev")).toEqual([slack]);
  });

  test("falls back to the account email", () => {
    expect(resolveTargets([], "me@acme.dev")).toEqual([{ type: "email", target: "me@acme.dev" }]);
  });

  test("returns nothing without channels or email", () => {
    expect(resolveTargets([], null)).toEqual([]);
  });
});

describe("deliverToTargets", () => {
  test("is sent when every channel succeeds", async () => {
    const deliver = mock(async () => ({ ok: true }));
    expect(await deliverToTargets(alert, [slack, email], 0, deliver)).toEqual({
      sent: true,
      attempts: 1,
      lastError: null,
    });
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  test("is sent (with the error recorded) when at least one channel succeeds", async () => {
    const deliver = mock(async (t: { type: string }) =>
      t.type === "slack" ? { ok: false, error: "HTTP 404" } : { ok: true }
    );
    const outcome = await deliverToTargets(alert, [slack, email], 0, deliver);
    expect(outcome).toEqual({ sent: true, attempts: 1, lastError: "slack: HTTP 404" });
  });

  test("retries when every channel fails, then gives up", async () => {
    const deliver = mock(async () => ({ ok: false, error: "down" }));
    expect((await deliverToTargets(alert, [slack], 0, deliver)).sent).toBe(false);
    expect((await deliverToTargets(alert, [slack], MAX_DELIVERY_ATTEMPTS - 1, deliver)).sent).toBe(
      true
    );
  });

  test("drops notifications with nowhere to go", async () => {
    const outcome = await deliverToTargets(alert, [], 0, mock(async () => ({ ok: true })));
    expect(outcome.sent).toBe(true);
    expect(outcome.lastError).toContain("No alert channels");
  });
});
