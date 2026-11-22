import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// `sendEmail` delegates to the Resend SDK singleton exported from
// utils/resendClient. Mock that module so no real API key / network is needed
// and we can assert on the payload and drive the error branch.
const sendMock = mock<
  (payload: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }) => Promise<{ data: unknown; error: { message: string } | null }>
>(async () => ({ data: { id: "email_123" }, error: null }));

mock.module("../utils/resendClient", () => ({
  resend: { emails: { send: sendMock } },
}));

let smtpOn = false;
const sendMail = mock(async (_m: { from: string; to: string; subject: string; text: string }) => ({}));
mock.module("../utils/smtpClient", () => ({
  smtpConfigured: () => smtpOn,
  getSmtpTransport: () => ({ sendMail }),
}));

const { sendEmail } = await import("../lib/email");

const ORIGINAL_ENV = {
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_NOTIFICATIONS_ENABLED: process.env.EMAIL_NOTIFICATIONS_ENABLED,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  SMTP_USER: process.env.SMTP_USER,
};

beforeEach(() => {
  process.env.EMAIL_NOTIFICATIONS_ENABLED = "true";
  process.env.RESEND_API_KEY = "re_test";
  smtpOn = false;
  sendMail.mockReset();
  sendMail.mockResolvedValue({});
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
});

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("sendEmail", () => {
  test("skips sending when EMAIL_NOTIFICATIONS_ENABLED is not 'true'", async () => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
    const result = await sendEmail({ to: "a@b.com", subject: "hi", text: "body" });
    expect(result).toEqual({ ok: true, skipped: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("fails (without calling Resend) when text is empty", async () => {
    const result = await sendEmail({ to: "a@b.com", subject: "hi", text: "" });
    expect(result).toEqual({ ok: false, error: "Text content must be provided." });
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("fails (without calling Resend) when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail({ to: "a@b.com", subject: "hi", text: "body" });
    expect(result).toEqual({ ok: false, error: "RESEND_API_KEY is missing." });
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("sends and reports ok on success", async () => {
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Alert",
      text: "Your site is down",
    });

    expect(result).toEqual({ ok: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      from: "UptimeWatch <onboarding@resend.dev>",
      to: "user@example.com",
      subject: "Alert",
      text: "Your site is down",
    });
  });

  test("uses EMAIL_FROM when set", async () => {
    process.env.EMAIL_FROM = "Custom <alerts@custom.dev>";
    await sendEmail({ to: "user@example.com", subject: "Alert", text: "body" });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Custom <alerts@custom.dev>" })
    );
  });

  test("surfaces an API-level error returned in the { error } field", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "domain not verified" },
    });

    const result = await sendEmail({ to: "user@example.com", subject: "Alert", text: "body" });
    expect(result).toEqual({ ok: false, error: "domain not verified" });
  });

  test("adds a hint when the sender domain is unverified", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "You can only send testing emails to your own address" },
    });

    const result = await sendEmail({ to: "user@example.com", subject: "Alert", text: "body" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Set EMAIL_FROM");
  });

  test("uses SMTP instead of Resend when configured", async () => {
    smtpOn = true;
    process.env.EMAIL_FROM = "UptimeWatch <me@gmail.com>";
    const result = await sendEmail({ to: "ops@acme.dev", subject: "Down", text: "api is down" });
    expect(result).toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledWith({
      from: "UptimeWatch <me@gmail.com>",
      to: "ops@acme.dev",
      subject: "Down",
      text: "api is down",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("falls back to SMTP_USER as the sender and reports SMTP errors", async () => {
    smtpOn = true;
    delete process.env.EMAIL_FROM;
    process.env.SMTP_USER = "me@gmail.com";
    sendMail.mockRejectedValue(new Error("Invalid login"));
    const result = await sendEmail({ to: "ops@acme.dev", subject: "Down", text: "x" });
    expect(sendMail.mock.calls[0]![0].from).toBe("me@gmail.com");
    expect(result).toEqual({ ok: false, error: "SMTP: Invalid login" });
  });
});
