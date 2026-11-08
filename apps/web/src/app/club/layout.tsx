import { redirect } from "next/navigation";
import { ConsoleFrame } from "@/components/console-frame";
import type { NavItem } from "@/components/nav-links";
import { staffUser } from "@/lib/guards";
import { prisma } from "@/server/db";

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const { user, clubId } = await staffUser();
  if (!clubId) redirect("/admin/clubs");
  const club = await prisma.club.findUniqueOrThrow({ where: { id: clubId }, include: { sport: true } });
  const [toValidate, failed, toShip, unread] = await Promise.all([
    prisma.registration.count({ where: { clubId, status: "SUBMITTED" } }),
    prisma.installment.count({ where: { status: "FAILED", payment: { clubId } } }),
    prisma.shopOrder.count({ where: { clubId, status: { in: ["PAID", "PREPARING"] } } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const items: NavItem[] = [
    { href: "/club", label: "Tableau de bord", icon: "LayoutDashboard", exact: true },
    { href: "/club/dossiers", label: "Dossiers", icon: "FolderCheck", badge: toValidate },
    { href: "/club/licencies", label: "Licenciés", icon: "Users" },
    { href: "/club/paiements", label: "Paiements", icon: "CreditCard", badge: failed },
    { href: "/club/boutique", label: "Boutique", icon: "Shirt", badge: toShip },
    { href: "/club/categories", label: "Catégories", icon: "Layers" },
    { href: "/club/notifications", label: "Notifications", icon: "Bell", badge: unread },
    { href: "/club/parametres", label: "Paramètres", icon: "Settings" },
  ];
  return <ConsoleFrame items={items} title={club.name} subtitle={`${club.sport.emoji} ${club.sport.name} · ${user.firstName} ${user.lastName}`} accent={club.primaryColor}>{children}</ConsoleFrame>;
}
