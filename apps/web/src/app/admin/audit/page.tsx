import { prisma } from "@/server/db";
import { Card, PageHeader, formatDateTime } from "@/components/ui";

export const metadata = { title: "Journal d'audit" };

export default async function Audit() {
  const logs = await prisma.auditLog.findMany({ include: { actor: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <PageHeader title="Journal d'audit" subtitle="Traçabilité des connexions, consultations de documents, décisions, paiements et remboursements (conservé 1 an)." />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3">Date</th><th className="p-3">Acteur</th><th className="p-3">Action</th><th className="p-3">Objet</th><th className="p-3">IP</th></tr></thead>
          <tbody className="divide-y divide-line">{logs.map((l) => <tr key={l.id}><td className="p-3 text-xs">{formatDateTime(l.createdAt)}</td><td className="p-3 text-xs">{l.actor?.email ?? "système"}</td><td className="p-3 font-mono text-xs">{l.action}</td><td className="p-3 font-mono text-[11px] text-muted">{l.entityType} {l.entityId}</td><td className="p-3 text-xs">{l.ip ?? ""}</td></tr>)}</tbody>
        </table>
      </Card>
    </>
  );
}
