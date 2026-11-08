import { prisma } from "../db";

export async function clubStats(clubId: string, season: string) {
  const [byStatus, byPayment, byCategory, revenue, pendingInstallments, orders] = await Promise.all([
    prisma.registration.groupBy({ by: ["status"], where: { clubId, season }, _count: true }),
    prisma.registration.groupBy({ by: ["paymentStatus"], where: { clubId, season, status: { notIn: ["CANCELLED", "REJECTED"] } }, _count: true }),
    prisma.registration.groupBy({ by: ["categoryId"], where: { clubId, season, status: { notIn: ["CANCELLED", "REJECTED"] } }, _count: true }),
    prisma.installment.aggregate({ where: { status: "PAID", payment: { clubId } }, _sum: { clubAmountCents: true } }),
    prisma.installment.aggregate({ where: { status: { in: ["SCHEDULED", "FAILED"] }, payment: { clubId, status: { notIn: ["CANCELLED", "REFUNDED", "PENDING"] } } }, _sum: { clubAmountCents: true } }),
    prisma.shopOrder.aggregate({ where: { clubId, status: { notIn: ["PENDING_PAYMENT", "CANCELLED", "REFUNDED"] } }, _sum: { clubAmountCents: true }, _count: true }),
  ]);
  const count = (arr: { _count: number }[]) => arr.reduce((s, x) => s + x._count, 0);
  const s = Object.fromEntries(byStatus.map((x) => [x.status, x._count])) as Record<string, number>;
  return {
    total: count(byStatus.filter((x) => !["CANCELLED", "REJECTED"].includes(x.status))),
    validated: s.VALIDATED ?? 0,
    toValidate: s.SUBMITTED ?? 0,
    incomplete: (s.INCOMPLETE ?? 0) + (s.DRAFT ?? 0),
    toFix: s.TO_FIX ?? 0,
    byStatus: s,
    byPayment: Object.fromEntries(byPayment.map((x) => [x.paymentStatus, x._count])) as Record<string, number>,
    byCategory,
    revenueCents: revenue._sum.clubAmountCents ?? 0,
    upcomingCents: pendingInstallments._sum.clubAmountCents ?? 0,
    shopRevenueCents: orders._sum.clubAmountCents ?? 0,
    shopOrders: orders._count,
  };
}

export async function platformStats() {
  const [clubs, users, families, regs, licenseFees, shopFees, gmv, refunds, failed] = await Promise.all([
    prisma.club.groupBy({ by: ["status"], _count: true }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.family.count(),
    prisma.registration.count({ where: { status: { notIn: ["CANCELLED", "REJECTED"] } } }),
    prisma.installment.aggregate({ where: { status: "PAID", payment: { kind: "LICENSE" } }, _sum: { platformFeeCents: true } }),
    prisma.installment.aggregate({ where: { status: "PAID", payment: { kind: "SHOP" } }, _sum: { platformFeeCents: true } }),
    prisma.installment.aggregate({ where: { status: "PAID" }, _sum: { amountCents: true } }),
    prisma.refund.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true, feeCents: true } }),
    prisma.installment.aggregate({ where: { status: "FAILED" }, _sum: { amountCents: true }, _count: true }),
  ]);
  const plans = await prisma.plan.findMany({ include: { _count: { select: { clubs: { where: { status: "ACTIVE" } } } } } });
  const mrr = plans.reduce((s, p) => s + p.monthlyPriceCents * p._count.clubs, 0);
  return {
    clubs: Object.fromEntries(clubs.map((c) => [c.status, c._count])) as Record<string, number>,
    users, families, registrations: regs,
    licenseFeesCents: licenseFees._sum.platformFeeCents ?? 0,
    shopFeesCents: shopFees._sum.platformFeeCents ?? 0,
    gmvCents: gmv._sum.amountCents ?? 0,
    refundedCents: refunds._sum.amountCents ?? 0,
    refundedFeesCents: refunds._sum.feeCents ?? 0,
    unpaidCents: failed._sum.amountCents ?? 0,
    unpaidCount: failed._count,
    mrrCents: mrr,
  };
}
