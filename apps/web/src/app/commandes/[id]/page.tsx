import { notFound } from "next/navigation";
import { formatEUR, ORDER_FLOW, ORDER_STATUS_LABELS } from "@licengo/core";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { Alert, Card, PageHeader, OrderBadge, Button, cx } from "@/components/ui";
import { payOrderAction, cancelOrderAction } from "@/app/actions/family";

export default async function Order({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paiement?: string }> }) {
  const u = await requireUser();
  const { paiement } = await searchParams;
  const o = await prisma.shopOrder.findUnique({ where: { id: (await params).id }, include: { items: true, club: true } });
  if (!o || o.userId !== u.id) notFound();
  const step = ORDER_FLOW.indexOf(o.status as never);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={o.club.name} title={`Commande ${o.number}`} action={<OrderBadge status={o.status} />} />
      {paiement === "ok" && <div className="mb-4"><Alert tone="success">Paiement reçu ! Le club prépare votre commande.</Alert></div>}
      {step >= 0 && (
        <ol className="mb-6 grid grid-cols-4 gap-2">
          {ORDER_FLOW.map((s, i) => <li key={s} className="text-center"><div className={cx("h-1.5 rounded-full", i <= step ? "bg-pitch-600" : "bg-line")} /><p className={cx("mt-2 text-[11px] font-semibold", i <= step ? "text-pitch-800" : "text-muted")}>{ORDER_STATUS_LABELS[s]}</p></li>)}
        </ol>
      )}
      <Card className="divide-y divide-line">
        {o.items.map((i) => <div key={i.id} className="flex justify-between p-4 text-sm"><span><b>{i.productName}</b> · {i.size} × {i.quantity}{i.personalization ? ` · « ${i.personalization} »` : ""}</span><span>{formatEUR(i.unitPriceCents * i.quantity)}</span></div>)}
        <div className="flex justify-between p-4 font-bold"><span>Total</span><span>{formatEUR(o.subtotalCents)}</span></div>
      </Card>
      {o.trackingNumber && <p className="mt-3 text-sm">Suivi : <b>{o.trackingNumber}</b></p>}
      {o.status === "PENDING_PAYMENT" && (
        <div className="mt-4 flex gap-3">
          <form action={payOrderAction}><input type="hidden" name="orderId" value={o.id} /><Button variant="volt">Payer {formatEUR(o.subtotalCents)}</Button></form>
          <form action={cancelOrderAction}><input type="hidden" name="orderId" value={o.id} /><Button variant="outline">Annuler</Button></form>
        </div>
      )}
    </div>
  );
}
