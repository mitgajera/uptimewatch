import { resend } from "../utils/resendClient";

export const sendEmail = async ({ to, subject, text }: {
  to: string;
  subject: string;
  text: string;
}) => {
  if (!text) {
    throw new Error("Text content must be provided.");
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "UptimeWatch <onboarding@resend.dev>",
    to,
    subject,
    text,
  });
};
