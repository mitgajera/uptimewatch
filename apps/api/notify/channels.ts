import axios from "axios";
import type { AlertChannelType } from "db/constants";
import { sendEmail } from "../lib/email";
import { assertSafeUrl, pinSafeUrl } from "../utils/ssrf";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLACK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;
const DISCORD_RE = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;
const TELEGRAM_TOKEN_RE = /^\d+:[A-Za-z0-9_-]{30,}$/;
const TELEGRAM_CHAT_RE = /^(?:-?\d+|@[A-Za-z0-9_]{5,})$/;
const DELIVERY_TIMEOUT_MS = 10_000;

/** Parse an https URL, or null. */
function httpsUrl(target: string): URL | null {
  try {
    const url = new URL(target);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const hostIsUnder = (url: URL, suffix: string) => url.hostname.toLowerCase().endsWith(suffix);

/** Show only the bot id and the token's last 4 characters: "123456:…abcd". */
export function maskTelegramToken(token: string): string {
  const [id] = token.split(":");
  return `${id}:…${token.slice(-4)}`;
}

/**
 * Validate a channel target for its type. Returns an error message, or null
 * when valid. Webhook targets are additionally SSRF-checked at send time.
 */
export function validateChannelTarget(
  type: AlertChannelType,
  target: string,
  chatId?: string | null
): string | null {
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
    case "telegram":
      if (!TELEGRAM_TOKEN_RE.test(target)) return "Telegram bot tokens look like 123456:ABC-DEF…";
      if (!chatId) return "Telegram channels need a chat id.";
      return TELEGRAM_CHAT_RE.test(chatId) ? null : "Use a numeric chat id or @channelname.";
    case "teams": {
      const url = httpsUrl(target);
      return url && (hostIsUnder(url, ".webhook.office.com") || hostIsUnder(url, ".logic.azure.com"))
        ? null
        : "Teams webhooks look like https://…webhook.office.com/… or https://…logic.azure.com/…";
    }
    case "googlechat": {
      const url = httpsUrl(target);
      return url && url.hostname.toLowerCase() === "chat.googleapis.com" && url.pathname.startsWith("/v1/spaces/")
        ? null
        : "Google Chat webhooks look like https://chat.googleapis.com/v1/spaces/…";
    }
    case "ntfy": {
      const url = httpsUrl(target);
      return url && ntfyTopic(url)
        ? null
        : "ntfy topics look like https://ntfy.sh/your-topic";
    }
  }
}

/** The topic of an ntfy topic URL (its last path segment). */
function ntfyTopic(url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean);
  const topic = segments[segments.length - 1];
  return topic && /^[A-Za-z0-9_-]{1,64}$/.test(topic) ? topic : null;
}

export interface ChannelTarget {
  type: AlertChannelType;
  target: string;
  /** Telegram only. */
  chatId?: string | null;
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
      case "telegram":
        await deps.post(`https://api.telegram.org/bot${channel.target}/sendMessage`, {
          chat_id: channel.chatId,
          text: `${alert.subject}\n\n${alert.message}`.slice(0, 4096),
          disable_web_page_preview: true,
        });
        return { ok: true };
      case "teams":
        await deps.post(channel.target, {
          type: "message",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                version: "1.4",
                body: [
                  { type: "TextBlock", text: alert.subject, weight: "Bolder", size: "Medium", wrap: true },
                  { type: "TextBlock", text: alert.message, wrap: true },
                ],
              },
            },
          ],
        });
        return { ok: true };
      case "googlechat":
        await deps.post(channel.target, { text: `*${alert.subject}*\n${alert.message}`.slice(0, 4000) });
        return { ok: true };
      case "ntfy": {
        // JSON publishing goes to the server root with the topic in the body.
        await deps.assertSafeUrl(channel.target);
        const url = new URL(channel.target);
        const topic = ntfyTopic(url);
        if (!topic) return { ok: false, error: "Invalid ntfy topic URL" };
        const segments = url.pathname.split("/").filter(Boolean);
        const base = `${url.origin}/${segments.slice(0, -1).map((s) => s + "/").join("")}`;
        await deps.post(base, {
          topic,
          title: alert.subject,
          message: alert.message,
          priority: alert.kind === "DOWN" || alert.kind === "REMINDER" ? 4 : 3,
          tags: [alert.kind === "UP" ? "white_check_mark" : alert.kind === "TEST" ? "test_tube" : "warning"],
        });
        return { ok: true };
      }
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
    const error = status ? `HTTP ${status}` : e?.message || String(err);
    // Never leak a bot token through a logged/stored error.
    return { ok: false, error: channel.type === "telegram" ? error.split(channel.target).join("***") : error };
  }
}
