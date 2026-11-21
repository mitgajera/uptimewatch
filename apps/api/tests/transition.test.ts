import { describe, expect, test } from "bun:test";
import { evaluateTransition } from "../monitor/transition";

const up = { status: "UP" as const, latency: 10, statusCode: 200 };
const down = { status: "DOWN" as const, latency: 10, statusCode: 503 };

describe("evaluateTransition", () => {
  test("opens an incident when an UP monitor fails", () => {
    expect(evaluateTransition({ isDown: false }, down)).toBe("WENT_DOWN");
  });

  test("recovers when a DOWN monitor succeeds", () => {
    expect(evaluateTransition({ isDown: true }, up)).toBe("RECOVERED");
  });

  test("does nothing when the state is unchanged", () => {
    expect(evaluateTransition({ isDown: false }, up)).toBeNull();
    expect(evaluateTransition({ isDown: true }, down)).toBeNull();
  });
});
