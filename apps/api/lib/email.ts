import { resend } from "../utils/resendClient";

export const sendEmail = async ({ to, subject, text }: {
  to: string;
  subject: string;
  text: string;
}) => {
  if (!text) {
    throw new Error("Text content must be provided.");
  }

  // The Resend SDK does NOT throw on API-level failures — it resolves with an
  // `{ data, error }` shape. Surface that error so callers don't treat a failed
  // send as a success (e.g. marking a notification as sent when it never went out).
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "UptimeWatch <onboarding@resend.dev>",
    to,
    subject,
    text,
  });

  if (error) {
    throw new Error(`Resend failed to send email: ${error.message}`);
  }

  return data;
};
