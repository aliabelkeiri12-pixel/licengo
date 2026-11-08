import { boundingBox, haversineKm } from "@licengo/core";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";

/** Geocodes a French postal code or city with the free government API (BAN), DB fallback. */
export async function geocode(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const query = q.trim();
  if (!query) return null;
  try {
    const param = /^\d{5}$/.test(query) ? `codePostal=${query}` : `nom=${encodeURIComponent(query)}&boost=population&limit=1`;
    const res = await fetch(`https://geo.api.gouv.fr/communes?${param}&fields=centre,nom`, { signal: AbortSignal.timeout(2500), next: { revalidate: 86400 } });
    if (res.ok) {
      const data = (await res.json()) as { nom: string; centre?: { coordinates: [number, number] } }[];
      const c = data.find((d) => d.centre);
      if (c?.centre) return { lng: c.centre.coordinates[0], lat: c.centre.coordinates[1], label: c.nom };
    }
  } catch { /* offline → fallback */ }
  const club = await prisma.club.findFirst({ where: { OR: [{ postalCode: query }, { city: { equals: query, mode: "insensitive" } }] } });
  return club ? { lat: club.lat, lng: club.lng, label: club.city } : null;
}

export async function searchClubs(p: { sport?: string; q?: string; radiusKm?: number; lat?: number; lng?: number }) {
  const where: Prisma.ClubWhereInput = { status: "ACTIVE" };
  if (p.sport) where.sport = { slug: p.sport };
  let origin: { lat: number; lng: number; label?: string } | null = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null;
  const radius = Math.min(Math.max(p.radiusKm ?? 25, 1), 200);
  if (!origin && p.q) {
    const text = p.q.trim();
    origin = await geocode(text);
    if (!origin) where.OR = [{ name: { contains: text, mode: "insensitive" } }, { city: { contains: text, mode: "insensitive" } }, { postalCode: { startsWith: text } }];
  }
  if (origin) {
    const b = boundingBox(origin.lat, origin.lng, radius);
    where.lat = { gte: b.minLat, lte: b.maxLat };
    where.lng = { gte: b.minLng, lte: b.maxLng };
  }
  const clubs = await prisma.club.findMany({ where, include: { sport: true, _count: { select: { categories: { where: { open: true } } } } }, take: 200 });
  const withDist = clubs.map((c) => ({ ...c, distanceKm: origin ? haversineKm(origin.lat, origin.lng, c.lat, c.lng) : null }));
  return { origin, results: withDist.filter((c) => c.distanceKm == null || c.distanceKm <= radius).sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || a.name.localeCompare(b.name)) };
}
