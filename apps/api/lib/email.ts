import { resend } from "../utils/resendClient";
import { getSmtpTransport, smtpConfigured } from "../utils/smtpClient";

export const sendEmail = async ({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> => {
  // Temporary feature flag to pause email delivery without removing code paths.
  // Set EMAIL_NOTIFICATIONS_ENABLED=true to enable real sending again.
  const emailEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === "true";
  if (!emailEnabled) {
    return { ok: true, skipped: true };
  }

  if (!text) {
    return { ok: false, error: "Text content must be provided." };
  }

  // SMTP (Brevo, Gmail, Mailjet, ...) when configured: sends to any address
  // from a single verified sender, no domain required.
  if (smtpConfigured()) {
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
    if (!from) {
      return { ok: false, error: "Set EMAIL_FROM to your verified sender address." };
    }
    try {
      await getSmtpTransport().sendMail({ from, to, subject, text });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `SMTP: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY is missing." };
  }

  // The Resend SDK resolves with `{ data, error }` on API-level failures.
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "UptimeWatch <onboarding@resend.dev>",
    to,
    subject,
    text,
  });

  if (error) {
    const msg = String(error.message || "Unknown Resend error");
    const isUnverifiedSender =
      msg.toLowerCase().includes("verify a domain") ||
      msg.toLowerCase().includes("testing emails");

    if (isUnverifiedSender) {
      return {
        ok: false,
        error: `${msg} Set EMAIL_FROM to an address on a verified Resend domain.`,
      };
    }

    return { ok: false, error: msg };
  }

  return { ok: true };
};
