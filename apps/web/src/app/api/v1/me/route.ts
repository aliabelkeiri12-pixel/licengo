import { api } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";

export const GET = api(async () => {
  const u = await requireUser();
  const [children, unread] = await Promise.all([
    u.familyId ? prisma.child.findMany({ where: { familyId: u.familyId, deletedAt: null }, include: { registrations: { include: { club: { select: { name: true, slug: true, primaryColor: true } }, category: { select: { name: true } } }, orderBy: { createdAt: "desc" } } }, orderBy: { birthDate: "asc" } }) : [],
    prisma.notification.count({ where: { userId: u.id, readAt: null } }),
  ]);
  return { user: { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, phone: u.phone, role: u.role }, children, unread };
});
