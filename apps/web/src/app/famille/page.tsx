import Link from "next/link";
import { ArrowRight, Plus, AlertTriangle, CalendarClock, RefreshCw } from "lucide-react";
import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { familyUser } from "@/lib/guards";
import { currentSeason } from "@/server/services/registrations";
import { Card, LinkButton, PageHeader, RegistrationBadge, PaymentBadge, Progress, EmptyState, formatDate, Alert } from "@/components/ui";

export const metadata = { title: "Mon espace famille" };

export default async function FamilyHome() {
  const user = await familyUser();
  const season = currentSeason();
  const children = await prisma.child.findMany({
    where: { familyId: user.familyId, deletedAt: null },
    include: { registrations: { include: { club: true, category: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { birthDate: "asc" },
  });
  const upcoming = await prisma.installment.findMany({
    where: { status: { in: ["SCHEDULED", "FAILED"] }, payment: { payerId: user.id, status: { in: ["ACTIVE", "FAILED"] } } },
    include: { payment: { include: { club: true } } }, orderBy: { dueDate: "asc" }, take: 4,
  });
  const todo = children.flatMap((c) => c.registrations.filter((r) => ["DRAFT", "INCOMPLETE", "TO_FIX"].includes(r.status)).map((r) => ({ c, r })));
  const renewals = children.flatMap((c) => c.registrations.filter((r) => r.status === "VALIDATED" && r.season < season && !c.registrations.some((x) => x.season === season && x.clubId === r.clubId)).map((r) => ({ c, r })));

  return (
    <>
      <PageHeader eyebrow={`Saison ${season}`} title={`Bonjour ${user.firstName} 👋`} subtitle="Retrouvez ici les dossiers, paiements et actualités de votre famille." action={<LinkButton href="/clubs" variant="volt">Inscrire un enfant <ArrowRight className="h-4 w-4" /></LinkButton>} />

      {todo.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60 p-5">
          <p className="flex items-center gap-2 font-bold text-amber-900"><AlertTriangle className="h-4 w-4" /> {todo.length} dossier{todo.length > 1 ? "s" : ""} à compléter</p>
          <ul className="mt-3 space-y-2">
            {todo.map(({ c, r }) => (
              <li key={r.id}>
                <Link href={`/famille/inscriptions/${r.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm ring-1 ring-amber-200 hover:ring-amber-300">
                  <span><b>{c.firstName}</b> · {r.club.name} — <span className="text-muted">{r.missingSummary[0] ?? "Finaliser et envoyer"}</span></span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {renewals.map(({ c, r }) => (
        <div key={r.id} className="mb-4"><Alert tone="info"><RefreshCw className="mr-1 inline h-4 w-4" /> Renouvelez la licence de <b>{c.firstName}</b> chez {r.club.name} pour {season}. <Link href={`/famille/inscriptions/${r.id}`} className="font-semibold underline">Renouveler</Link></Alert></div>
      ))}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-bold">Mes enfants & licences</h2><Link href="/famille/enfants/nouveau" className="inline-flex items-center gap-1 text-sm font-semibold text-pitch-700"><Plus className="h-4 w-4" /> Ajouter</Link></div>
          {children.length === 0 ? (
            <EmptyState title="Ajoutez votre premier enfant" text="Ses informations seront réutilisées pour toutes ses inscriptions, chaque saison." action={<LinkButton href="/famille/enfants/nouveau">Ajouter un enfant</LinkButton>} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {children.map((c) => {
                const r = c.registrations[0];
                return (
                  <Card key={c.id} className="p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-pitch-800 font-display text-lg font-bold text-volt-400">{c.firstName[0]}</span>
                      <div><Link href={`/famille/enfants/${c.id}`} className="font-bold hover:underline">{c.firstName} {c.lastName}</Link><p className="text-xs text-muted">Né{c.gender === "F" ? "e" : ""} le {formatDate(c.birthDate)}</p></div>
                    </div>
                    {r ? (
                      <Link href={`/famille/inscriptions/${r.id}`} className="mt-4 block rounded-xl bg-chalk p-3 hover:bg-pitch-50">
                        <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{r.club.name}</p><RegistrationBadge status={r.status} /></div>
                        <p className="mt-0.5 text-xs text-muted">{r.category.name} · {r.season}</p>
                        <div className="mt-3"><Progress value={r.progress} /></div>
                        <div className="mt-2 flex items-center justify-between text-xs"><span className="text-muted">Dossier {r.progress}%</span><PaymentBadge status={r.paymentStatus} /></div>
                      </Link>
                    ) : (
                      <LinkButton href={`/clubs?enfant=${c.id}`} variant="outline" className="mt-4 w-full">Trouver un club</LinkButton>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold"><CalendarClock className="h-4 w-4 text-pitch-700" /> Prochaines échéances</h2>
            {upcoming.length === 0 ? <p className="mt-3 text-sm text-muted">Aucune échéance à venir.</p> : (
              <ul className="mt-3 divide-y divide-line text-sm">
                {upcoming.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2.5">
                    <span><span className="font-semibold">{formatDate(i.dueDate)}</span><br /><span className="text-xs text-muted">{i.payment.club.name} · {i.index}/{i.payment.installmentsCount}</span></span>
                    <span className={i.status === "FAILED" ? "font-bold text-danger" : "font-semibold"}>{formatEUR(i.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/famille/paiements" className="mt-3 inline-block text-sm font-semibold text-pitch-700">Tous mes paiements →</Link>
          </Card>
          <Card className="bg-pitch-900 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-wider text-volt-400">Boutique</p>
            <p className="font-display mt-1 text-lg font-bold">Équipez-vous aux couleurs du club</p>
            <p className="mt-1 text-sm text-white/70">Maillots, survêtements, parkas – retrait au club.</p>
            {children.flatMap((c) => c.registrations).slice(0, 1).map((r) => <LinkButton key={r.id} href={`/boutique/${r.club.slug}`} variant="volt" size="sm" className="mt-4">Boutique {r.club.name}</LinkButton>)}
          </Card>
        </aside>
      </div>
    </>
  );
}
