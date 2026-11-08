import Link from "next/link";
import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { Card, PageHeader, EmptyState, OrderBadge, formatDate } from "@/components/ui";

export const metadata = { title: "Mes commandes" };

export default async function Orders() {
  const u = await requireUser();
  const orders = await prisma.shopOrder.findMany({ where: { userId: u.id }, include: { club: true, _count: { select: { items: true } } }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Mes commandes" />
      {orders.length === 0 ? <EmptyState title="Aucune commande" /> : (
        <Card className="divide-y divide-line">
          {orders.map((o) => (
            <Link key={o.id} href={`/commandes/${o.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-chalk">
              <div><p className="font-semibold">{o.number}</p><p className="text-xs text-muted">{o.club.name} · {formatDate(o.createdAt)} · {o._count.items} article(s)</p></div>
              <div className="flex items-center gap-3"><span className="font-semibold">{formatEUR(o.subtotalCents)}</span><OrderBadge status={o.status} /></div>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
