import { describe, expect, mock, test } from "bun:test";
import { deliver, validateChannelTarget, type DeliveryDeps } from "../notify/channels";
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
