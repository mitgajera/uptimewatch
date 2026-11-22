import nodemailer from "nodemailer";

type Transporter = ReturnType<typeof nodemailer.createTransport>;

let transport: Transporter | null = null;

/** True when SMTP settings are present (SMTP takes precedence over Resend). */
export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * Shared SMTP transport (Brevo, Gmail, Mailjet, ...), built from env on first
 * use. Port 465 uses implicit TLS; other ports upgrade with STARTTLS.
 */
export function getSmtpTransport(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transport;
}
