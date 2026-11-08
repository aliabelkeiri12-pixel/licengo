import Link from "next/link";
import { prisma } from "@/server/db";
import { Card, EmptyState, formatDateTime } from "./ui";

export async function NotificationsList({ userId }: { userId: string }) {
  const list = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
  if (!list.length) return <EmptyState title="Aucune notification" text="Vous serez prévenu ici (et sur votre téléphone) à chaque étape." />;
  return (
    <Card className="divide-y divide-line">
      {list.map((n) => (
        <Link key={n.id} href={n.link ?? "#"} className={`flex gap-3 p-4 hover:bg-chalk ${n.readAt ? "" : "bg-volt-400/10"}`}>
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-volt-600"}`} />
          <div className="min-w-0"><p className="text-sm font-semibold">{n.title}</p><p className="text-sm text-muted">{n.body}</p><p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p></div>
        </Link>
      ))}
    </Card>
  );
}

