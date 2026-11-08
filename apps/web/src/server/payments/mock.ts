import { randomBytes } from "node:crypto";
import type { PaymentProvider } from "./provider";
import { env } from "../env";

/**
 * Simulated provider (demo & automated tests). Same behaviour contract as Stripe:
 *  - 4242 4242 4242 4242 → success
 *  - 4000 0000 0000 0002 → declined
 *  - 4000 0000 0000 0341 → first payment OK, later off-session installments fail (unpaid scenario)
 */
export const MOCK_CARDS = { ok: "4242424242424242", declined: "4000000000000002", failLater: "4000000000000341" };
const id = (p: string) => `${p}_mock_${randomBytes(8).toString("hex")}`;

export const mockProvider: PaymentProvider = {
  name: "mock",
  async createCheckout(a) {
    return { url: `${env.appUrl}/paiement/simulation/${a.installmentId}`, sessionId: id("cs") };
  },
  async chargeOffSession(a) {
    if (!a.paymentMethodId) return { status: "failed", reason: "Aucun moyen de paiement enregistré" };
    if (a.paymentMethodId.startsWith("pm_mock_faillater")) return { status: "failed", intentId: id("pi"), reason: "Carte refusée (fonds insuffisants)" };
    return { status: "succeeded", intentId: id("pi") };
  },
  async refund() { return { id: id("re"), status: "succeeded" }; },
  async createConnectedAccount() { return id("acct"); },
  async onboardingLink(_accountId, returnUrl) { return `${returnUrl}?mock_onboarding=1`; },
};
