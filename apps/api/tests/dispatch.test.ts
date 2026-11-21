import { describe, expect, mock, test } from "bun:test";
import {
  deliverToTargets,
  MAX_DELIVERY_ATTEMPTS,
  resolveTargets,
  RETRY_BACKOFF_MS,
  targetKey,
} from "../notify/dispatch";

const alert = { kind: "DOWN", subject: "s", message: "m" };
const slack = { type: "slack" as const, target: "https://hooks.slack.com/services/a" };
const email = { type: "email" as const, target: "ops@acme.dev" };
const NOW = 1_700_000_000_000;

describe("resolveTargets", () => {
  test("uses enabled channels when any are configured", () => {
    expect(resolveTargets([slack, { ...email, enabled: false }], "me@acme.dev")).toEqual([slack]);
  });

  test("falls back to the account email only when no channels exist", () => {
    expect(resolveTargets([], "me@acme.dev")).toEqual([{ type: "email", target: "me@acme.dev" }]);
  });

  test("disabling every channel mutes alerts instead of falling back", () => {
    expect(resolveTargets([{ ...slack, enabled: false }], "me@acme.dev")).toEqual([]);
  });

  test("returns nothing without channels or email", () => {
    expect(resolveTargets([], null)).toEqual([]);
  });
});

describe("deliverToTargets", () => {
  test("is sent when every channel succeeds", async () => {
    const deliver = mock(async () => ({ ok: true }));
    expect(await deliverToTargets(alert, [slack, email], {}, deliver, NOW)).toEqual({
      sent: true,
      attempts: 1,
      lastError: null,
      deliveredTo: [targetKey(slack), targetKey(email)],
      nextAttemptAt: null,
    });
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  test("retries only the channel that failed, with backoff", async () => {
    const deliver = mock(async (t: { type: string }) =>
      t.type === "slack" ? { ok: false, error: "HTTP 503" } : { ok: true }
    );
    const first = await deliverToTargets(alert, [slack, email], {}, deliver, NOW);
    expect(first).toEqual({
      sent: false,
      attempts: 1,
      lastError: "slack: HTTP 503",
      deliveredTo: [targetKey(email)],
      nextAttemptAt: new Date(NOW + RETRY_BACKOFF_MS[0]!),
    });

    deliver.mockClear();
    const second = await deliverToTargets(alert, [slack, email], first, async () => ({ ok: true }), NOW);
    expect(second).toMatchObject({ sent: true, attempts: 2, lastError: null });
    expect(second.deliveredTo).toEqual([targetKey(email), targetKey(slack)]);
  });

  test("backs off further on each failure, then gives up", async () => {
    const deliver = mock(async () => ({ ok: false, error: "down" }));
    const third = await deliverToTargets(alert, [slack], { attempts: 2 }, deliver, NOW);
    expect(third).toMatchObject({ sent: false, attempts: 3, lastError: "slack: down" });
    expect(third.nextAttemptAt).toEqual(new Date(NOW + RETRY_BACKOFF_MS[2]!));

    const last = await deliverToTargets(alert, [slack], { attempts: MAX_DELIVERY_ATTEMPTS - 1 }, deliver, NOW);
    expect(last).toMatchObject({ sent: true, attempts: MAX_DELIVERY_ATTEMPTS, nextAttemptAt: null });
  });

  test("never stores raw target URLs", () => {
    expect(targetKey(slack)).toMatch(/^[0-9a-f]{16}$/);
    expect(targetKey(slack)).not.toBe(targetKey(email));
  });

  test("drops notifications with nowhere to go", async () => {
    const outcome = await deliverToTargets(alert, [], {}, mock(async () => ({ ok: true })), NOW);
    expect(outcome.sent).toBe(true);
    expect(outcome.lastError).toContain("No enabled alert channels");
  });
});
