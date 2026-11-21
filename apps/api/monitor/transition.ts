import type { CheckResult } from "./httpCheck";

export interface MonitorState {
  isDown: boolean;
}

export type TransitionEvent = "WENT_DOWN" | "RECOVERED" | null;

/**
 * Decide whether a check result changes a monitor's UP/DOWN state.
 * Pure so it can be unit-tested independently of the database.
 */
export function evaluateTransition(state: MonitorState, result: CheckResult): TransitionEvent {
  if (result.status === "DOWN" && !state.isDown) return "WENT_DOWN";
  if (result.status === "UP" && state.isDown) return "RECOVERED";
  return null;
}
