import { api } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";

export const GET = api(async () => {
  const u = await requireUser();
  return prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 100 });
});

export const POST = api(async () => {
  const u = await requireUser();
  await prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
});
