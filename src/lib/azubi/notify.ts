import "server-only";
import { sendEmail } from "@/lib/email-service";

/**
 * Recipient(s) for new-application/new-enquiry alerts — read from env,
 * never hardcoded or shown on the public site (build brief section 9.4,
 * a DECISION NEEDED item: who actually receives these). Comma-separate
 * multiple addresses; nodemailer accepts that directly as `to`.
 */
function recipients(): string | null {
  const raw = process.env.AZUBI_NOTIFY_EMAILS?.trim();
  return raw ? raw : null;
}

/** Fire-and-forget, matching how other submission paths in this repo send mail after the DB write. */
export function notifyAzubiTeam(subject: string, html: string, text: string) {
  const to = recipients();
  if (!to) {
    console.warn("[azubi] AZUBI_NOTIFY_EMAILS is not set — skipping team notification:", subject);
    return;
  }
  sendEmail("azubi_team_notification", { to, subject, html, text }).catch((err) => {
    console.error("[azubi] Failed to send team notification:", err);
  });
}
