import { api } from "@/lib/api";
import { prisma } from "@/server/db";
import { notFound } from "@/server/errors";

export const GET = api<{ params: Promise<{ slug: string }> }>(async (_, { params }) => {
  const club = await prisma.club.findUnique({ where: { slug: (await params).slug }, include: { products: { where: { active: true }, include: { variants: { select: { id: true, size: true, stock: true } } } } } });
  if (!club) throw notFound("Boutique");
  return { club: { name: club.name, color: club.primaryColor }, products: club.products.map((p) => ({ id: p.id, name: p.name, category: p.category, priceCents: p.priceCents, description: p.description, variants: p.variants })) };
}, { public: true });
