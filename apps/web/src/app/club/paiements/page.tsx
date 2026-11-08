import Link from "next/link";
import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { Card, PageHeader, StatCard, Badge, formatDate, EmptyState } from "@/components/ui";

export const metadata = { title: "Paiements club" };

export default async function ClubPayments() {
  const { clubId } = await clubContext();
  const [paid, upcoming, failed, refunds, list] = await Promise.all([
    prisma.installment.aggregate({ where: { status: "PAID", payment: { clubId } }, _sum: { clubAmountCents: true }, _count: true }),
    prisma.installment.aggregate({ where: { status: "SCHEDULED", payment: { clubId, status: "ACTIVE" } }, _sum: { clubAmountCents: true }, _count: true }),
    prisma.installment.findMany({ where: { status: "FAILED", payment: { clubId } }, include: { payment: { include: { registration: { include: { child: true } } } } }, orderBy: { dueDate: "asc" } }),
    prisma.refund.aggregate({ where: { payment: { clubId }, status: "SUCCEEDED" }, _sum: { clubCents: true } }),
    prisma.installment.findMany({ where: { payment: { clubId, status: { notIn: ["PENDING", "CANCELLED"] } } }, include: { payment: { include: { registration: { include: { child: true } }, order: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }),
  ]);
  return (
    <>
      <PageHeader title="Paiements" subtitle="Versements automatiques sur le compte bancaire du club via Stripe Connect" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard tone="dark" label="Encaissé (net club)" value={formatEUR(paid._sum.clubAmountCents ?? 0)} hint={`${paid._count} paiements`} />
        <StatCard label="Échéances à venir" value={formatEUR(upcoming._sum.clubAmountCents ?? 0)} hint={`${upcoming._count} échéances`} />
        <StatCard label="Impayés" value={failed.length} hint={formatEUR(failed.reduce((s, i) => s + i.clubAmountCents, 0))} />
        <StatCard label="Remboursé" value={formatEUR(refunds._sum.clubCents ?? 0)} />
      </div>
      {failed.length > 0 && (
        <Card className="mt-6 border-red-200 p-5">
          <h2 className="font-display text-lg font-bold text-danger">Impayés à suivre</h2>
          <p className="text-xs text-muted">3 nouvelles tentatives automatiques à 3 jours d'intervalle ; la famille est notifiée à chaque échec.</p>
          <ul className="mt-3 divide-y divide-line text-sm">{failed.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2"><Link href={`/club/dossiers/${i.payment.registrationId}`} className="font-semibold hover:underline">{i.payment.registration?.child.lastName.toUpperCase()} {i.payment.registration?.child.firstName}</Link><span className="text-xs text-muted">Échéance {i.index} · {formatDate(i.dueDate)} · {i.attempts} tentative(s) · {i.failureReason}</span><span className="font-bold text-danger">{formatEUR(i.amountCents)}</span></li>
          ))}</ul>
        </Card>
      )}
      <h2 className="font-display mb-3 mt-8 text-lg font-bold">Dernières opérations</h2>
      {list.length === 0 ? <EmptyState title="Aucune opération" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3">Objet</th><th className="p-3">Échéance</th><th className="p-3">Date</th><th className="p-3 text-right">Brut</th><th className="p-3 text-right">Net club</th><th className="p-3">Statut</th></tr></thead>
            <tbody className="divide-y divide-line">{list.map((i) => (
              <tr key={i.id}><td className="p-3">{i.payment.kind === "LICENSE" ? `Licence ${i.payment.registration?.child.firstName} ${i.payment.registration?.child.lastName}` : `Boutique ${i.payment.order?.number}`}</td><td className="p-3">{i.index}/{i.payment.installmentsCount}</td><td className="p-3">{formatDate(i.paidAt ?? i.dueDate)}</td><td className="p-3 text-right tabular-nums">{formatEUR(i.amountCents)}</td><td className="p-3 text-right font-semibold tabular-nums">{formatEUR(i.clubAmountCents)}</td><td className="p-3"><Badge tone={i.status === "PAID" ? "green" : i.status === "FAILED" ? "red" : "gray"}>{i.status === "PAID" ? "Payé" : i.status === "FAILED" ? "Échec" : i.status === "SCHEDULED" ? "Programmé" : i.status.toLowerCase()}</Badge></td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </>
  );
}
