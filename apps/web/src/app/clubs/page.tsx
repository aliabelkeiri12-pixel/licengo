import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { Suspense } from "react";
import { prisma } from "@/server/db";
import { searchClubs } from "@/server/services/clubs";
import { PublicHeader } from "@/components/public-header";
import { Card, Input, Select, buttonClass, EmptyState } from "@/components/ui";
import { GeoButton } from "@/components/geo-button";

export const metadata = { title: "Trouver un club" };

export default async function ClubsSearch({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sports = await prisma.sport.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  const radius = Number(sp.rayon ?? 25);
  const { origin, results } = await searchClubs({ sport: sp.sport || undefined, q: sp.q, radiusKm: radius, lat: sp.lat ? Number(sp.lat) : undefined, lng: sp.lng ? Number(sp.lng) : undefined });
  const keep = sp.enfant ? `?enfant=${sp.enfant}` : "";
  return (
    <main className="min-h-dvh pb-16">
      <div className="bg-pitch-900 pb-10 pitch-lines">
        <PublicHeader dark />
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">Trouver un club</h1>
          <p className="mt-1 text-white/70">Par sport, ville, code postal ou autour de vous.</p>
          <form className="mt-6 grid grid-cols-1 gap-2 rounded-2xl bg-white p-3 shadow-xl sm:grid-cols-[minmax(0,1fr)_170px_130px_auto_auto]" role="search">
            {sp.enfant && <input type="hidden" name="enfant" value={sp.enfant} />}
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted" /><Input name="q" defaultValue={sp.q} placeholder="Ville, code postal ou nom du club" className="pl-9" aria-label="Recherche" /></div>
            <Select name="sport" defaultValue={sp.sport ?? ""} aria-label="Sport"><option value="">Tous les sports</option>{sports.map((s) => <option key={s.slug} value={s.slug} disabled={!s.active}>{s.emoji} {s.name}{s.active ? "" : " (bientôt)"}</option>)}</Select>
            <Select name="rayon" defaultValue={String(radius)} aria-label="Distance">{[5, 10, 25, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}</Select>
            <button className={buttonClass("primary")}>Rechercher</button>
            <Suspense><GeoButton /></Suspense>
          </form>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="mb-4 text-sm text-muted">{results.length} club{results.length > 1 ? "s" : ""}{origin ? ` à moins de ${radius} km${origin.label ? ` de ${origin.label}` : " de vous"}` : ""}</p>
        {results.length === 0 ? <EmptyState title="Aucun club trouvé" text="Élargissez le rayon ou essayez une autre ville. Votre club n'est pas encore sur LICENGO ? Parlez-lui de nous !" /> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((c) => (
              <Link key={c.id} href={`/clubs/${c.slug}${keep}`}>
                <Card className="h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="h-2" style={{ background: c.primaryColor }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-xl text-lg font-black text-white" style={{ background: c.primaryColor }}>{c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                        <div><p className="font-bold leading-tight">{c.name}</p><p className="text-xs text-muted">{c.sport.emoji} {c.sport.name}</p></div>
                      </div>
                      {c.distanceKm != null && <span className="whitespace-nowrap rounded-full bg-pitch-50 px-2 py-0.5 text-xs font-bold text-pitch-700">{c.distanceKm < 1 ? "< 1" : c.distanceKm.toFixed(1)} km</span>}
                    </div>
                    <p className="mt-3 flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" /> {c.postalCode} {c.city}</p>
                    <p className="mt-2 text-xs font-semibold text-pitch-700">{c._count.categories} catégories ouvertes</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
