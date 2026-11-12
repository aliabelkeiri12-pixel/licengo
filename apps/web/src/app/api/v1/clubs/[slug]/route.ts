import { api } from "@/lib/api";
import { prisma } from "@/server/db";
import { notFound } from "@/server/errors";
import { currentSeason } from "@/server/services/registrations";

export const GET = api<{ params: Promise<{ slug: string }> }>(async (_, { params }) => {
  const club = await prisma.club.findUnique({ where: { slug: (await params).slug }, include: { sport: true, plan: true, categories: { where: { season: currentSeason(), open: true }, orderBy: { birthYearMax: "desc" } }, fees: { where: { active: true }, orderBy: { createdAt: "asc" } } } });
  if (!club || club.status !== "ACTIVE") throw notFound("Club");
  return { id: club.id, slug: club.slug, name: club.name, city: club.city, address: club.address, description: club.description, color: club.primaryColor, sport: club.sport.name, feeCents: club.plan?.licenseFeeCents ?? 499, extras: club.fees.map((f) => ({ id: f.id, label: f.label, description: f.description, amountCents: f.amountCents, mandatory: f.mandatory })), categories: club.categories.map((c) => ({ id: c.id, name: c.name, birthYearMin: c.birthYearMin, birthYearMax: c.birthYearMax, gender: c.gender, priceCents: c.priceCents, maxInstallments: c.maxInstallments })) };
});
