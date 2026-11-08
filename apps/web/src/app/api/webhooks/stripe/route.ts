import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/server/env";
import { prisma } from "@/server/db";
import { stripe } from "@/server/payments/stripe";
import { markInstallmentPaid, markInstallmentFailed } from "@/server/services/payments";

/** Stripe webhooks – signature verified, idempotent (event ids stored). */
export async function POST(req: Request) {
  if (!env.stripeSecretKey || !env.stripeWebhookSecret) return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", env.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }
  const seen = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const installmentId = s.metadata?.installmentId;
      if (installmentId && s.payment_status === "paid" && typeof s.payment_intent === "string") {
        const pi = await stripe().paymentIntents.retrieve(s.payment_intent);
        await markInstallmentPaid(installmentId, { intentId: pi.id, customerId: typeof pi.customer === "string" ? pi.customer : undefined, paymentMethodId: typeof pi.payment_method === "string" ? pi.payment_method : undefined });
      }
      break;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      if (pi.metadata?.installmentId) await markInstallmentPaid(pi.metadata.installmentId, { intentId: pi.id });
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      if (pi.metadata?.installmentId) await markInstallmentFailed(pi.metadata.installmentId, pi.last_payment_error?.message ?? "Paiement refusé", pi.id);
      break;
    }
    case "account.updated": {
      const a = event.data.object;
      await prisma.club.updateMany({ where: { stripeAccountId: a.id }, data: { stripeChargesEnabled: !!a.charges_enabled } });
      break;
    }
    case "charge.refunded":
    case "charge.dispute.created":
      // Refunds are initiated from LICENGO (already recorded); disputes are surfaced in the Stripe dashboard.
      break;
  }
  await prisma.webhookEvent.create({ data: { id: event.id, type: event.type } });
  return NextResponse.json({ received: true });
}
