import { Download, Printer } from "lucide-react";
import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { familyUser } from "@/lib/guards";
import { Card, PageHeader, EmptyState, formatDate } from "@/components/ui";

export const metadata = { title: "Mes factures" };

/** All the family's invoices, ready to print or download (PDF). */
export default async function FacturesPage() {
  const u = await familyUser();
  const invoices = await prisma.invoice.findMany({ where: { payerId: u.id }, include: { payment: { include: { club: true, registration: { include: { child: true } }, order: true } } }, orderBy: { issuedAt: "desc" } });
  return (
    <>
      <PageHeader title="Mes factures" subtitle="Une facture par licence, mise à jour à chaque échéance. Imprimez-la ou téléchargez-la (PDF)." />
      {invoices.length === 0 ? <EmptyState title="Aucune facture pour l'instant" text="Votre facture apparaîtra ici dès votre premier paiement." /> : (
        <ul className="space-y-3" data-testid="factures">
          {invoices.map((i) => (
            <li key={i.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{i.payment.registration ? `Licence ${i.payment.registration.season} – ${i.payment.registration.child.firstName}` : `Boutique – commande ${i.payment.order?.number ?? ""}`}</p>
                    <p className="text-sm text-muted">{i.payment.club.name} · {formatDate(i.issuedAt)} · n° {i.number}</p>
                  </div>
                  <p className="font-display text-lg font-bold tabular-nums">{formatEUR(i.amountCents)}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={`/api/invoices/${i.id}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-pitch-800 text-sm font-semibold text-white" data-testid="invoice-print"><Printer className="h-4 w-4" /> Imprimer</a>
                  <a href={`/api/invoices/${i.id}?dl=1`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-line text-sm font-semibold" data-testid="invoice-download"><Download className="h-4 w-4" /> Télécharger</a>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
