import { formatEUR } from "@licengo/core";
import { prisma } from "@/server/db";
import { platformStats } from "@/server/services/stats";
import { Card, PageHeader, StatCard, formatDate } from "@/components/ui";

export const metadata = { title: "Administration" };

export default async function AdminHome() {
  const s = await platformStats();
  const months = await prisma.$queryRaw<{ m: string; fees: bigint; gmv: bigint }[]>`
    SELECT to_char(date_trunc('month', "paidAt"), 'YYYY-MM') AS m, SUM("platformFeeCents")::bigint AS fees, SUM("amountCents")::bigint AS gmv
    FROM "Installment" WHERE status = 'PAID' AND "paidAt" > now() - interval '12 months' GROUP BY 1 ORDER BY 1`;
  const topClubs = await prisma.club.findMany({ include: { _count: { select: { registrations: { where: { status: { notIn: ["CANCELLED", "REJECTED"] } } } } } }, orderBy: { registrations: { _count: "desc" } }, take: 5 });
  const maxFee = Math.max(1, ...months.map((m) => Number(m.fees)));
  const revenue = s.licenseFeesCents + s.shopFeesCents - s.refundedFeesCents; // transactional revenue (MRR shown separately)
  return (
    <>
      <PageHeader title="Vue d'ensemble" subtitle="Indicateurs financiers et d'activité de la plateforme" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard tone="dark" label="Volume de paiements" value={formatEUR(s.gmvCents)} hint="Total encaissé (familles)" />
        <StatCard label="Revenus transactionnels" value={formatEUR(revenue)} hint={`Frais licences ${formatEUR(s.licenseFeesCents)} · boutique ${formatEUR(s.shopFeesCents)}`} />
        <StatCard label="MRR abonnements" value={formatEUR(s.mrrCents)} hint={`ARR ${formatEUR(s.mrrCents * 12)} · clubs actifs`} />
        <StatCard label="Impayés" value={formatEUR(s.unpaidCents)} hint={`${s.unpaidCount} échéance(s)`} />
        <StatCard label="Clubs actifs" value={s.clubs.ACTIVE ?? 0} hint={`${s.clubs.PENDING ?? 0} en attente · ${s.clubs.SUSPENDED ?? 0} suspendus`} />
        <StatCard label="Familles" value={s.families} hint={`${s.users} utilisateurs`} />
        <StatCard label="Licences" value={s.registrations} />
        <StatCard label="Remboursé" value={formatEUR(s.refundedCents)} hint={`dont frais ${formatEUR(s.refundedFeesCents)}`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg font-bold">Frais LICENGO encaissés par mois</h2>
          {months.length === 0 ? <p className="mt-3 text-sm text-muted">Pas encore de données.</p> : (
            <div className="mt-4 flex h-48 items-end gap-2" role="img" aria-label="Histogramme des frais mensuels">
              {months.map((m) => (
                <div key={m.m} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold tabular-nums text-muted">{formatEUR(Number(m.fees))}</span>
                  <div className="w-full rounded-t-md bg-pitch-600" style={{ height: `${(Number(m.fees) / maxFee) * 140}px` }} />
                  <span className="text-[10px] text-muted">{m.m.slice(5)}/{m.m.slice(2, 4)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-display text-lg font-bold">Top clubs</h2>
          <ul className="mt-3 divide-y divide-line text-sm">{topClubs.map((c) => <li key={c.id} className="flex justify-between py-2"><span>{c.name} <span className="text-muted">· {c.city}</span></span><span className="font-semibold">{c._count.registrations} licences</span></li>)}</ul>
          <p className="mt-3 text-xs text-muted">Données au {formatDate(new Date())}</p>
        </Card>
      </div>
    </>
  );
}
