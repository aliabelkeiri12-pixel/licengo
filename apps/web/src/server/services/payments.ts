import { buildLicenseCheckout, computeShopSplit, splitRefund, formatEUR } from "@licengo/core";
import type { Installment, Payment } from "@prisma/client";
import { prisma } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import { paymentProvider } from "../payments";
import { notify, notifyClubStaff } from "../notify";
import { audit } from "../audit";
import { env } from "../env";
import type { SessionUser } from "../auth";
import { assertFamilyAccess } from "./registrations";

const MAX_ATTEMPTS = 3;
const RETRY_DAYS = 3;

export async function startLicensePayment(user: SessionUser, registrationId: string, installmentsCount: number) {
  const r = await assertFamilyAccess(user, registrationId);
  if (["REJECTED", "CANCELLED"].includes(r.status)) throw new AppError("Dossier clôturé");
  if (r.paymentStatus === "PAID" || r.paymentStatus === "PARTIAL") throw new AppError("Cette licence est déjà réglée ou en cours de paiement");
  if (installmentsCount > r.category.maxInstallments) throw new AppError(`Le club autorise au maximum ${r.category.maxInstallments} échéances`);
  const provider = paymentProvider();
  if (provider.name === "stripe" && !r.club.stripeChargesEnabled) throw new AppError("Le club n'a pas encore activé le paiement en ligne");

  // Abandoned checkouts are cancelled and replaced
  await prisma.payment.updateMany({ where: { registrationId, status: "PENDING" }, data: { status: "CANCELLED" } });
  const plan = buildLicenseCheckout(r.licenseFeeCents, installmentsCount, r.platformFeeCents);
  const payment = await prisma.payment.create({
    data: {
      kind: "LICENSE", registrationId, clubId: r.clubId, payerId: user.id, provider: provider.name,
      totalCents: plan.totalCents, clubAmountCents: plan.licenseCents, platformFeeCents: plan.platformFeeCents, installmentsCount,
      installments: { create: plan.installments.map((i) => ({ index: i.index, dueDate: i.dueDate, amountCents: i.amountCents, clubAmountCents: i.clubAmountCents, platformFeeCents: i.platformFeeCents })) },
    },
    include: { installments: { orderBy: { index: "asc" } } },
  });
  const first = payment.installments[0];
  const session = await provider.createCheckout({
    paymentId: payment.id, installmentId: first.id,
    description: `Licence ${r.season} – ${r.child.firstName} ${r.child.lastName} – ${r.club.name}${installmentsCount > 1 ? ` (1/${installmentsCount})` : ""}`,
    amountCents: first.amountCents, platformFeeCents: first.platformFeeCents, clubStripeAccountId: r.club.stripeAccountId,
    customerEmail: user.email, saveForFuture: installmentsCount > 1,
    successUrl: `${env.appUrl}/famille/inscriptions/${r.id}?paiement=ok`, cancelUrl: `${env.appUrl}/famille/inscriptions/${r.id}?paiement=annule`,
  });
  await prisma.payment.update({ where: { id: payment.id }, data: { checkoutSessionId: session.sessionId } });
  return { url: session.url, paymentId: payment.id };
}

/** Re-pay a failed installment manually (card change). */
export async function retryInstallmentCheckout(user: SessionUser, installmentId: string) {
  const inst = await prisma.installment.findUnique({ where: { id: installmentId }, include: { payment: { include: { club: true } } } });
  if (!inst || inst.payment.payerId !== user.id) throw forbidden();
  if (!["FAILED", "SCHEDULED"].includes(inst.status)) throw new AppError("Échéance déjà réglée");
  const s = await paymentProvider().createCheckout({
    paymentId: inst.paymentId, installmentId: inst.id, description: `Échéance ${inst.index}/${inst.payment.installmentsCount}`,
    amountCents: inst.amountCents, platformFeeCents: inst.platformFeeCents, clubStripeAccountId: inst.payment.club.stripeAccountId,
    customerEmail: user.email, saveForFuture: true, successUrl: `${env.appUrl}/famille/paiements?paiement=ok`, cancelUrl: `${env.appUrl}/famille/paiements`,
  });
  return { url: s.url };
}

async function refreshAggregates(paymentId: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { installments: true, order: true } });
  const paid = p.installments.filter((i) => i.status === "PAID").length;
  const failed = p.installments.some((i) => i.status === "FAILED");
  const status = paid === p.installments.length ? "COMPLETED" : paid > 0 ? "ACTIVE" : failed ? "FAILED" : p.status;
  await prisma.payment.update({ where: { id: p.id }, data: { status } });
  if (p.registrationId) {
    const ps = failed ? "LATE" : paid === p.installments.length ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
    await prisma.registration.update({ where: { id: p.registrationId }, data: { paymentStatus: ps } });
  }
  if (p.order && paid === p.installments.length && p.order.status === "PENDING_PAYMENT")
    await prisma.shopOrder.update({ where: { id: p.order.id }, data: { status: "PAID" } });
  return p;
}

/** Idempotent – called by the Stripe webhook or the simulated checkout. */
export async function markInstallmentPaid(installmentId: string, info: { intentId?: string; customerId?: string; paymentMethodId?: string }) {
  const inst = await prisma.installment.findUnique({ where: { id: installmentId }, include: { payment: true } });
  if (!inst) throw notFound("Échéance");
  if (inst.status === "PAID") return inst;
  await prisma.installment.update({ where: { id: inst.id }, data: { status: "PAID", paidAt: new Date(), providerPaymentIntentId: info.intentId ?? inst.providerPaymentIntentId, failureReason: null } });
  if (info.customerId || info.paymentMethodId)
    await prisma.payment.update({ where: { id: inst.paymentId }, data: { providerCustomerId: info.customerId ?? undefined, providerPaymentMethodId: info.paymentMethodId ?? undefined } });
  const p = await refreshAggregates(inst.paymentId);
  await notify(p.payerId, { type: "PAYMENT_SUCCEEDED", title: "Paiement confirmé", body: `${formatEUR(inst.amountCents)} – échéance ${inst.index}/${p.installmentsCount}`, link: "/famille/paiements" });
  await audit(null, "installment.paid", "Installment", inst.id, { amount: inst.amountCents });
  return inst;
}

export async function markInstallmentFailed(installmentId: string, reason: string, intentId?: string) {
  const inst = await prisma.installment.findUnique({ where: { id: installmentId }, include: { payment: { include: { registration: { include: { child: true } } } } } });
  if (!inst || inst.status === "PAID") return;
  await prisma.installment.update({ where: { id: inst.id }, data: { status: "FAILED", attempts: { increment: 1 }, failureReason: reason, providerPaymentIntentId: intentId ?? inst.providerPaymentIntentId } });
  const p = await refreshAggregates(inst.paymentId);
  if (inst.index > 1 || inst.attempts > 0) {
    await notify(p.payerId, { type: "PAYMENT_FAILED", title: "Échec de prélèvement", body: `L'échéance ${inst.index} de ${formatEUR(inst.amountCents)} n'a pas pu être prélevée : ${reason}. Mettez à jour votre carte.`, link: "/famille/paiements" });
    await notifyClubStaff(p.clubId, { type: "PAYMENT_FAILED", title: "Impayé", body: `${inst.payment.registration?.child.firstName ?? ""} ${inst.payment.registration?.child.lastName ?? ""} – échéance ${inst.index} (${formatEUR(inst.amountCents)})`, link: "/club/paiements" });
  }
}

/** Cron: charges due installments off-session, retries failed ones (3 attempts, every 3 days). */
export async function runDueInstallments(now = new Date()) {
  const provider = paymentProvider();
  const due = await prisma.installment.findMany({
    where: {
      index: { gt: 1 },
      payment: { status: { in: ["ACTIVE", "FAILED"] } },
      OR: [
        { status: "SCHEDULED", dueDate: { lte: now } },
        { status: "FAILED", attempts: { lt: MAX_ATTEMPTS }, updatedAt: { lte: new Date(now.getTime() - RETRY_DAYS * 86400_000) } },
      ],
    },
    include: { payment: { include: { club: true } } },
    take: 500,
  });
  const res = { charged: 0, failed: 0 };
  for (const inst of due) {
    // optimistic lock: only one worker processes an installment
    const locked = await prisma.installment.updateMany({ where: { id: inst.id, status: inst.status, updatedAt: inst.updatedAt }, data: { status: "PROCESSING" } });
    if (locked.count === 0) continue;
    const r = await provider.chargeOffSession({
      installmentId: inst.id, amountCents: inst.amountCents, platformFeeCents: inst.platformFeeCents,
      clubStripeAccountId: inst.payment.club.stripeAccountId, customerId: inst.payment.providerCustomerId,
      paymentMethodId: inst.payment.providerPaymentMethodId, description: `Échéance ${inst.index}/${inst.payment.installmentsCount}`,
    });
    if (r.status === "succeeded") { await markInstallmentPaid(inst.id, { intentId: r.intentId }); res.charged++; }
    else if (r.status === "failed") { await prisma.installment.update({ where: { id: inst.id }, data: { status: inst.status } }); await markInstallmentFailed(inst.id, r.reason, r.intentId); res.failed++; }
    else await prisma.installment.update({ where: { id: inst.id }, data: { providerPaymentIntentId: r.intentId } });
  }
  return res;
}

/** Refund (club treasurer or LICENGO admin). Refunds latest paid installments first; scheduled ones are cancelled on full refund. */
export async function refundPayment(user: SessionUser, paymentId: string, amountCents: number, reason: string, refundPlatformFee: boolean) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { installments: { orderBy: { index: "desc" } }, refunds: true } });
  if (!p) throw notFound("Paiement");
  if (user.role !== "ADMIN" && !user.staff.some((s) => s.clubId === p.clubId && ["OWNER", "TREASURER"].includes(s.role))) throw forbidden();
  if (refundPlatformFee && user.role !== "ADMIN") throw new AppError("Seul LICENGO peut rembourser ses frais de service");
  if (!reason || reason.trim().length < 3) throw new AppError("Motif obligatoire");
  const paid = p.installments.filter((i) => i.status === "PAID");
  const done = p.refunds.filter((r) => r.status !== "FAILED");
  const paidClub = paid.reduce((s, i) => s + i.clubAmountCents, 0) - done.reduce((s, r) => s + r.clubCents, 0);
  const paidFee = paid.reduce((s, i) => s + i.platformFeeCents, 0) - done.reduce((s, r) => s + r.feeCents, 0);
  const split = splitRefund(amountCents, paidClub, paidFee, refundPlatformFee);

  const provider = paymentProvider();
  let remaining = amountCents;
  let feeRemaining = split.feeCents;
  for (const inst of paid) {
    if (remaining <= 0) break;
    const already = done.filter((r) => r.installmentId === inst.id).reduce((s, r) => s + r.amountCents, 0);
    const refundable = inst.amountCents - already - (refundPlatformFee ? 0 : inst.platformFeeCents);
    const amount = Math.min(remaining, refundable);
    if (amount <= 0) continue;
    const fee = Math.min(feeRemaining, inst.platformFeeCents);
    const out = await provider.refund({ intentId: inst.providerPaymentIntentId ?? "", amountCents: amount, refundApplicationFee: fee > 0 });
    await prisma.refund.create({ data: { paymentId: p.id, installmentId: inst.id, amountCents: amount, clubCents: amount - fee, feeCents: fee, reason, status: out.status === "succeeded" ? "SUCCEEDED" : out.status === "failed" ? "FAILED" : "PENDING", providerRefundId: out.id, createdById: user.id } });
    remaining -= amount; feeRemaining -= fee;
  }
  const full = split.clubCents === paidClub;
  if (full) {
    await prisma.installment.updateMany({ where: { paymentId: p.id, status: { in: ["SCHEDULED", "FAILED"] } }, data: { status: "CANCELLED" } });
    await prisma.payment.update({ where: { id: p.id }, data: { status: "REFUNDED" } });
    if (p.registrationId) await prisma.registration.update({ where: { id: p.registrationId }, data: { paymentStatus: "REFUNDED" } });
    if (p.orderId) await prisma.shopOrder.update({ where: { id: p.orderId }, data: { status: "REFUNDED" } });
  }
  await audit(user.id, "payment.refund", "Payment", p.id, { amountCents, refundPlatformFee, reason });
  await notify(p.payerId, { type: "REFUND", title: "Remboursement effectué", body: `${formatEUR(amountCents)} remboursés : ${reason}`, link: "/famille/paiements" });
  return { refundedCents: amountCents, full };
}

export type PaymentWithInstallments = Payment & { installments: Installment[] };

export async function startShopPayment(user: SessionUser, orderId: string) {
  const order = await prisma.shopOrder.findUnique({ where: { id: orderId }, include: { club: true, payment: { include: { installments: true } } } });
  if (!order || order.userId !== user.id) throw forbidden();
  if (order.status !== "PENDING_PAYMENT") throw new AppError("Commande déjà réglée");
  const provider = paymentProvider();
  const payment = order.payment ?? (await prisma.payment.create({
    data: {
      kind: "SHOP", orderId: order.id, clubId: order.clubId, payerId: user.id, provider: provider.name,
      totalCents: order.subtotalCents, clubAmountCents: order.clubAmountCents, platformFeeCents: order.platformFeeCents, installmentsCount: 1,
      installments: { create: [{ index: 1, dueDate: new Date(), amountCents: order.subtotalCents, clubAmountCents: order.clubAmountCents, platformFeeCents: order.platformFeeCents }] },
    },
    include: { installments: true },
  }));
  const s = await provider.createCheckout({
    paymentId: payment.id, installmentId: payment.installments[0].id, description: `Commande ${order.number} – Boutique ${order.club.name}`,
    amountCents: order.subtotalCents, platformFeeCents: order.platformFeeCents, clubStripeAccountId: order.club.stripeAccountId,
    customerEmail: user.email, saveForFuture: false, successUrl: `${env.appUrl}/commandes/${order.id}?paiement=ok`, cancelUrl: `${env.appUrl}/commandes/${order.id}`,
  });
  return { url: s.url };
}

export { computeShopSplit };
