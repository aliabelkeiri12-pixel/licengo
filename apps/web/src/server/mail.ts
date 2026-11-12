import { env } from "./env";

export interface Mail { to: string; subject: string; text: string; html?: string }

/**
 * Transactional e-mail through Brevo's HTTP API (French provider, EU hosting; free tier 300 e-mails/day).
 * Variables: BREVO_API_KEY and MAIL_FROM (a sender address verified in Brevo).
 * Without BREVO_API_KEY (dev) the message is logged; in tests it is captured in globalThis.__sentMails.
 */
export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  if (process.env.NODE_ENV === "test") {
    ((globalThis as { __sentMails?: Mail[] }).__sentMails ??= []).push({ to, subject, text, html });
    return true;
  }
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.info(`[mail] to=${to} subject=${subject}\n${text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "LICENGO", email: process.env.MAIL_FROM ?? "no-reply@licengo.fr" },
        to: [{ email: to }],
        subject,
        textContent: text,
        ...(html ? { htmlContent: html } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("mail failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("mail failed", e);
    return false;
  }
}

export const appLink = (path: string) => `${env.appUrl}${path}`;
