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

describe("resolveTargets per-monitor routing", () => {
  const a = { id: "c1", type: "slack" as const, target: "https://hooks.slack.com/services/a", enabled: true };
  const b = { id: "c2", type: "email" as const, target: "ops@acme.dev", enabled: true };
  const c = { id: "c3", type: "telegram" as const, target: "1:tok", chatId: "-1", enabled: false };

  test("an empty route list means every enabled channel", () => {
    expect(resolveTargets([a, b, c], "me@acme.dev", [])).toEqual([
      { type: "slack", target: a.target },
      { type: "email", target: b.target },
    ]);
  });

  test("only routed, enabled channels receive the alert", () => {
    expect(resolveTargets([a, b, c], "me@acme.dev", ["c2"])).toEqual([{ type: "email", target: b.target }]);
    // A routed but disabled channel mutes the monitor rather than widening delivery.
    expect(resolveTargets([a, b, c], "me@acme.dev", ["c3"])).toEqual([]);
  });

  test("routes to deleted channels fall back to every enabled channel", () => {
    expect(resolveTargets([a, b], "me@acme.dev", ["gone"])).toHaveLength(2);
  });

  test("the account email fallback still applies when the user has no channels", () => {
    expect(resolveTargets([], "me@acme.dev", ["c1"])).toEqual([{ type: "email", target: "me@acme.dev" }]);
  });

  test("telegram chat ids are carried and part of the target key", () => {
    const tg = { id: "t", type: "telegram" as const, target: "1:tok", chatId: "-1", enabled: true };
    expect(resolveTargets([tg], null)).toEqual([{ type: "telegram", target: "1:tok", chatId: "-1" }]);
    expect(targetKey({ type: "telegram", target: "1:tok", chatId: "-1" })).not.toBe(
      targetKey({ type: "telegram", target: "1:tok", chatId: "-2" })
    );
  });
});
