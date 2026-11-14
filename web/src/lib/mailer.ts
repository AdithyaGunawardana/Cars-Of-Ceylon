import nodemailer from "nodemailer";

// Outbound email behind one function. Transport is chosen by environment:
//   SMTP_URL set       -> real delivery through nodemailer (e.g. smtps://user:pass@smtp.example.com:465)
//   MAIL_TRANSPORT=memory -> captured in `outbox` (tests)
//   otherwise          -> printed to the server log (local development)
// MAIL_FROM sets the sender address.

export type MailMessage = { to: string; subject: string; text: string };

export const outbox: MailMessage[] = [];

export function clearOutbox() {
  outbox.length = 0;
}

export type MailTransportKind = "smtp" | "memory" | "log";

export function getMailTransportKind(): MailTransportKind {
  if (process.env.MAIL_TRANSPORT === "memory") return "memory";
  if (process.env.SMTP_URL) return "smtp";
  return "log";
}

export async function sendMail(message: MailMessage) {
  const kind = getMailTransportKind();

  if (kind === "memory") {
    outbox.push(message);
    return;
  }

  if (kind === "smtp") {
    const transport = nodemailer.createTransport(process.env.SMTP_URL!);
    await transport.sendMail({ from: process.env.MAIL_FROM ?? "Cars of Ceylon <no-reply@localhost>", ...message });
    return;
  }

  // Never print message bodies in production: they contain single-use account links.
  if (process.env.NODE_ENV === "production") {
    console.error("Email not sent: configure SMTP_URL (and MAIL_FROM) to deliver account emails.");
    return;
  }
  console.log(`\n--- email to ${message.to} ---\n${message.subject}\n\n${message.text}\n---`);
}
