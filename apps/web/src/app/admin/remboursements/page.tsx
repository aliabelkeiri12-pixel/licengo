import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { Card, PageHeader, Badge, Input, Field, formatDateTime } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { adminRefundAction } from "@/app/actions/admin";

export const metadata = { title: "Remboursements" };

export default async function Refunds() {
  const refunds = await prisma.refund.findMany({ include: { payment: { include: { club: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Remboursements" subtitle="Remboursement par carte, prélevé sur le compte du club (reverse transfer) et, si demandé, sur les frais LICENGO." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3">Date</th><th className="p-3">Club</th><th className="p-3 text-right">Montant</th><th className="p-3 text-right">Dont frais</th><th className="p-3">Motif</th><th className="p-3">Statut</th></tr></thead>
            <tbody className="divide-y divide-line">
              {refunds.length === 0 && <tr><td colSpan={6} className="p-4 text-muted">Aucun remboursement.</td></tr>}
              {refunds.map((r) => <tr key={r.id}><td className="p-3 text-xs">{formatDateTime(r.createdAt)}</td><td className="p-3">{r.payment.club.name}</td><td className="p-3 text-right font-semibold">{formatEUR(r.amountCents)}</td><td className="p-3 text-right">{formatEUR(r.feeCents)}</td><td className="p-3 text-xs">{r.reason}</td><td className="p-3"><Badge tone={r.status === "SUCCEEDED" ? "green" : r.status === "FAILED" ? "red" : "amber"}>{r.status}</Badge></td></tr>)}
            </tbody>
          </table>
        </Card>
        <Card className="h-fit p-5">
          <h2 className="font-display text-lg font-bold">Nouveau remboursement</h2>
          <ActionForm action={adminRefundAction} className="mt-3 space-y-3">
            <Field label="Identifiant du paiement" name="paymentId" hint="Visible dans Transactions"><Input name="paymentId" required /></Field>
            <Field label="Montant (€)" name="amount"><Input name="amount" inputMode="decimal" required /></Field>
            <Field label="Motif" name="reason"><Input name="reason" required /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="refundFee" className="accent-pitch-700" /> Rembourser aussi les frais LICENGO</label>
            <SubmitButton variant="danger">Rembourser</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
