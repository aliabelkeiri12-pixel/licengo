import { ConsoleFrame } from "@/components/console-frame";
import type { NavItem } from "@/components/nav-links";
import { adminUser } from "@/lib/guards";
import { prisma } from "@/server/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await adminUser();
  const pending = await prisma.club.count({ where: { status: "PENDING" } });
  const items: NavItem[] = [
    { href: "/admin", label: "Vue d'ensemble", icon: "LayoutDashboard", exact: true },
    { href: "/admin/clubs", label: "Clubs", icon: "Building2", badge: pending },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "UserCog" },
    { href: "/admin/abonnements", label: "Abonnements", icon: "BadgeEuro" },
    { href: "/admin/transactions", label: "Transactions", icon: "Receipt" },
    { href: "/admin/remboursements", label: "Remboursements", icon: "Undo2" },
    { href: "/admin/commandes", label: "Commandes", icon: "Package" },
    { href: "/admin/audit", label: "Journal d'audit", icon: "FolderCheck" },
  ];
  return <ConsoleFrame items={items} title="Administration LICENGO" subtitle={u.email}>{children}</ConsoleFrame>;
}
