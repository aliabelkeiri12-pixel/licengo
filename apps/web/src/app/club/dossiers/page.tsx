import Link from "next/link";
import type { Prisma, RegistrationStatus } from "@prisma/client";
import { Search, Send } from "lucide-react";
import { prisma } from "@/server/db";
import { clubContext } from "@/lib/guards";
import { currentSeason } from "@/server/services/registrations";
import { Alert, Card, PageHeader, RegistrationBadge, PaymentBadge, Progress, Input, Select, Button, EmptyState, formatDate, cx } from "@/components/ui";
import { remindAction } from "@/app/actions/club";

export const metadata = { title: "Dossiers" };

const TABS: { key: string; label: string; statuses?: RegistrationStatus[] }[] = [
  { key: "SUBMITTED", label: "À valider", statuses: ["SUBMITTED"] },
  { key: "INCOMPLETE", label: "Incomplets", statuses: ["DRAFT", "INCOMPLETE"] },
  { key: "TO_FIX", label: "À corriger", statuses: ["TO_FIX"] },
  { key: "VALIDATED", label: "Validés", statuses: ["VALIDATED"] },
  { key: "ALL", label: "Tous" },
];

export default async function Files({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { clubId } = await clubContext();
  const sp = await searchParams;
  const season = sp.saison ?? currentSeason();
  const tab = TABS.find((t) => t.key === sp.statut) ?? TABS[0];
  const base: Prisma.RegistrationWhereInput = { clubId, season, status: { notIn: ["CANCELLED"] } };
  const where: Prisma.RegistrationWhereInput = { ...base, ...(tab.statuses ? { status: { in: tab.statuses } } : {}), ...(sp.categorie ? { categoryId: sp.categorie } : {}), ...(sp.paiement ? { paymentStatus: sp.paiement as never } : {}) };
  if (sp.q) where.child = { OR: [{ firstName: { contains: sp.q, mode: "insensitive" } }, { lastName: { contains: sp.q, mode: "insensitive" } }] };
  const [regs, counts, categories, seasons] = await Promise.all([
    prisma.registration.findMany({ where, include: { child: { include: { family: { include: { guardians: { take: 1 } } } } }, category: true }, orderBy: [{ updatedAt: "desc" }], take: 300 }),
    prisma.registration.groupBy({ by: ["status"], where: base, _count: true }),
    prisma.category.findMany({ where: { clubId, season }, orderBy: { birthYearMax: "desc" } }),
    prisma.registration.findMany({ where: { clubId }, distinct: ["season"], select: { season: true } }),
  ]);
  const count = (t: (typeof TABS)[number]) => counts.filter((c) => !t.statuses || t.statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);
  const qs = (k: string) => { const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]); q.set("statut", k); return `?${q}`; };
  return (
    <>
      <PageHeader title="Dossiers d'inscription" subtitle={`Saison ${season} · détection automatique des pièces manquantes et incohérences`} />
      {sp.relance && <div className="mb-4"><Alert tone="success">{sp.relance} relance(s) envoyée(s).</Alert></div>}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-line">
        {TABS.map((t) => <Link key={t.key} href={qs(t.key)} className={cx("shrink-0 rounded-lg px-3 py-2 text-sm font-semibold", t.key === tab.key ? "bg-pitch-800 text-white" : "text-muted hover:text-ink")}>{t.label} <span className="ml-1 opacity-70">{count(t)}</span></Link>)}
      </div>
      <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px_160px_140px_auto]">
        <input type="hidden" name="statut" value={tab.key} />
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" /><Input name="q" defaultValue={sp.q} placeholder="Rechercher un licencié" className="pl-9" /></div>
        <Select name="categorie" defaultValue={sp.categorie ?? ""}><option value="">Toutes catégories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select name="paiement" defaultValue={sp.paiement ?? ""}><option value="">Tous paiements</option><option value="PAID">Payé</option><option value="PARTIAL">En cours</option><option value="UNPAID">Non payé</option><option value="LATE">Impayé</option></Select>
        <Select name="saison" defaultValue={season}>{[...new Set([season, ...seasons.map((s) => s.season)])].map((s) => <option key={s}>{s}</option>)}</Select>
        <Button variant="outline">Filtrer</Button>
      </form>
      {regs.length === 0 ? <EmptyState title="Aucun dossier" text="Aucun dossier ne correspond à ces critères." /> : (
        <form action={remindAction}>
          {["INCOMPLETE", "TO_FIX"].includes(tab.key) && <div className="mb-3 flex justify-end"><Button variant="primary" size="sm"><Send className="h-4 w-4" /> Relancer la sélection (ou tous)</Button></div>}
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="w-8 p-3"></th><th className="p-3">Licencié</th><th className="p-3">Catégorie</th><th className="p-3">Dossier</th><th className="p-3">À faire</th><th className="p-3">Paiement</th><th className="p-3">Mis à jour</th></tr></thead>
              <tbody className="divide-y divide-line">
                {regs.map((r) => (
                  <tr key={r.id} className="hover:bg-chalk">
                    <td className="p-3"><input type="checkbox" name="ids" value={r.id} className="accent-pitch-700" aria-label="Sélectionner" /></td>
                    <td className="p-3"><Link href={`/club/dossiers/${r.id}`} className="font-semibold hover:underline">{r.child.lastName.toUpperCase()} {r.child.firstName}</Link><p className="text-xs text-muted">{r.child.family.guardians[0]?.phone ?? ""}</p></td>
                    <td className="p-3">{r.category.name}</td>
                    <td className="p-3"><RegistrationBadge status={r.status} /><div className="mt-1.5 w-24"><Progress value={r.progress} /></div></td>
                    <td className="max-w-56 p-3 text-xs text-muted">{r.missingSummary.slice(0, 2).join(" · ") || "—"}{r.missingSummary.length > 2 ? ` +${r.missingSummary.length - 2}` : ""}</td>
                    <td className="p-3"><PaymentBadge status={r.paymentStatus} /></td>
                    <td className="p-3 text-xs text-muted">{formatDate(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </form>
      )}
    </>
  );
}
