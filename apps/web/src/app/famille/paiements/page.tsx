import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { familyUser } from "@/lib/guards";
import { Alert, Card, PageHeader, EmptyState, Badge, formatDate } from "@/components/ui";
import { InstallmentsTable } from "@/components/installments-table";

export const metadata = { title: "Mes paiements" };

export default async function Payments({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const u = await familyUser();
  const { paiement } = await searchParams;
  const payments = await prisma.payment.findMany({
    where: { payerId: u.id, status: { notIn: ["PENDING", "CANCELLED"] } },
    include: { installments: { orderBy: { index: "asc" } }, refunds: true, club: true, registration: { include: { child: true } }, order: true },
    orderBy: { createdAt: "desc" },
  });
  const paid = payments.flatMap((p) => p.installments).filter((i) => i.status === "PAID").reduce((s, i) => s + i.amountCents, 0);
  const due = payments.filter((p) => ["ACTIVE", "FAILED"].includes(p.status)).flatMap((p) => p.installments).filter((i) => ["SCHEDULED", "FAILED"].includes(i.status)).reduce((s, i) => s + i.amountCents, 0);
  return (
    <>
      <PageHeader title="Paiements" subtitle={`Payé : ${formatEUR(paid)} · Reste à payer : ${formatEUR(due)}`} />
      {paiement === "ok" && <div className="mb-4"><Alert tone="success">Paiement confirmé.</Alert></div>}
      {payments.length === 0 ? <EmptyState title="Aucun paiement" text="Vos licences et commandes réglées apparaîtront ici." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {payments.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-bold">{p.kind === "LICENSE" ? `Licence ${p.registration?.season} – ${p.registration?.child.firstName}` : `Commande ${p.order?.number}`}</p><p className="text-xs text-muted">{p.club.name} · {formatDate(p.createdAt)}</p></div>
                <Badge tone={p.status === "COMPLETED" ? "green" : p.status === "FAILED" ? "red" : p.status === "REFUNDED" ? "amber" : "blue"}>{{ ACTIVE: "En cours", COMPLETED: "Soldé", FAILED: "Impayé", REFUNDED: "Remboursé", PENDING: "", CANCELLED: "" }[p.status]}</Badge>
              </div>
              <p className="mt-2 text-sm">Total <b>{formatEUR(p.totalCents)}</b> <span className="text-muted">(dont frais LICENGO {formatEUR(p.platformFeeCents)})</span></p>
              <div className="mt-3"><InstallmentsTable installments={p.installments} total={p.installmentsCount} canRetry /></div>
              {p.refunds.length > 0 && <p className="mt-2 text-xs text-amber-800">Remboursé : {formatEUR(p.refunds.reduce((s, r) => s + r.amountCents, 0))}</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
