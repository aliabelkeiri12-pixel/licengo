import { api } from "@/lib/api";
import { searchClubs } from "@/server/services/clubs";

export const GET = api(async (req) => {
  const sp = new URL(req.url).searchParams;
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
  const r = await searchClubs({ sport: sp.get("sport") ?? undefined, q: sp.get("q") ?? undefined, radiusKm: num("radius"), lat: num("lat"), lng: num("lng") });
  return { origin: r.origin, results: r.results.map((c) => ({ id: c.id, slug: c.slug, name: c.name, city: c.city, postalCode: c.postalCode, sport: c.sport.name, emoji: c.sport.emoji, color: c.primaryColor, distanceKm: c.distanceKm })) };
}, { public: true });
