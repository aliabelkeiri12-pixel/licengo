import { env } from "./env";

/**
 * Transactional e-mail. Production: Brevo (French provider, EU hosting) through its HTTP API.
 * Without BREVO_API_KEY (dev/tests) the message is logged instead of sent.
 */
export async function sendMail(to: string, subject: string, text: string) {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "test") console.info(`[mail] to=${to} subject=${subject}\n${text}`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ sender: { name: "LICENGO", email: process.env.MAIL_FROM ?? "no-reply@licengo.fr" }, to: [{ email: to }], subject, textContent: text }),
  });
  if (!res.ok) console.error("mail failed", res.status, await res.text().catch(() => ""));
}

export const appLink = (path: string) => `${env.appUrl}${path}`;
