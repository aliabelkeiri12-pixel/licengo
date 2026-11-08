import Link from "next/link";
import { ArrowRight, AlertTriangle, CreditCard, Sparkles } from "lucide-react";
import { formatEUR, REGISTRATION_STATUS_LABELS } from "@licengo/core";
import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { clubStats } from "@/server/services/stats";
import { currentSeason } from "@/server/services/registrations";
import { Alert, Card, PageHeader, StatCard, LinkButton, RegistrationBadge, formatDate } from "@/components/ui";

export const metadata = { title: "Tableau de bord club" };

export default async function ClubHome({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { clubId } = await clubContext();
  const { bienvenue } = await searchParams;
  const season = currentSeason();
  const [club, s, recent, categories] = await Promise.all([
    prisma.club.findUniqueOrThrow({ where: { id: clubId } }),
    clubStats(clubId, season),
    prisma.registration.findMany({ where: { clubId, season, status: { in: ["SUBMITTED", "TO_FIX", "INCOMPLETE"] } }, include: { child: true, category: true }, orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.category.findMany({ where: { clubId, season }, include: { _count: { select: { registrations: { where: { status: { notIn: ["CANCELLED", "REJECTED"] } } } } } }, orderBy: { birthYearMax: "desc" } }),
  ]);
  const max = Math.max(1, ...categories.map((c) => c._count.registrations));
  return (
    <>
      <PageHeader eyebrow={`Saison ${season}`} title="Tableau de bord" subtitle="Vue d'ensemble des inscriptions, paiements et boutique." action={<LinkButton href="/club/dossiers?statut=SUBMITTED" variant="volt">Valider les dossiers <ArrowRight className="h-4 w-4" /></LinkButton>} />
      {bienvenue && <div className="mb-4"><Alert tone="success"><Sparkles className="mr-1 inline h-4 w-4" /> Bienvenue sur LICENGO ! Étapes : 1) créez vos catégories, 2) activez les paiements, 3) partagez le lien de votre club.</Alert></div>}
      {club.status === "PENDING" && <div className="mb-4"><Alert tone="warning">Votre club est en cours de vérification par LICENGO (affiliation fédérale). Les familles pourront s'inscrire dès l'activation.</Alert></div>}
      {!club.stripeChargesEnabled && <div className="mb-4"><Alert tone="info"><CreditCard className="mr-1 inline h-4 w-4" /> Activez les paiements en ligne pour recevoir les cotisations directement sur le compte du club. <Link href="/club/parametres" className="font-semibold underline">Activer</Link></Alert></div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard tone="dark" label="Licenciés" value={s.total} hint={`${s.validated} validés`} />
        <StatCard label="À valider" value={s.toValidate} hint="Dossiers complets" />
        <StatCard label="Incomplets / à corriger" value={s.incomplete + s.toFix} hint="Relances automatiques actives" />
        <StatCard label="Encaissé" value={formatEUR(s.revenueCents)} hint={`${formatEUR(s.upcomingCents)} à venir`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-5">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">Dossiers à traiter</h2><Link href="/club/dossiers" className="text-sm font-semibold text-pitch-700">Tout voir</Link></div>
          {recent.length === 0 ? <p className="mt-4 text-sm text-muted">Rien à traiter 🎉</p> : (
            <ul className="mt-3 divide-y divide-line">
              {recent.map((r) => (
                <li key={r.id}><Link href={`/club/dossiers/${r.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-chalk">
                  <div className="min-w-0"><p className="text-sm font-semibold">{r.child.lastName.toUpperCase()} {r.child.firstName} <span className="font-normal text-muted">· {r.category.name}</span></p><p className="truncate text-xs text-muted">{r.missingSummary[0] ?? "Dossier complet"} · maj {formatDate(r.updatedAt)}</p></div>
                  <RegistrationBadge status={r.status} />
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold">Effectifs par catégorie</h2>
            <ul className="mt-4 space-y-2.5">
              {categories.map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="flex justify-between"><span className="font-semibold">{c.name}</span><span className="tabular-nums text-muted">{c._count.registrations}{c.capacity ? ` / ${c.capacity}` : ""}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-pitch-50"><div className="h-2 rounded-full bg-pitch-600" style={{ width: `${(c._count.registrations / (c.capacity ?? max)) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold">Paiements</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {(["PAID", "PARTIAL", "UNPAID", "LATE"] as const).map((k) => <div key={k} className="rounded-xl bg-chalk p-3"><dt className="text-xs text-muted">{{ PAID: "Soldés", PARTIAL: "En cours", UNPAID: "Non payés", LATE: "Impayés" }[k]}</dt><dd className={`font-display text-xl font-extrabold ${k === "LATE" && s.byPayment[k] ? "text-danger" : ""}`}>{s.byPayment[k] ?? 0}</dd></div>)}
            </dl>
            {(s.byPayment.LATE ?? 0) > 0 && <Link href="/club/paiements" className="mt-3 flex items-center gap-1 text-sm font-semibold text-danger"><AlertTriangle className="h-4 w-4" /> Voir les impayés</Link>}
            <p className="mt-3 text-xs text-muted">Boutique : {s.shopOrders} commandes · {formatEUR(s.shopRevenueCents)}</p>
          </Card>
          <p className="text-xs text-muted">Statuts : {Object.entries(s.byStatus).map(([k, v]) => `${REGISTRATION_STATUS_LABELS[k as keyof typeof REGISTRATION_STATUS_LABELS]} ${v}`).join(" · ")}</p>
        </div>
      </div>
    </>
  );
}
