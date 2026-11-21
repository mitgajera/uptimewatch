import type { AlertPayload, ChannelTarget } from "./channels";

export const MAX_DELIVERY_ATTEMPTS = 5;

/**
 * Resolve where a user's alerts go: their enabled channels, or — when they
 * have configured none — their account email, so alerts work out of the box.
 */
export function resolveTargets(
  channels: ChannelTarget[],
  accountEmail: string | null | undefined
): ChannelTarget[] {
  if (channels.length > 0) return channels;
  return accountEmail ? [{ type: "email", target: accountEmail }] : [];
}

export interface DeliveryOutcome {
  /** Whether to stop retrying this notification. */
  sent: boolean;
  attempts: number;
  lastError: string | null;
}

/**
 * Send one notification to every target. It counts as delivered once any
 * channel accepts it (retrying would re-spam the channels that succeeded);
 * if all fail it is retried on the next run, up to MAX_DELIVERY_ATTEMPTS.
 */
export async function deliverToTargets(
  alert: AlertPayload,
  targets: ChannelTarget[],
  previousAttempts: number,
  deliver: (target: ChannelTarget, alert: AlertPayload) => Promise<{ ok: boolean; error?: string }>
): Promise<DeliveryOutcome> {
  const attempts = previousAttempts + 1;
  if (targets.length === 0) {
    return { sent: true, attempts, lastError: "No alert channels or account email configured." };
  }

  const results = await Promise.all(targets.map((t) => deliver(t, alert)));
  const errors = results
    .map((r, i) => (r.ok ? null : `${targets[i]!.type}: ${r.error ?? "failed"}`))
    .filter((e): e is string => e !== null);

  const anyOk = results.some((r) => r.ok);
  return {
    sent: anyOk || attempts >= MAX_DELIVERY_ATTEMPTS,
    attempts,
    lastError: errors.length ? errors.join("; ").slice(0, 1000) : null,
  };
}
