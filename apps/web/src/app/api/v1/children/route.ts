import { childSchema } from "@licengo/core";
import { api, json } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit";

export const GET = api(async () => {
  const u = await requireUser("FAMILY");
  return prisma.child.findMany({ where: { familyId: u.familyId!, deletedAt: null }, orderBy: { birthDate: "asc" } });
});

export const POST = api(async (req) => {
  const u = await requireUser("FAMILY");
  const d = childSchema.parse(await json(req));
  const c = await prisma.child.create({ data: { familyId: u.familyId!, firstName: d.firstName, lastName: d.lastName, birthDate: d.birthDate, gender: d.gender, birthPlace: d.birthPlace || null, nationality: d.nationality || null, isSelf: !!d.isSelf } });
  await audit(u.id, "child.create", "Child", c.id);
  return c;
});
