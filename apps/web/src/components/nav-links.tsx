"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Search, CreditCard, Bell, ShoppingBag, LayoutDashboard, FolderCheck, Shirt, Settings, Building2, Receipt, Undo2, Package, BadgeEuro, UserCog, Layers } from "lucide-react";
import { cx } from "./ui";

const icons = { Home, Users, Search, CreditCard, Bell, ShoppingBag, LayoutDashboard, FolderCheck, Shirt, Settings, Building2, Receipt, Undo2, Package, BadgeEuro, UserCog, Layers };
export type NavItem = { href: string; label: string; icon: keyof typeof icons; badge?: number; exact?: boolean };

const isActive = (path: string, item: NavItem) => (item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/"));

export function TopNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items.map((i) => {
        const I = icons[i.icon];
        return (
          <Link key={i.href} href={i.href} className={cx("relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition", isActive(path, i) ? "bg-white/10 text-white" : "text-white/70 hover:text-white")}>
            <I className="h-4 w-4" />{i.label}
            {!!i.badge && <span className="rounded-full bg-volt-500 px-1.5 text-[10px] font-bold text-pitch-950">{i.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Navigation principale">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((i) => {
          const I = icons[i.icon];
          const active = isActive(path, i);
          return (
            <Link key={i.href} href={i.href} className={cx("relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold", active ? "text-pitch-800" : "text-muted")}>
              <span className={cx("grid h-7 w-12 place-items-center rounded-full transition", active && "bg-volt-400/40")}><I className="h-5 w-5" /></span>
              {i.label}
              {!!i.badge && <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-danger" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SideNav({ items, title }: { items: NavItem[]; title?: string }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
      {title && <p className="hidden px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-wider text-white/40 md:block">{title}</p>}
      {items.map((i) => {
        const I = icons[i.icon];
        return (
          <Link key={i.href} href={i.href} className={cx("inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition", isActive(path, i) ? "bg-volt-500 text-pitch-950" : "text-white/75 hover:bg-white/5 hover:text-white")}>
            <I className="h-4 w-4" /><span className="whitespace-nowrap">{i.label}</span>
            {!!i.badge && <span className="ml-auto rounded-full bg-white/15 px-2 text-[11px]">{i.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
