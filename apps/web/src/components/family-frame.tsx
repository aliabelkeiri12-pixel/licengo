import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Logo } from "./logo";
import { BottomTabs, TopNav, type NavItem } from "./nav-links";
import { LogoutButton } from "./user-menu";
import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/auth";

export async function familyNav(user: SessionUser) {
  const [unread, cart] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.cartItem.aggregate({ where: { userId: user.id }, _sum: { quantity: true } }),
  ]);
  const items: NavItem[] = [
    { href: "/famille", label: "Accueil", icon: "Home", exact: true },
    { href: "/famille/enfants", label: "Enfants", icon: "Users" },
    { href: "/clubs", label: "Clubs", icon: "Search" },
    { href: "/famille/paiements", label: "Paiements", icon: "CreditCard" },
    { href: "/famille/notifications", label: "Alertes", icon: "Bell", badge: unread },
  ];
  return { items, cartCount: cart._sum.quantity ?? 0 };
}

export function FamilyFrame({ items, cartCount, firstName, children }: { items: NavItem[]; cartCount: number; firstName: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-30 bg-pitch-900 pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/famille"><Logo light /></Link>
          <TopNav items={items} />
          <div className="flex items-center gap-1">
            <Link href="/panier" className="relative rounded-lg p-2 text-white/80 hover:text-white" aria-label="Panier">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-volt-500 px-1 text-[10px] font-bold text-pitch-950">{cartCount}</span>}
            </Link>
            <Link href="/famille/compte" className="hidden rounded-lg px-2 py-2 text-sm font-semibold text-white/80 hover:text-white sm:block">{firstName}</Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <BottomTabs items={items} />
    </div>
  );
}
