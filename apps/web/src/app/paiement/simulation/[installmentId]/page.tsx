import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { Card } from "@/components/ui";
import { Logo } from "@/components/logo";
import { SimulationForm } from "./form";

export const metadata = { title: "Paiement sécurisé (simulation)" };

/** Simulated hosted checkout – only available when Stripe keys are not configured (demo / tests). */
export default async function Simulation({ params }: { params: Promise<{ installmentId: string }> }) {
  if (env.stripeSecretKey) notFound();
  const user = await requireUser();
  const inst = await prisma.installment.findUnique({ where: { id: (await params).installmentId }, include: { payment: { include: { club: true, registration: { include: { child: true } }, order: true } } } });
  if (!inst || inst.payment.payerId !== user.id) notFound();
  const p = inst.payment;
  return (
    <main className="grid min-h-dvh place-items-center bg-chalk px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between"><Logo /><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">MODE TEST</span></div>
        <p className="mt-6 text-sm text-muted">{p.kind === "LICENSE" ? `Licence ${p.registration?.season} – ${p.registration?.child.firstName} ${p.registration?.child.lastName}` : `Commande ${p.order?.number}`}</p>
        <p className="font-display text-4xl font-black">{formatEUR(inst.amountCents)}</p>
        <p className="text-sm text-muted">Échéance {inst.index}/{p.installmentsCount} · {p.club.name}</p>
        <div className="mt-4 rounded-xl bg-chalk p-3 text-xs">
          <p className="font-bold">Répartition automatique (Stripe Connect)</p>
          <div className="mt-1 flex justify-between"><span>Versé au club</span><span>{formatEUR(inst.clubAmountCents)}</span></div>
          <div className="flex justify-between"><span>Frais LICENGO</span><span>{formatEUR(inst.platformFeeCents)}</span></div>
        </div>
        {inst.status === "PAID" ? <p className="mt-6 text-sm font-semibold text-pitch-700">Cette échéance est déjà payée.</p> : <SimulationForm installmentId={inst.id} />}
        <p className="mt-6 flex items-center justify-center gap-1 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5" /> En production : page de paiement hébergée Stripe (3-D Secure, PCI-DSS)</p>
      </Card>
    </main>
  );
}
