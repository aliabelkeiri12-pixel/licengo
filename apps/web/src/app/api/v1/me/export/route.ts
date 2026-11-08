import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit";

/** RGPD art. 15 & 20: machine-readable export of all personal data of the account. */
export const GET = api(async () => {
  const u = await requireUser();
  const data = {
    exportedAt: new Date().toISOString(),
    account: await prisma.user.findUnique({ where: { id: u.id }, select: { email: true, firstName: true, lastName: true, phone: true, createdAt: true, termsAcceptedAt: true, marketingOptIn: true } }),
    family: u.familyId ? await prisma.family.findUnique({ where: { id: u.familyId }, include: { children: { where: { deletedAt: null }, include: { registrations: { include: { signatures: { select: { type: true, signerName: true, accepted: true, signedAt: true, contentHash: true } }, events: true } } } }, documents: { where: { deletedAt: null }, select: { id: true, type: true, status: true, originalName: true, createdAt: true, expiresAt: true } } } }) : null,
    payments: await prisma.payment.findMany({ where: { payerId: u.id }, include: { installments: true, refunds: true } }),
    orders: await prisma.shopOrder.findMany({ where: { userId: u.id }, include: { items: true } }),
    notifications: await prisma.notification.findMany({ where: { userId: u.id } }),
  };
  await audit(u.id, "user.export", "User", u.id);
  return new NextResponse(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="mes-donnees-licengo.json"', "Cache-Control": "no-store" } });
});
