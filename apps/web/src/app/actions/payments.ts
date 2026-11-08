"use server";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { MOCK_CARDS } from "@/server/payments/mock";
import { markInstallmentPaid, markInstallmentFailed } from "@/server/services/payments";
import { safe } from "@/lib/safe-action";
import type { ActionState } from "@/lib/action-state";

export async function simulatePaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let dest = "/famille/paiements?paiement=ok";
  const res = await safe(async () => {
    if (env.stripeSecretKey) throw new AppError("Simulation désactivée");
    const user = await requireUser();
    const inst = await prisma.installment.findUnique({ where: { id: String(fd.get("installmentId")) }, include: { payment: true } });
    if (!inst || inst.payment.payerId !== user.id) throw new AppError("Échéance introuvable");
    const card = String(fd.get("card") ?? "").replace(/\s/g, "");
    if (card === MOCK_CARDS.declined) {
      await markInstallmentFailed(inst.id, "Carte refusée");
      throw new AppError("Paiement refusé par la banque. Essayez une autre carte.");
    }
    if (!/^\d{16}$/.test(card)) throw new AppError("Numéro de carte invalide");
    const pm = `pm_mock_${card === MOCK_CARDS.failLater ? "faillater_" : ""}${randomBytes(6).toString("hex")}`;
    await markInstallmentPaid(inst.id, { intentId: `pi_mock_${randomBytes(8).toString("hex")}`, customerId: `cus_mock_${user.id}`, paymentMethodId: pm });
    if (inst.payment.registrationId && inst.index === 1) dest = `/famille/inscriptions/${inst.payment.registrationId}?paiement=ok`;
    if (inst.payment.orderId) dest = `/commandes/${inst.payment.orderId}?paiement=ok`;
  });
  if (res) return res;
  redirect(dest);
}
