import { registrationCreateSchema } from "@licengo/core";
import { api, json } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { createRegistration } from "@/server/services/registrations";

export const GET = api(async () => {
  const u = await requireUser("FAMILY");
  return prisma.registration.findMany({ where: { child: { familyId: u.familyId! } }, include: { child: true, club: { select: { name: true, slug: true, primaryColor: true } }, category: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
});

export const POST = api(async (req) => {
  const u = await requireUser("FAMILY");
  const d = registrationCreateSchema.parse(await json(req));
  return createRegistration(u, d.childId, d.categoryId);
});
