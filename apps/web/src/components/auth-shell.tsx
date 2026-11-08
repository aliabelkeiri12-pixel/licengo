import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="grid min-h-dvh md:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden bg-pitch-900 pitch-lines p-10 text-white md:flex md:flex-col md:justify-between">
        <Link href="/"><Logo light /></Link>
        <div>
          <p className="font-display text-4xl font-black leading-tight">Moins de papier.<br /><span className="text-volt-500">Plus de terrain.</span></p>
          <p className="mt-4 max-w-sm text-white/70">Inscriptions, documents, paiements et boutique de votre club, au même endroit.</p>
        </div>
        <p className="text-xs text-white/50">Vos données sont chiffrées et hébergées dans l'Union européenne.</p>
      </aside>
      <section className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 inline-block md:hidden"><Logo /></Link>
          <h1 className="font-display text-3xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
