import type { AlertChannel, AlertChannelType } from "@/lib/api/types";

/** Max channels per account (enforced by the API with a 403). */
export const MAX_CHANNELS = 10;

export interface IntegrationMeta {
  type: AlertChannelType;
  label: string;
  /** One line for the catalog card. */
  blurb: string;
  targetLabel: string;
  placeholder: string;
  inputType: "email" | "url" | "text";
  /** Ordered "how to get this" steps. */
  steps: string[];
  /** Validates the target; returns an error message or null. */
  validateTarget: (value: string) => string | null;
  /** Token classes for the icon tile. */
  tone: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLACK_RE = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;
const DISCORD_RE = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;
const TELEGRAM_TOKEN_RE = /^\d+:[A-Za-z0-9_-]{30,}$/;
const TELEGRAM_CHAT_RE = /^-?\d+$|^@[A-Za-z0-9_]{5,}$/;

function parseHttps(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

const httpsUrl = (what: string) => (value: string) =>
  parseHttps(value) ? null : `Enter a valid ${what} that starts with https://`;

export function validateTelegramChatId(value: string): string | null {
  if (!value.trim()) return "Enter the chat id.";
  return TELEGRAM_CHAT_RE.test(value.trim())
    ? null
    : "Use a numeric id like -1001234567890 or a public @channelname.";
}

export const INTEGRATIONS: Record<AlertChannelType, IntegrationMeta> = {
  email: {
    type: "email",
    label: "Email",
    blurb: "Send alerts to a team inbox or on-call list.",
    targetLabel: "Email address",
    placeholder: "oncall@acme.dev",
    inputType: "email",
    steps: ["Use a shared list so alerts reach whoever is on call.", "Your account email already gets alerts when no channels exist."],
    validateTarget: (v) => (EMAIL_RE.test(v) ? null : "Enter a valid email address."),
    tone: "bg-info/10 text-info ring-info/20",
  },
  slack: {
    type: "slack",
    label: "Slack",
    blurb: "Post incidents to a channel with an incoming webhook.",
    targetLabel: "Incoming webhook URL",
    placeholder: "https://hooks.slack.com/services/T000/B000/XXXX",
    inputType: "url",
    steps: [
      "In Slack, open Apps and add Incoming Webhooks.",
      "Pick the channel that should receive alerts.",
      "Copy the webhook URL and paste it here.",
    ],
    validateTarget: (v) =>
      SLACK_RE.test(v) ? null : "Slack webhooks look like https://hooks.slack.com/services/…",
    tone: "bg-warning/10 text-warning ring-warning/20",
  },
  discord: {
    type: "discord",
    label: "Discord",
    blurb: "Drop alerts into a server channel via webhook.",
    targetLabel: "Webhook URL",
    placeholder: "https://discord.com/api/webhooks/123/abc",
    inputType: "url",
    steps: [
      "Open the channel settings and go to Integrations.",
      "Choose Webhooks, then New Webhook.",
      "Copy the webhook URL and paste it here.",
    ],
    validateTarget: (v) =>
      DISCORD_RE.test(v) ? null : "Discord webhooks look like https://discord.com/api/webhooks/…",
    tone: "bg-chart-5/10 text-foreground ring-border",
  },
  teams: {
    type: "teams",
    label: "Microsoft Teams",
    blurb: "Notify a Teams channel through a workflow webhook.",
    targetLabel: "Webhook URL",
    placeholder: "https://acme.webhook.office.com/webhookb2/…",
    inputType: "url",
    steps: [
      "In the channel, open Workflows (or Connectors).",
      "Create a “Post to a channel when a webhook request is received” flow.",
      "Copy the generated URL and paste it here.",
    ],
    validateTarget: (v) => {
      const url = parseHttps(v);
      const host = url?.hostname ?? "";
      return url && (host.endsWith(".webhook.office.com") || host.endsWith(".logic.azure.com"))
        ? null
        : "Teams webhooks end in .webhook.office.com or .logic.azure.com.";
    },
    tone: "bg-info/10 text-info ring-info/20",
  },
  googlechat: {
    type: "googlechat",
    label: "Google Chat",
    blurb: "Send alerts to a Google Chat space.",
    targetLabel: "Webhook URL",
    placeholder: "https://chat.googleapis.com/v1/spaces/AAAA/messages?key=…",
    inputType: "url",
    steps: [
      "Open the space, then Apps & integrations.",
      "Choose Webhooks and add one named UptimeWatch.",
      "Copy the URL and paste it here.",
    ],
    validateTarget: (v) =>
      parseHttps(v) && v.startsWith("https://chat.googleapis.com/v1/spaces/")
        ? null
        : "Google Chat webhooks start with https://chat.googleapis.com/v1/spaces/",
    tone: "bg-success/10 text-success ring-success/20",
  },
  telegram: {
    type: "telegram",
    label: "Telegram",
    blurb: "Message a chat, group or channel from your bot.",
    targetLabel: "Bot token",
    placeholder: "123456789:AAH…",
    inputType: "text",
    steps: [
      "Message @BotFather, send /newbot and copy the token.",
      "Add the bot to your group or channel.",
      "Use the numeric chat id, or @channelname for public channels.",
    ],
    validateTarget: (v) =>
      TELEGRAM_TOKEN_RE.test(v) ? null : "Bot tokens look like 123456789:AAH… (digits, colon, 30+ characters).",
    tone: "bg-info/10 text-info ring-info/20",
  },
  ntfy: {
    type: "ntfy",
    label: "ntfy",
    blurb: "Push notifications to your phone via an ntfy topic.",
    targetLabel: "Topic URL",
    placeholder: "https://ntfy.sh/acme-uptime-alerts",
    inputType: "url",
    steps: [
      "Pick a hard-to-guess topic name (anyone with it can read).",
      "Subscribe to it in the ntfy app.",
      "Paste the full topic URL, including a self-hosted server.",
    ],
    validateTarget: httpsUrl("topic URL"),
    tone: "bg-brand/10 text-brand ring-brand/20",
  },
  webhook: {
    type: "webhook",
    label: "Webhook",
    blurb: "POST JSON to your own endpoint or automation.",
    targetLabel: "Endpoint URL",
    placeholder: "https://api.acme.dev/hooks/uptime",
    inputType: "url",
    steps: ["We send a POST with a JSON body for every alert.", "Respond with any 2xx status within 10 seconds."],
    validateTarget: httpsUrl("endpoint URL"),
    tone: "bg-muted text-foreground ring-border",
  },
};

export const INTEGRATION_ORDER: AlertChannelType[] = [
  "email",
  "slack",
  "discord",
  "teams",
  "googlechat",
  "telegram",
  "ntfy",
  "webhook",
];

/** Short, non-secret rendering of a channel's destination. */
export function maskTarget(channel: Pick<AlertChannel, "type" | "target" | "chatId">): string {
  const { type, target } = channel;
  if (type === "email") return target;
  if (type === "telegram") return channel.chatId ? `${target} → ${channel.chatId}` : target;
  try {
    const url = new URL(target);
    const path = url.pathname.replace(/\/+$/, "");
    if (type === "ntfy") return `${url.host}${path}`;
    const tail = path.slice(-4);
    return path.length > 1 ? `${url.host}/…${tail}` : url.host;
  } catch {
    return target;
  }
}

export const WEBHOOK_EXAMPLE = `{
  "event": "DOWN",
  "subject": "api.acme.dev is down",
  "message": "HTTP 503 from https://api.acme.dev/health",
  "websiteId": "665f1c2e8a4b2d0012ab34cd",
  "timestamp": "2026-11-22T09:41:07.000Z"
}`;
