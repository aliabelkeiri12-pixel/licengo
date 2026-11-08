import Link from "next/link";
import { Download } from "lucide-react";
import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { currentSeason } from "@/server/services/registrations";
import { Card, PageHeader, PaymentBadge, EmptyState, formatDate, buttonClass } from "@/components/ui";

export const metadata = { title: "Licenciés" };

export default async function Members() {
  const { clubId } = await clubContext();
  const season = currentSeason();
  const regs = await prisma.registration.findMany({ where: { clubId, season, status: "VALIDATED" }, include: { child: { include: { family: { include: { guardians: { take: 1 } } } } }, category: true }, orderBy: [{ category: { birthYearMax: "desc" } }, { child: { lastName: "asc" } }] });
  return (
    <>
      <PageHeader title="Licenciés validés" subtitle={`${regs.length} licenciés · saison ${season}`} action={<a href="/api/club/export" className={buttonClass("outline")}><Download className="h-4 w-4" /> Export CSV (Footclubs / Excel)</a>} />
      {regs.length === 0 ? <EmptyState title="Aucun licencié validé" text="Les dossiers validés apparaissent ici." /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3">Nom</th><th className="p-3">Catégorie</th><th className="p-3">Naissance</th><th className="p-3">N° licence</th><th className="p-3">Contact</th><th className="p-3">Paiement</th></tr></thead>
            <tbody className="divide-y divide-line">{regs.map((r) => (
              <tr key={r.id} className="hover:bg-chalk"><td className="p-3"><Link href={`/club/dossiers/${r.id}`} className="font-semibold hover:underline">{r.child.lastName.toUpperCase()} {r.child.firstName}</Link></td><td className="p-3">{r.category.name}</td><td className="p-3">{formatDate(r.child.birthDate)}</td><td className="p-3 font-mono text-xs">{r.federationLicenseNumber ?? "—"}</td><td className="p-3 text-xs">{r.child.family.guardians[0]?.phone}</td><td className="p-3"><PaymentBadge status={r.paymentStatus} /></td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}
    </>
  );
}
