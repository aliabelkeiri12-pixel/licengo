import Link from "next/link";
import { Download, FileText, AlertTriangle, CalendarClock } from "lucide-react";
import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { familyUser } from "@/lib/guards";
import { Alert, Card, PageHeader, EmptyState, Badge, StatCard, formatDate, LinkButton } from "@/components/ui";
import { InstallmentsTable } from "@/components/installments-table";

export const metadata = { title: "Mes paiements" };

const planStatus = { ACTIVE: ["En cours", "blue"], COMPLETED: ["Soldé", "green"], FAILED: ["Impayé", "red"], REFUNDED: ["Remboursé", "amber"], PENDING: ["", "gray"], CANCELLED: ["", "gray"] } as const;

export default async function Payments({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const u = await familyUser();
  const { paiement } = await searchParams;
  const [payments, invoices] = await Promise.all([
    prisma.payment.findMany({
      where: { payerId: u.id, status: { notIn: ["PENDING", "CANCELLED"] } },
      include: { installments: { orderBy: { index: "asc" } }, refunds: true, club: true, registration: { include: { child: true, category: true } }, order: true, invoices: { orderBy: { issuedAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({ where: { payerId: u.id }, include: { payment: { include: { club: true, registration: { include: { child: true } }, order: true } } }, orderBy: { issuedAt: "desc" } }),
  ]);
  const all = payments.flatMap((p) => p.installments.map((i) => ({ ...i, p })));
  const paid = all.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amountCents, 0);
  const open = all.filter((i) => ["SCHEDULED", "FAILED"].includes(i.status) && ["ACTIVE", "FAILED"].includes(i.p.status));
  const due = open.reduce((s, i) => s + i.amountCents, 0);
  const failed = open.filter((i) => i.status === "FAILED");
  const next = open.filter((i) => i.status === "SCHEDULED").sort((a, b) => +a.dueDate - +b.dueDate)[0];
  const object = (p: (typeof payments)[number] | (typeof invoices)[number]["payment"]) =>
    p.registration ? `Licence ${p.registration.season} – ${p.registration.child.firstName}` : `Boutique – commande ${p.order?.number ?? ""}`;

  return (
    <>
      <PageHeader eyebrow="Espace famille" title="Mes paiements" subtitle="Échéances, factures et historique de tous vos règlements." />
      {paiement === "ok" && <div className="mb-4"><Alert tone="success">Paiement confirmé. Votre reçu et vos factures vous ont été envoyés par email.</Alert></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="dark" label="Total payé" value={formatEUR(paid)} />
        <StatCard label="Reste à payer" value={formatEUR(due)} hint={`${open.length} échéance(s)`} />
        <StatCard label="Prochaine échéance" value={next ? formatEUR(next.amountCents) : "—"} hint={next ? `le ${formatDate(next.dueDate)}` : "Aucune"} />
        <StatCard label="Factures" value={invoices.length} hint="téléchargeables en PDF" />
      </div>

      {failed.length > 0 && (
        <Card className="mt-6 border-red-200 bg-red-50/50 p-5">
          <p className="flex items-center gap-2 font-bold text-danger"><AlertTriangle className="h-4 w-4" /> {failed.length} échéance(s) impayée(s)</p>
          <p className="mt-1 text-sm text-muted">Régularisez avec une autre carte pour éviter le prélèvement du solde et conserver l'inscription.</p>
        </Card>
      )}

      {payments.length === 0 ? (
        <div className="mt-6"><EmptyState title="Aucun paiement pour l'instant" text="Vos licences et commandes réglées apparaîtront ici, avec leurs factures." action={<LinkButton href="/clubs">Trouver un club</LinkButton>} /></div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {payments.map((p) => {
            const [label, tone] = planStatus[p.status];
            return (
              <Card key={p.id} className="p-5" data-testid="payment-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{object(p)}</p>
                    <p className="text-xs text-muted">{p.club.name} · {p.installmentsCount > 1 ? `${p.installmentsCount}× sans frais` : "comptant"} · {formatDate(p.createdAt)}</p>
                  </div>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                <p className="mt-2 text-sm">Total <b>{formatEUR(p.totalCents)}</b> <span className="text-muted">dont cotisation club {formatEUR(p.clubAmountCents)} et frais LICENGO {formatEUR(p.platformFeeCents)}</span></p>
                <div className="mt-3"><InstallmentsTable installments={p.installments} total={p.installmentsCount} canRetry /></div>
                {p.balanceClauseAcceptedAt && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted"><CalendarClock className="h-3 w-3" /> Clause de prélèvement du solde acceptée le {formatDate(p.balanceClauseAcceptedAt)}{p.balanceClaimedAt ? ` · solde réclamé le ${formatDate(p.balanceClaimedAt)}` : ""}</p>}
                {p.refunds.length > 0 && <p className="mt-2 text-xs text-amber-800">Remboursé : {formatEUR(p.refunds.reduce((s, r) => s + r.amountCents, 0))}</p>}
                {p.invoices.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.invoices.map((i) => (
                      <a key={i.id} href={`/api/invoices/${i.id}?dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-pitch-50" data-testid="invoice-link">
                        <Download className="h-3.5 w-3.5" /> {i.issuer === "CLUB" ? "Facture club" : "Facture LICENGO"} {i.number}
                      </a>
                    ))}
                  </div>
                )}
                {p.registration && <Link href={`/famille/inscriptions/${p.registrationId}`} className="mt-3 inline-block text-xs font-semibold text-pitch-700">Voir le dossier →</Link>}
              </Card>
            );
          })}
        </div>
      )}

      {invoices.length > 0 && (
        <>
          <h2 className="font-display mb-3 mt-8 text-lg font-bold">Toutes mes factures</h2>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3">N°</th><th className="p-3">Date</th><th className="p-3">Émetteur</th><th className="p-3">Objet</th><th className="p-3 text-right">Montant</th><th className="p-3"></th></tr></thead>
              <tbody className="divide-y divide-line">
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="p-3 font-mono text-xs">{i.number}</td>
                    <td className="p-3">{formatDate(i.issuedAt)}</td>
                    <td className="p-3">{i.issuer === "CLUB" ? i.payment.club.name : "LICENGO"}</td>
                    <td className="p-3 text-muted">{object(i.payment)}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{formatEUR(i.amountCents)}</td>
                    <td className="p-3 text-right"><a href={`/api/invoices/${i.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-pitch-700"><FileText className="h-4 w-4" /> PDF</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
