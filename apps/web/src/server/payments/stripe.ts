import Stripe from "stripe";
import type { PaymentProvider } from "./provider";
import { env } from "../env";

/**
 * Stripe Connect – "destination charges":
 *  the family pays LICENGO's platform account, Stripe automatically transfers
 *  (amount − application_fee_amount) to the club's Express connected account.
 *  → club receives 150 €, LICENGO keeps 4,99 €, no manual reconciliation.
 */
let client: Stripe | null = null;
export const stripe = () => (client ??= new Stripe(env.stripeSecretKey));

export const stripeProvider: PaymentProvider = {
  name: "stripe",
  async createCheckout(a) {
    if (!a.clubStripeAccountId) throw new Error("Le club n'a pas encore activé les paiements en ligne");
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: a.customerEmail,
      customer_creation: "always",
      locale: "fr",
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: a.amountCents, product_data: { name: a.description } } }],
      payment_intent_data: {
        application_fee_amount: a.platformFeeCents,
        transfer_data: { destination: a.clubStripeAccountId },
        setup_future_usage: a.saveForFuture ? "off_session" : undefined,
        metadata: { installmentId: a.installmentId, paymentId: a.paymentId },
      },
      metadata: { installmentId: a.installmentId, paymentId: a.paymentId },
      success_url: a.successUrl,
      cancel_url: a.cancelUrl,
    });
    return { url: session.url!, sessionId: session.id };
  },
  async chargeOffSession(a) {
    if (!a.clubStripeAccountId || !a.customerId || !a.paymentMethodId) return { status: "failed", reason: "Moyen de paiement indisponible" };
    try {
      const pi = await stripe().paymentIntents.create(
        {
          amount: a.amountCents,
          currency: "eur",
          customer: a.customerId,
          payment_method: a.paymentMethodId,
          off_session: true,
          confirm: true,
          description: a.description,
          application_fee_amount: a.platformFeeCents || undefined,
          transfer_data: { destination: a.clubStripeAccountId },
          metadata: { installmentId: a.installmentId },
        },
        { idempotencyKey: `installment-${a.installmentId}-${Date.now() / 86400_000 | 0}` },
      );
      if (pi.status === "succeeded") return { status: "succeeded", intentId: pi.id };
      if (pi.status === "processing") return { status: "processing", intentId: pi.id };
      return { status: "failed", intentId: pi.id, reason: `Statut ${pi.status}` };
    } catch (e) {
      const err = e as Stripe.errors.StripeError;
      return { status: "failed", intentId: err.payment_intent?.id, reason: err.message };
    }
  },
  async refund(a) {
    const r = await stripe().refunds.create({
      payment_intent: a.intentId,
      amount: a.amountCents,
      reverse_transfer: true, // take the money back from the club account
      refund_application_fee: a.refundApplicationFee,
    });
    return { id: r.id, status: r.status === "succeeded" ? "succeeded" : r.status === "failed" ? "failed" : "pending" };
  },
  async createConnectedAccount(club) {
    const acct = await stripe().accounts.create({
      type: "express",
      country: "FR",
      email: club.email ?? undefined,
      business_type: "non_profit",
      business_profile: { name: club.name, mcc: "7941" },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });
    return acct.id;
  },
  async onboardingLink(accountId, returnUrl) {
    const link = await stripe().accountLinks.create({ account: accountId, refresh_url: returnUrl, return_url: returnUrl, type: "account_onboarding" });
    return link.url;
  },
};
