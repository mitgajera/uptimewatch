import { describe, expect, mock, test } from "bun:test";
import { deliver, maskTelegramToken, validateChannelTarget, type DeliveryDeps } from "../notify/channels";
import { UnsafeUrlError } from "../utils/ssrf";

const alert = { kind: "DOWN", subject: "🔴 API is DOWN", message: "API is DOWN.", websiteId: "w1" };

function deps(overrides: Partial<DeliveryDeps> = {}): DeliveryDeps {
  return {
    post: mock(async (_url: string, _body: unknown) => ({})),
    sendEmail: mock(async () => ({ ok: true })),
    assertSafeUrl: mock(async () => {}),
    ...overrides,
  };
}

describe("validateChannelTarget", () => {
  test("accepts well-formed targets", () => {
    expect(validateChannelTarget("email", "ops@acme.dev")).toBeNull();
    expect(validateChannelTarget("slack", "https://hooks.slack.com/services/T0/B0/xyz")).toBeNull();
    expect(validateChannelTarget("discord", "https://discord.com/api/webhooks/123/abc_DEF")).toBeNull();
    expect(validateChannelTarget("webhook", "https://example.com/hook")).toBeNull();
  });

  test("rejects mismatched or malformed targets", () => {
    expect(validateChannelTarget("email", "nope")).not.toBeNull();
    expect(validateChannelTarget("slack", "https://evil.dev/services/x")).not.toBeNull();
    expect(validateChannelTarget("discord", "https://discord.com.evil.dev/api/webhooks/1/a")).not.toBeNull();
    expect(validateChannelTarget("webhook", "ftp://example.com")).not.toBeNull();
  });
});

describe("deliver", () => {
  test("emails use the alert subject and body", async () => {
    const d = deps();
    expect(await deliver({ type: "email", target: "ops@acme.dev" }, alert, d)).toEqual({ ok: true });
    expect(d.sendEmail).toHaveBeenCalledWith({
      to: "ops@acme.dev",
      subject: alert.subject,
      text: alert.message,
    });
  });

  test("slack and discord get formatted text", async () => {
    const d = deps();
    await deliver({ type: "slack", target: "https://hooks.slack.com/services/a" }, alert, d);
    await deliver({ type: "discord", target: "https://discord.com/api/webhooks/1/a" }, alert, d);
    const post = d.post as ReturnType<typeof mock>;
    expect(post.mock.calls[0]![1]).toEqual({ text: `*${alert.subject}*\n${alert.message}` });
    expect(post.mock.calls[1]![1]).toEqual({ content: `**${alert.subject}**\n${alert.message}` });
  });

  test("webhooks get a JSON event and are SSRF-checked", async () => {
    const d = deps();
    await deliver({ type: "webhook", target: "https://example.com/hook" }, alert, d);
    expect(d.assertSafeUrl).toHaveBeenCalledWith("https://example.com/hook");
    const body = (d.post as ReturnType<typeof mock>).mock.calls[0]![1] as any;
    expect(body).toMatchObject({ event: "DOWN", subject: alert.subject, websiteId: "w1" });
    expect(typeof body.timestamp).toBe("string");
  });

  test("never posts to webhooks that resolve to private addresses", async () => {
    const d = deps({
      assertSafeUrl: mock(async () => {
        throw new UnsafeUrlError("URL resolves to a private or reserved address");
      }),
    });
    const result = await deliver({ type: "webhook", target: "http://10.0.0.1" }, alert, d);
    expect(result.ok).toBe(false);
    expect(d.post).not.toHaveBeenCalled();
  });

  test("reports HTTP failures without throwing", async () => {
    const d = deps({
      post: mock(async () => {
        throw Object.assign(new Error("bad"), { response: { status: 404 } });
      }),
    });
    expect(await deliver({ type: "slack", target: "https://hooks.slack.com/services/a" }, alert, d)).toEqual({
      ok: false,
      error: "HTTP 404",
    });
  });

  test("times out a stalled email provider instead of hanging", async () => {
    const result = await deliver(
      { type: "email", target: "ops@acme.dev" },
      { kind: "DOWN", subject: "s", message: "m" },
      deps({ sendEmail: mock(() => new Promise<never>(() => {})), timeoutMs: 20 })
    );
    expect(result).toEqual({ ok: false, error: "Timed out after 0.02s" });
  });
});

const TG_TOKEN = "123456789:AAH-abcdefghijklmnopqrstuvwxyz0123";

describe("new channel validators", () => {
  test("telegram needs a bot token and a chat id", () => {
    expect(validateChannelTarget("telegram", TG_TOKEN, "-1001234567")).toBeNull();
    expect(validateChannelTarget("telegram", TG_TOKEN, "@ops_alerts")).toBeNull();
    expect(validateChannelTarget("telegram", TG_TOKEN)).not.toBeNull();
    expect(validateChannelTarget("telegram", TG_TOKEN, "@abc")).not.toBeNull();
    expect(validateChannelTarget("telegram", TG_TOKEN, "12ab")).not.toBeNull();
    expect(validateChannelTarget("telegram", "123:short", "1")).not.toBeNull();
    expect(validateChannelTarget("telegram", "https://api.telegram.org/bot1", "1")).not.toBeNull();
  });

  test("teams accepts office webhooks and Power Automate workflows only", () => {
    expect(validateChannelTarget("teams", "https://acme.webhook.office.com/webhookb2/abc")).toBeNull();
    expect(
      validateChannelTarget("teams", "https://prod-01.westus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke")
    ).toBeNull();
    expect(validateChannelTarget("teams", "http://acme.webhook.office.com/x")).not.toBeNull();
    expect(validateChannelTarget("teams", "https://webhook.office.com.evil.dev/x")).not.toBeNull();
    expect(validateChannelTarget("teams", "https://evil.dev/acme.webhook.office.com")).not.toBeNull();
  });

  test("google chat accepts chat.googleapis.com space webhooks only", () => {
    expect(
      validateChannelTarget("googlechat", "https://chat.googleapis.com/v1/spaces/AAAA/messages?key=k&token=t")
    ).toBeNull();
    expect(validateChannelTarget("googlechat", "https://chat.googleapis.com/v2/other")).not.toBeNull();
    expect(validateChannelTarget("googlechat", "https://chat.googleapis.com.evil.dev/v1/spaces/a")).not.toBeNull();
  });

  test("ntfy accepts https topic URLs", () => {
    expect(validateChannelTarget("ntfy", "https://ntfy.sh/my-alerts")).toBeNull();
    expect(validateChannelTarget("ntfy", "https://ntfy.example.com/team_alerts")).toBeNull();
    expect(validateChannelTarget("ntfy", "http://ntfy.sh/my-alerts")).not.toBeNull();
    expect(validateChannelTarget("ntfy", "https://ntfy.sh/")).not.toBeNull();
  });

  test("telegram tokens are masked to id + last 4", () => {
    expect(maskTelegramToken(TG_TOKEN)).toBe("123456789:…0123");
  });
});

describe("deliver to new channels", () => {
  test("telegram posts to the Bot API with the chat id", async () => {
    const d = deps();
    expect(await deliver({ type: "telegram", target: TG_TOKEN, chatId: "-100123" }, alert, d)).toEqual({ ok: true });
    const [url, body] = (d.post as ReturnType<typeof mock>).mock.calls[0]! as [string, any];
    expect(url).toBe(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`);
    expect(body).toMatchObject({ chat_id: "-100123", text: `${alert.subject}\n\n${alert.message}` });
  });

  test("telegram errors never include the bot token", async () => {
    const d = deps({
      post: mock(async () => {
        throw new Error(`connect failed for https://api.telegram.org/bot${TG_TOKEN}/sendMessage`);
      }),
    });
    const result = await deliver({ type: "telegram", target: TG_TOKEN, chatId: "1" }, alert, d);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain(TG_TOKEN);
  });

  test("teams gets an adaptive card and google chat gets text", async () => {
    const d = deps();
    await deliver({ type: "teams", target: "https://acme.webhook.office.com/webhookb2/abc" }, alert, d);
    await deliver({ type: "googlechat", target: "https://chat.googleapis.com/v1/spaces/A/messages" }, alert, d);
    const calls = (d.post as ReturnType<typeof mock>).mock.calls as [string, any][];
    expect(calls[0]![1].attachments[0].contentType).toBe("application/vnd.microsoft.card.adaptive");
    expect(JSON.stringify(calls[0]![1])).toContain(alert.subject);
    expect(calls[1]![1]).toEqual({ text: `*${alert.subject}*\n${alert.message}` });
  });

  test("ntfy publishes JSON to the server root and is SSRF-checked", async () => {
    const d = deps();
    await deliver({ type: "ntfy", target: "https://ntfy.sh/my-alerts" }, alert, d);
    expect(d.assertSafeUrl).toHaveBeenCalledWith("https://ntfy.sh/my-alerts");
    const [url, body] = (d.post as ReturnType<typeof mock>).mock.calls[0]! as [string, any];
    expect(url).toBe("https://ntfy.sh/");
    expect(body).toMatchObject({ topic: "my-alerts", title: alert.subject, message: alert.message });

    const blocked = deps({
      assertSafeUrl: mock(async () => {
        throw new UnsafeUrlError("URL resolves to a private or reserved address");
      }),
    });
    expect((await deliver({ type: "ntfy", target: "https://10.0.0.1/t" }, alert, blocked)).ok).toBe(false);
    expect(blocked.post).not.toHaveBeenCalled();
  });
});
