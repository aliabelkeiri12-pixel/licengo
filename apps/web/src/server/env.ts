export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  cronSecret: process.env.CRON_SECRET || "",
  storageDir: process.env.STORAGE_DIR || "./storage",
  isProd: process.env.NODE_ENV === "production",
};

export function documentKey(): Buffer {
  const raw = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!raw) throw new Error("DOCUMENT_ENCRYPTION_KEY manquant");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("DOCUMENT_ENCRYPTION_KEY doit faire 32 octets (base64)");
  return key;
}
