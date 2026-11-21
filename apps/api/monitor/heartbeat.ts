import { randomBytes } from "node:crypto";
import { MONITOR_DEFAULTS } from "db/constants";
import { formatDuration } from "./messages";
import type { CheckResult } from "./httpCheck";

export interface HeartbeatState {
  intervalSeconds?: number;
  graceSeconds?: number;
  lastHeartbeatAt?: Date | string | null;
  maintenanceUntil?: Date | string | null;
  createdAt?: Date | string;
}

/** Unguessable ping token (URL-safe, 160 bits). */
export function generateHeartbeatToken(): string {
  return randomBytes(20).toString("base64url");
}

/**
 * When the next ping must arrive by. Counts from the last ping (or creation),
 * or from the end of a maintenance window so jobs paused for it aren't late.
 */
export function heartbeatDeadline(state: HeartbeatState): number {
  const base = Math.max(
    new Date(state.lastHeartbeatAt ?? state.createdAt ?? 0).getTime(),
    state.maintenanceUntil ? new Date(state.maintenanceUntil).getTime() : 0
  );
  const interval = state.intervalSeconds ?? MONITOR_DEFAULTS.intervalSeconds;
  const grace = state.graceSeconds ?? MONITOR_DEFAULTS.graceSeconds;
  return base + (interval + grace) * 1000;
}

/**
 * A heartbeat "check": UP while pings are on time, DOWN (MISSED) once the
 * deadline passes. Shaped like an HTTP check result so the same incident and
 * alert pipeline handles both.
 */
export function evaluateHeartbeat(state: HeartbeatState, now: number): CheckResult {
  const overdueMs = now - heartbeatDeadline(state);
  if (overdueMs <= 0) {
    return { status: "UP", latency: 0, statusCode: null, errorType: null, errorMessage: null };
  }
  return {
    status: "DOWN",
    latency: 0,
    statusCode: null,
    errorType: "MISSED",
    errorMessage: state.lastHeartbeatAt
      ? `No ping for ${formatDuration(now - new Date(state.lastHeartbeatAt).getTime())}`
      : "No ping received yet",
  };
}
