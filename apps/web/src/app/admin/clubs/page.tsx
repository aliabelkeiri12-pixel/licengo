import { prisma } from "@/server/db";
import { Card, PageHeader, Badge, Select, Button, Input, formatDate } from "@/components/ui";
import { setClubStatusAction, setClubPlanAction } from "@/app/actions/admin";

export const metadata = { title: "Clubs" };

export default async function AdminClubs({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string }> }) {
  const sp = await searchParams;
  const [clubs, plans] = await Promise.all([
    prisma.club.findMany({ where: { ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { city: { contains: sp.q, mode: "insensitive" } }] } : {}), ...(sp.statut ? { status: sp.statut as never } : {}) }, include: { sport: true, plan: true, _count: { select: { registrations: true, staff: true } } }, orderBy: [{ status: "asc" }, { name: "asc" }] }),
    prisma.plan.findMany({ orderBy: { monthlyPriceCents: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Clubs" subtitle={`${clubs.length} club(s)`} />
      <form className="mb-4 flex gap-2"><Input name="q" defaultValue={sp.q} placeholder="Nom ou ville" className="max-w-xs" /><Select name="statut" defaultValue={sp.statut ?? ""} className="w-44"><option value="">Tous statuts</option><option value="PENDING">En attente</option><option value="ACTIVE">Actifs</option><option value="SUSPENDED">Suspendus</option></Select><Button variant="outline">Filtrer</Button></form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3">Club</th><th className="p-3">Affiliation</th><th className="p-3">Licences</th><th className="p-3">Paiements</th><th className="p-3">Offre</th><th className="p-3">Statut</th></tr></thead>
          <tbody className="divide-y divide-line">{clubs.map((c) => (
            <tr key={c.id}>
              <td className="p-3"><p className="font-semibold">{c.name}</p><p className="text-xs text-muted">{c.sport.emoji} {c.postalCode} {c.city} · créé le {formatDate(c.createdAt)}</p></td>
              <td className="p-3 font-mono text-xs">{c.federationNumber ?? "—"}</td>
              <td className="p-3">{c._count.registrations}</td>
              <td className="p-3">{c.stripeChargesEnabled ? <Badge tone="green">Stripe actif</Badge> : <Badge tone="amber">Non connecté</Badge>}</td>
              <td className="p-3"><form action={setClubPlanAction} className="flex gap-1"><input type="hidden" name="clubId" value={c.id} /><Select name="planId" defaultValue={c.planId ?? ""} className="h-9 w-32 text-sm">{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><Button size="sm" variant="outline">OK</Button></form></td>
              <td className="p-3"><form action={setClubStatusAction} className="flex gap-1"><input type="hidden" name="clubId" value={c.id} /><Select name="status" defaultValue={c.status} className="h-9 w-32 text-sm"><option value="PENDING">En attente</option><option value="ACTIVE">Actif</option><option value="SUSPENDED">Suspendu</option></Select><Button size="sm" variant="outline">OK</Button></form></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </>
  );
}
