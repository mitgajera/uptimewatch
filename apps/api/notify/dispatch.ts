import { createHash } from "node:crypto";
import type { AlertPayload, ChannelTarget } from "./channels";

/** Waits before each retry; the alert is abandoned once these run out. */
export const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 2 * 60 * 60_000];
export const MAX_DELIVERY_ATTEMPTS = RETRY_BACKOFF_MS.length + 1;

/**
 * Resolve where an alert goes: the user's enabled channels, or — when they
 * have configured none at all — their account email, so alerts work out of
 * the box. Disabling every channel mutes alerts rather than falling back.
 *
 * When the alert's monitor routes to specific channels (`monitorChannelIds`),
 * only those that are enabled receive it. Ids of since-deleted channels are
 * ignored; if none of the routed channels exist any more, all enabled
 * channels are used.
 */
export function resolveTargets(
  channels: (ChannelTarget & { enabled?: boolean; id?: string })[],
  accountEmail: string | null | undefined,
  monitorChannelIds: string[] = []
): ChannelTarget[] {
  if (channels.length > 0) {
    const routed = new Set(monitorChannelIds.map(String));
    const existing = channels.filter((c) => c.id !== undefined && routed.has(String(c.id)));
    const pool = existing.length > 0 ? existing : channels;
    return pool
      .filter((c) => c.enabled !== false)
      .map(({ type, target, chatId }) => (chatId ? { type, target, chatId } : { type, target }));
  }
  return accountEmail ? [{ type: "email", target: accountEmail }] : [];
}

/** Stable id for a target that doesn't store its (possibly secret) URL. */
export function targetKey(target: ChannelTarget): string {
  const key = `${target.type}:${target.target}${target.chatId ? `:${target.chatId}` : ""}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export interface DeliveryState {
  attempts?: number;
  deliveredTo?: string[];
}

export interface DeliveryOutcome {
  /** Whether to stop retrying this notification. */
  sent: boolean;
  attempts: number;
  lastError: string | null;
  deliveredTo: string[];
  nextAttemptAt: Date | null;
}

/**
 * Send one notification to every target that hasn't accepted it yet. Targets
 * that succeed are remembered and never re-sent; the rest are retried with
 * backoff (about 3.5h in total) before the alert is abandoned.
 */
export async function deliverToTargets(
  alert: AlertPayload,
  targets: ChannelTarget[],
  previous: DeliveryState,
  deliver: (target: ChannelTarget, alert: AlertPayload) => Promise<{ ok: boolean; error?: string }>,
  now = Date.now()
): Promise<DeliveryOutcome> {
  const attempts = (previous.attempts ?? 0) + 1;
  const deliveredTo = [...(previous.deliveredTo ?? [])];
  if (targets.length === 0) {
    return {
      sent: true,
      attempts,
      lastError: "No enabled alert channels or account email.",
      deliveredTo,
      nextAttemptAt: null,
    };
  }

  const pending = targets.filter((t) => !deliveredTo.includes(targetKey(t)));
  const results = await Promise.all(pending.map((t) => deliver(t, alert)));
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.ok) deliveredTo.push(targetKey(pending[i]!));
    else errors.push(`${pending[i]!.type}: ${r.error ?? "failed"}`);
  });

  const sent = errors.length === 0 || attempts >= MAX_DELIVERY_ATTEMPTS;
  return {
    sent,
    attempts,
    lastError: errors.length ? errors.join("; ").slice(0, 1000) : null,
    deliveredTo,
    nextAttemptAt: sent ? null : new Date(now + RETRY_BACKOFF_MS[attempts - 1]!),
  };
}
