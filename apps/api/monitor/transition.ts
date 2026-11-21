import { MONITOR_DEFAULTS } from "db/constants";
import type { CheckResult } from "./httpCheck";

export interface MonitorState {
  isDown: boolean;
  consecutiveFailures?: number;
  failureThreshold?: number;
}

export type TransitionEvent = "WENT_DOWN" | "RECOVERED" | null;

export interface Transition {
  event: TransitionEvent;
  /** Updated failure streak to persist on the monitor. */
  consecutiveFailures: number;
  /** Monitor's UP/DOWN state after this check. */
  isDown: boolean;
}

/**
 * Decide how a check result changes a monitor's state. A monitor only goes
 * DOWN after `failureThreshold` consecutive failures, so a single blip does
 * not page anyone; any successful check resets the streak.
 *
 * Pure so it can be unit-tested independently of the database.
 */
export function evaluateTransition(
  state: MonitorState,
  result: Pick<CheckResult, "status">
): Transition {
  const threshold = Math.max(1, state.failureThreshold ?? MONITOR_DEFAULTS.failureThreshold);

  if (result.status === "UP") {
    return { event: state.isDown ? "RECOVERED" : null, consecutiveFailures: 0, isDown: false };
  }

  const consecutiveFailures = (state.consecutiveFailures ?? 0) + 1;
  if (!state.isDown && consecutiveFailures >= threshold) {
    return { event: "WENT_DOWN", consecutiveFailures, isDown: true };
  }
  return { event: null, consecutiveFailures, isDown: state.isDown };
}
