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

const { sendEmail } = await import("../lib/email");

const ORIGINAL_FROM = process.env.EMAIL_FROM;

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });
});

afterEach(() => {
  if (ORIGINAL_FROM === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = ORIGINAL_FROM;
});

describe("sendEmail", () => {
  test("throws (without calling Resend) when text is empty", async () => {
    await expect(
      sendEmail({ to: "a@b.com", subject: "hi", text: "" })
    ).rejects.toThrow("Text content must be provided.");
    expect(sendMock).not.toHaveBeenCalled();
  });

  test("sends and returns the SDK data on success", async () => {
    const data = await sendEmail({
      to: "user@example.com",
      subject: "Alert",
      text: "Your site is down",
    });

    expect(data).toEqual({ id: "email_123" });
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

    await expect(
      sendEmail({ to: "user@example.com", subject: "Alert", text: "body" })
    ).rejects.toThrow("Resend failed to send email: domain not verified");
  });
});
