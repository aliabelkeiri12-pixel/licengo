import { api } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { signInvoiceLink } from "@/server/invoices";

/** Family payments, installments and invoices (invoice links are signed and valid 10 minutes). */
export const GET = api(async () => {
  const u = await requireUser("FAMILY");
  const payments = await prisma.payment.findMany({
    where: { payerId: u.id, status: { notIn: ["PENDING", "CANCELLED"] } },
    include: { installments: { orderBy: { index: "asc" } }, club: true, registration: { include: { child: true } }, order: true, invoice: true },
    orderBy: { createdAt: "desc" },
  });
  return payments.map((p) => ({
    id: p.id,
    title: p.registration ? `Licence ${p.registration.season} – ${p.registration.child.firstName}` : `Boutique – ${p.order?.number ?? ""}`,
    club: p.club.name,
    status: p.status,
    totalCents: p.totalCents,
    clubAmountCents: p.clubAmountCents,
    platformFeeCents: p.platformFeeCents,
    installmentsCount: p.installmentsCount,
    installments: p.installments.map((i) => ({ id: i.id, index: i.index, dueDate: i.dueDate, amountCents: i.amountCents, status: i.status, paidAt: i.paidAt })),
    invoice: p.invoice ? { id: p.invoice.id, number: p.invoice.number, url: env.appUrl + signInvoiceLink(p.invoice.id) } : null,
  }));
});
