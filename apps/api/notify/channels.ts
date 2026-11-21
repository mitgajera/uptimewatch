import axios from "axios";
import type { AlertChannelType } from "db/constants";
import { sendEmail } from "../lib/email";
import { assertSafeUrl, pinSafeUrl } from "../utils/ssrf";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLACK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;
const DISCORD_RE = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;
const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Validate a channel target for its type. Returns an error message, or null
 * when valid. Webhook targets are additionally SSRF-checked at send time.
 */
export function validateChannelTarget(type: AlertChannelType, target: string): string | null {
  switch (type) {
    case "email":
      return EMAIL_RE.test(target) ? null : "Enter a valid email address.";
    case "slack":
      return SLACK_RE.test(target)
        ? null
        : "Slack webhooks look like https://hooks.slack.com/services/…";
    case "discord":
      return DISCORD_RE.test(target)
        ? null
        : "Discord webhooks look like https://discord.com/api/webhooks/…";
    case "webhook":
      try {
        const url = new URL(target);
        return /^https?:$/.test(url.protocol) ? null : "Webhook URL must be http or https.";
      } catch {
        return "Enter a valid webhook URL.";
      }
  }
}

export interface ChannelTarget {
  type: AlertChannelType;
  target: string;
}

export interface AlertPayload {
  kind: string | null | undefined;
  subject: string;
  message: string;
  websiteId?: string | null;
  createdAt?: Date;
}

export interface DeliveryDeps {
  post: (url: string, body: unknown) => Promise<unknown>;
  sendEmail: typeof sendEmail;
  assertSafeUrl: typeof assertSafeUrl;
  /** Deadline for providers without their own timeout (email). */
  timeoutMs?: number;
}

const defaultDeps: DeliveryDeps = {
  post: async (url, body) => {
    // Connect to the vetted address so DNS can't rebind between check and POST.
    const target = await pinSafeUrl(url);
    return axios.post(target.url, body, {
      timeout: DELIVERY_TIMEOUT_MS,
      // Never follow redirects from user-supplied endpoints (SSRF).
      maxRedirects: 0,
      headers: { "User-Agent": "UptimeWatch-Alerts/1.0", ...target.headers },
    });
  },
  sendEmail,
  assertSafeUrl,
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Deliver one alert to one channel. Never throws. */
export async function deliver(
  channel: ChannelTarget,
  alert: AlertPayload,
  deps: DeliveryDeps = defaultDeps
): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (channel.type) {
      case "email": {
        // Same deadline as webhooks, so a stalled provider can't block the batch.
        const result = await withTimeout(
          deps.sendEmail({ to: channel.target, subject: alert.subject, text: alert.message }),
          deps.timeoutMs ?? DELIVERY_TIMEOUT_MS
        );
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      }
      case "slack":
        await deps.post(channel.target, { text: `*${alert.subject}*\n${alert.message}` });
        return { ok: true };
      case "discord":
        await deps.post(channel.target, {
          content: `**${alert.subject}**\n${alert.message}`.slice(0, 2000),
        });
        return { ok: true };
      case "webhook":
        await deps.assertSafeUrl(channel.target);
        await deps.post(channel.target, {
          event: alert.kind ?? "ALERT",
          subject: alert.subject,
          message: alert.message,
          websiteId: alert.websiteId ?? null,
          timestamp: (alert.createdAt ?? new Date()).toISOString(),
        });
        return { ok: true };
    }
  } catch (err) {
    const e = err as { message?: string; response?: { status?: number } };
    const status = e?.response?.status;
    return { ok: false, error: status ? `HTTP ${status}` : e?.message || String(err) };
  }
}
