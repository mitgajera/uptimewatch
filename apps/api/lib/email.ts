import { resend } from "../utils/resendClient";

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
