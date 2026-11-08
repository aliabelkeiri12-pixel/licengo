import { prisma } from "@/server/db";
import { familyUser } from "@/lib/guards";
import { Card, PageHeader } from "@/components/ui";
import { AccountForms } from "./forms";

export const metadata = { title: "Mon compte" };

export default async function Account() {
  const u = await familyUser();
  const family = await prisma.family.findUniqueOrThrow({ where: { id: u.familyId } });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Mon compte" subtitle={u.email} />
      <AccountForms user={{ firstName: u.firstName, lastName: u.lastName, phone: u.phone ?? "", marketing: u.marketingOptIn }} family={{ address: family.address ?? "", postalCode: family.postalCode ?? "", city: family.city ?? "" }} />
      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Mes données (RGPD)</h2>
        <p className="mt-1 text-sm text-muted">Téléchargez l'ensemble des données vous concernant au format JSON (droit d'accès et de portabilité).</p>
        <a href="/api/v1/me/export" className="mt-3 inline-block text-sm font-semibold text-pitch-700 underline">Exporter mes données</a>
      </Card>
    </div>
  );
}
