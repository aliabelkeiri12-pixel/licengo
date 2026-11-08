import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { ageAt } from "@licengo/core";
import { prisma } from "@/server/db";
import { familyUser } from "@/lib/guards";
import { Card, LinkButton, PageHeader, EmptyState, RegistrationBadge } from "@/components/ui";

export const metadata = { title: "Mes enfants" };

export default async function Children() {
  const u = await familyUser();
  const children = await prisma.child.findMany({ where: { familyId: u.familyId, deletedAt: null }, include: { registrations: { include: { club: true }, orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { documents: { where: { deletedAt: null } } } } }, orderBy: { birthDate: "asc" } });
  return (
    <>
      <PageHeader title="Membres de la famille" subtitle="Enfants et adultes licenciés" action={<LinkButton href="/famille/enfants/nouveau"><Plus className="h-4 w-4" /> Ajouter</LinkButton>} />
      {children.length === 0 ? <EmptyState title="Aucun membre" action={<LinkButton href="/famille/enfants/nouveau">Ajouter un enfant</LinkButton>} /> : (
        <Card className="divide-y divide-line">
          {children.map((c) => (
            <Link key={c.id} href={`/famille/enfants/${c.id}`} className="flex items-center gap-4 p-4 hover:bg-chalk">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-pitch-800 font-display font-bold text-volt-400">{c.firstName[0]}</span>
              <div className="min-w-0 flex-1"><p className="font-semibold">{c.firstName} {c.lastName}</p><p className="text-xs text-muted">{ageAt(c.birthDate)} ans · {c._count.documents} document(s){c.registrations[0] ? ` · ${c.registrations[0].club.name}` : ""}</p></div>
              {c.registrations[0] && <RegistrationBadge status={c.registrations[0].status} />}
              <ChevronRight className="h-4 w-4 text-muted" />
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
