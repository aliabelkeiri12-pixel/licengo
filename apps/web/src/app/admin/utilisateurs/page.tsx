import { prisma } from "@/server/db";
import { Card, PageHeader, Badge, Input, Button, formatDateTime } from "@/components/ui";
import { unlockUserAction, revokeSessionsAction } from "@/app/actions/admin";

export const metadata = { title: "Utilisateurs" };

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const users = await prisma.user.findMany({ where: { deletedAt: null, ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } : {}) }, include: { staff: { include: { club: true } }, family: { include: { _count: { select: { children: true } } } }, _count: { select: { sessions: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Utilisateurs" subtitle="Les données des mineurs et documents ne sont pas consultables depuis le back-office (principe de minimisation)." />
      <form className="mb-4 flex gap-2"><Input name="q" defaultValue={q} placeholder="Email ou nom" className="max-w-xs" /><Button variant="outline">Rechercher</Button></form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><tr><th className="p-3">Utilisateur</th><th className="p-3">Rôle</th><th className="p-3">Rattachement</th><th className="p-3">Dernière connexion</th><th className="p-3">Sécurité</th></tr></thead>
          <tbody className="divide-y divide-line">{users.map((u) => (
            <tr key={u.id}>
              <td className="p-3"><p className="font-semibold">{u.firstName} {u.lastName}</p><p className="text-xs text-muted">{u.email}</p></td>
              <td className="p-3"><Badge tone={u.role === "ADMIN" ? "volt" : u.role === "CLUB_STAFF" ? "blue" : "gray"}>{{ ADMIN: "Admin", CLUB_STAFF: "Club", FAMILY: "Famille" }[u.role]}</Badge></td>
              <td className="p-3 text-xs">{u.staff.map((s) => `${s.club.name} (${s.role})`).join(", ") || (u.family ? `${u.family.name} · ${u.family._count.children} membre(s)` : "—")}</td>
              <td className="p-3 text-xs">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"} · {u._count.sessions} session(s)</td>
              <td className="p-3"><div className="flex gap-2">
                {u.lockedUntil && u.lockedUntil > new Date() && <form action={unlockUserAction}><input type="hidden" name="userId" value={u.id} /><Button size="sm" variant="outline">Déverrouiller</Button></form>}
                <form action={revokeSessionsAction}><input type="hidden" name="userId" value={u.id} /><Button size="sm" variant="ghost">Déconnecter</Button></form>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </>
  );
}
