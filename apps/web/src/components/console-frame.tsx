import Link from "next/link";
import { Logo } from "./logo";
import { SideNav, type NavItem } from "./nav-links";
import { LogoutButton } from "./user-menu";

/** Back-office frame (club & admin): dark sidebar on desktop, scrollable tabs on mobile. */
export function ConsoleFrame({ items, title, subtitle, accent, children }: { items: NavItem[]; title: string; subtitle?: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 z-30 bg-pitch-950 text-white md:h-dvh md:overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/"><Logo light /></Link>
          <div className="md:hidden"><LogoutButton /></div>
        </div>
        <div className="mx-3 mb-3 hidden rounded-xl bg-white/5 p-3 md:block">
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: accent ?? "#C6F432" }} /><p className="truncate text-sm font-bold">{title}</p></div>
          {subtitle && <p className="mt-0.5 truncate text-xs text-white/50">{subtitle}</p>}
        </div>
        <SideNav items={items} />
        <div className="hidden px-3 pb-6 pt-6 md:block"><LogoutButton /></div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
