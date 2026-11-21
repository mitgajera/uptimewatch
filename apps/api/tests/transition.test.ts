import { describe, expect, test } from "bun:test";
import { evaluateTransition } from "../monitor/transition";

const up = { status: "UP" as const };
const down = { status: "DOWN" as const };

describe("evaluateTransition", () => {
  test("waits for the failure threshold before going DOWN", () => {
    const first = evaluateTransition({ isDown: false, failureThreshold: 3 }, down);
    expect(first).toEqual({ event: null, consecutiveFailures: 1, isDown: false });

    const second = evaluateTransition(
      { isDown: false, failureThreshold: 3, consecutiveFailures: 1 },
      down
    );
    expect(second).toEqual({ event: null, consecutiveFailures: 2, isDown: false });

    const third = evaluateTransition(
      { isDown: false, failureThreshold: 3, consecutiveFailures: 2 },
      down
    );
    expect(third).toEqual({ event: "WENT_DOWN", consecutiveFailures: 3, isDown: true });
  });

  test("goes DOWN immediately with a threshold of 1", () => {
    expect(evaluateTransition({ isDown: false, failureThreshold: 1 }, down).event).toBe(
      "WENT_DOWN"
    );
  });

  test("defaults to a threshold of 2 for legacy monitors", () => {
    expect(evaluateTransition({ isDown: false }, down).event).toBeNull();
    expect(evaluateTransition({ isDown: false, consecutiveFailures: 1 }, down).event).toBe(
      "WENT_DOWN"
    );
  });

  test("a success resets the streak without an event while UP", () => {
    expect(evaluateTransition({ isDown: false, consecutiveFailures: 1 }, up)).toEqual({
      event: null,
      consecutiveFailures: 0,
      isDown: false,
    });
  });

  test("recovers when a DOWN monitor succeeds", () => {
    expect(evaluateTransition({ isDown: true, consecutiveFailures: 5 }, up)).toEqual({
      event: "RECOVERED",
      consecutiveFailures: 0,
      isDown: false,
    });
  });

  test("stays DOWN without re-alerting on further failures", () => {
    expect(
      evaluateTransition({ isDown: true, consecutiveFailures: 4, failureThreshold: 2 }, down)
    ).toEqual({ event: null, consecutiveFailures: 5, isDown: true });
  });
});
