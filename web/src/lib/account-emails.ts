import { issueToken } from "@/lib/auth-tokens";
import { sendMail } from "@/lib/mailer";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export async function sendPasswordResetEmail(email: string) {
  const token = await issueToken("reset", email);
  const link = `${getSiteUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: `Reset your ${SITE_NAME} password`,
    text: [
      `Someone asked to reset the password for this ${SITE_NAME} account.`,
      "",
      `Choose a new password (link valid for 1 hour, single use):`,
      link,
      "",
      "If you did not request this you can ignore this email; your password stays the same.",
    ].join("\n"),
  });
}

export async function sendVerificationEmail(email: string) {
  const token = await issueToken("verify", email);
  const link = `${getSiteUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: `Confirm your ${SITE_NAME} email address`,
    text: [
      `Welcome to ${SITE_NAME}. Please confirm this email address (link valid for 24 hours):`,
      link,
      "",
      "If you did not create an account you can ignore this email.",
    ].join("\n"),
  });
}
