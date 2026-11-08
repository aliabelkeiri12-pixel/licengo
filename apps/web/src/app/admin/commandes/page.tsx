import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { Card, PageHeader, OrderBadge, formatDate } from "@/components/ui";

export const metadata = { title: "Commandes boutique" };

export default async function AdminOrders() {
  const orders = await prisma.shopOrder.findMany({ include: { club: true, user: true, _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
  const paid = orders.filter((o) => !["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(o.status));
  return (
    <>
      <PageHeader title="Commandes boutique" subtitle={`${paid.length} commandes payées · ${formatEUR(paid.reduce((s, o) => s + o.subtotalCents, 0))} de ventes · ${formatEUR(paid.reduce((s, o) => s + o.platformFeeCents, 0))} de commissions`} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3">N°</th><th className="p-3">Date</th><th className="p-3">Club</th><th className="p-3">Client</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Commission</th><th className="p-3">Statut</th></tr></thead>
          <tbody className="divide-y divide-line">{orders.map((o) => <tr key={o.id}><td className="p-3 font-mono text-xs">{o.number}</td><td className="p-3 text-xs">{formatDate(o.createdAt)}</td><td className="p-3">{o.club.name}</td><td className="p-3">{o.user.firstName} {o.user.lastName}</td><td className="p-3 text-right">{formatEUR(o.subtotalCents)}</td><td className="p-3 text-right">{formatEUR(o.platformFeeCents)}</td><td className="p-3"><OrderBadge status={o.status} /></td></tr>)}</tbody>
        </table>
      </Card>
    </>
  );
}
