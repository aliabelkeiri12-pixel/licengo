import { api } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertFamilyAccess, computeCompleteness } from "@/server/services/registrations";

export const GET = api<{ params: Promise<{ id: string }> }>(async (_, { params }) => {
  const u = await requireUser("FAMILY");
  const r = await assertFamilyAccess(u, (await params).id);
  const completeness = await computeCompleteness(r);
  const documents = await prisma.document.findMany({ where: { childId: r.childId, deletedAt: null }, select: { id: true, type: true, status: true, rejectReason: true, createdAt: true, expiresAt: true, mimeType: true } });
  return {
    id: r.id, status: r.status, paymentStatus: r.paymentStatus, season: r.season, healthAnswer: r.healthAnswer, decisionReason: r.decisionReason,
    child: { id: r.child.id, firstName: r.child.firstName, lastName: r.child.lastName }, club: { name: r.club.name, slug: r.club.slug }, category: { name: r.category.name, maxInstallments: r.category.maxInstallments },
    licenseFeeCents: r.licenseFeeCents, platformFeeCents: r.platformFeeCents, completeness, documents,
    signatures: r.signatures.map((s) => ({ type: s.type, accepted: s.accepted, signedAt: s.signedAt })),
    payments: r.payments.filter((p) => p.status !== "CANCELLED").map((p) => ({ id: p.id, status: p.status, totalCents: p.totalCents, installments: p.installments.map((i) => ({ id: i.id, index: i.index, dueDate: i.dueDate, amountCents: i.amountCents, status: i.status })) })),
    events: r.events.map((e) => ({ message: e.message, createdAt: e.createdAt })),
  };
});
