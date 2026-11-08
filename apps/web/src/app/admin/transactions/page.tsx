import { formatEUR } from "@licengo/core";
import type { InstallmentStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { Card, PageHeader, Badge, Select, Button, formatDateTime } from "@/components/ui";

export const metadata = { title: "Transactions" };

export default async function Transactions({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut } = await searchParams;
  const list = await prisma.installment.findMany({ where: { payment: { status: { notIn: ["PENDING", "CANCELLED"] } }, ...(statut ? { status: statut as InstallmentStatus } : {}) }, include: { payment: { include: { club: true } } }, orderBy: { updatedAt: "desc" }, take: 300 });
  const totals = list.reduce((s, i) => (i.status === "PAID" ? { gross: s.gross + i.amountCents, club: s.club + i.clubAmountCents, fee: s.fee + i.platformFeeCents } : s), { gross: 0, club: 0, fee: 0 });
  return (
    <>
      <PageHeader title="Transactions" subtitle={`Payé : ${formatEUR(totals.gross)} · versé aux clubs ${formatEUR(totals.club)} · frais LICENGO ${formatEUR(totals.fee)}`} />
      <form className="mb-4 flex gap-2"><Select name="statut" defaultValue={statut ?? ""} className="w-48"><option value="">Tous statuts</option>{["PAID", "SCHEDULED", "FAILED", "REFUNDED", "CANCELLED"].map((s) => <option key={s}>{s}</option>)}</Select><Button variant="outline">Filtrer</Button></form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3">Date</th><th className="p-3">Club</th><th className="p-3">Type</th><th className="p-3">Éch.</th><th className="p-3 text-right">Brut</th><th className="p-3 text-right">Club</th><th className="p-3 text-right">LICENGO</th><th className="p-3">Statut</th><th className="p-3">Réf. prestataire</th><th className="p-3">Paiement</th></tr></thead>
          <tbody className="divide-y divide-line">{list.map((i) => (
            <tr key={i.id}><td className="p-3 text-xs">{formatDateTime(i.paidAt ?? i.dueDate)}</td><td className="p-3">{i.payment.club.name}</td><td className="p-3">{i.payment.kind === "LICENSE" ? "Licence" : "Boutique"}</td><td className="p-3">{i.index}/{i.payment.installmentsCount}</td><td className="p-3 text-right tabular-nums">{formatEUR(i.amountCents)}</td><td className="p-3 text-right tabular-nums">{formatEUR(i.clubAmountCents)}</td><td className="p-3 text-right font-semibold tabular-nums">{formatEUR(i.platformFeeCents)}</td><td className="p-3"><Badge tone={i.status === "PAID" ? "green" : i.status === "FAILED" ? "red" : "gray"}>{i.status}</Badge></td><td className="p-3 font-mono text-[11px] text-muted">{i.providerPaymentIntentId ?? "—"}</td><td className="p-3 font-mono text-[11px]">{i.paymentId}</td></tr>
          ))}</tbody>
        </table>
      </Card>
    </>
  );
}
