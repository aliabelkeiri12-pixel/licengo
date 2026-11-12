import { createHmac, timingSafeEqual } from "node:crypto";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from "pdf-lib";
import type { Invoice } from "@prisma/client";
import { formatEUR } from "@licengo/core";
import { prisma } from "./db";
import { extrasOf } from "./services/registrations";
import { documentKey } from "./env";
import type { SessionUser } from "./auth";

export const PLATFORM_VAT_BPS = 2000; // 20 % VAT included in LICENGO service fees

/** LICENGO legal identity printed on invoices (set in the hosting environment). */
export const platformIdentity = () => ({
  name: process.env.LICENGO_LEGAL_NAME || "LICENGO",
  address: process.env.LICENGO_ADDRESS || "Adresse du siège à compléter",
  siren: process.env.LICENGO_SIREN || "SIREN à compléter",
  vatNumber: process.env.LICENGO_VAT_NUMBER || "N° TVA intracommunautaire à compléter",
});

/** VAT part of an amount that already includes VAT. */
export const vatIncluded = (ttcCents: number, bps = PLATFORM_VAT_BPS) => ttcCents - Math.round((ttcCents * 10_000) / (10_000 + bps));

/**
 * Issues THE invoice of a payment (idempotent): one document per licence or shop order, created at the
 * first payment. Numbers are sequential without gaps per year (LG-2026-00001).
 */
export async function issueInvoice(paymentId: string): Promise<Invoice> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({ where: { paymentId } });
    if (existing) return existing;
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const year = new Date().getFullYear();
    const key = `LG:${year}`;
    const counter = await tx.invoiceCounter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
    return tx.invoice.create({
      data: {
        number: `LG-${year}-${String(counter.value).padStart(5, "0")}`,
        paymentId, clubId: p.clubId, payerId: p.payerId,
        amountCents: p.totalCents,
        vatCents: p.kind === "LICENSE" ? vatIncluded(p.platformFeeCents) : 0,
      },
    });
  });
}

/** Payer, staff of the club and LICENGO admins can read an invoice. */
export function canReadInvoice(user: SessionUser, inv: Invoice) {
  return inv.payerId === user.id || user.role === "ADMIN" || user.staff.some((s) => s.clubId === inv.clubId);
}

/** Short-lived signed link (the mobile app opens invoices in the system browser, without its session token). */
export function signInvoiceLink(invoiceId: string, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac("sha256", documentKey()).update(`invoice:${invoiceId}:${exp}`).digest("base64url");
  return `/api/invoices/${invoiceId}?exp=${exp}&sig=${sig}`;
}
export function verifyInvoiceLink(invoiceId: string, exp: string | null, sig: string | null) {
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const expected = createHmac("sha256", documentKey()).update(`invoice:${invoiceId}:${exp}`).digest();
  const given = Buffer.from(sig, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const day = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(d);
// Standard PDF fonts are WinAnsi-encoded: replace the few characters they cannot draw.
const safe = (s: string) => s.replace(/ | /g, " ").replace(/[’]/g, "'").replace(/[–—]/g, "-").replace(/[^\x20-\x7E -ÿ€]/g, "");
const eur = (c: number) => safe(formatEUR(c));

/** Renders the invoice as an A4 PDF, with the installment schedule as it stands today. */
export async function renderInvoicePdf(invoiceId: string): Promise<{ invoice: Invoice; pdf: Uint8Array }> {
  const inv = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      payment: {
        include: {
          club: true,
          installments: { orderBy: { index: "asc" } },
          refunds: true,
          registration: { include: { child: true, category: true } },
          order: { include: { items: true } },
        },
      },
    },
  });
  const payer = await prisma.user.findUniqueOrThrow({ where: { id: inv.payerId }, include: { family: true } });
  const p = inv.payment;
  const club = p.club;
  const plat = platformIdentity();
  const isLicense = p.kind === "LICENSE";

  const doc = await PDFDocument.create();
  doc.setTitle(`Facture ${inv.number}`);
  doc.setAuthor(plat.name);
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.055, 0.082, 0.07), muted = rgb(0.36, 0.42, 0.39), green = rgb(0.043, 0.239, 0.18), lime = rgb(0.776, 0.957, 0.196), white = rgb(1, 1, 1);
  const light = rgb(0.965, 0.961, 0.945), line = rgb(0.89, 0.9, 0.88);
  type O = { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> };
  const text = (s: string, x: number, y: number, o: O = {}) => page.drawText(safe(s), { x, y, size: o.size ?? 10, font: o.f ?? font, color: o.color ?? ink });
  const right = (s: string, xr: number, y: number, o: O = {}) => text(s, xr - (o.f ?? font).widthOfTextAtSize(safe(s), o.size ?? 10), y, o);
  const rule = (y: number) => page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: line });

  // header
  page.drawRectangle({ x: 0, y: 781.89, width: 595.28, height: 60, color: green });
  text("LICEN", 40, 803, { size: 22, f: bold, color: white });
  text("GO", 40 + bold.widthOfTextAtSize("LICEN", 22), 803, { size: 22, f: bold, color: lime });
  right(`FACTURE N° ${inv.number}`, 555, 808, { size: 12, f: bold, color: white });
  right(`Date : ${day(inv.issuedAt)}`, 555, 792, { color: white });

  // parties
  let y = 745;
  text("ÉMETTEUR", 40, y, { size: 8, f: bold, color: muted });
  text("CLIENT", 320, y, { size: 8, f: bold, color: muted });
  y -= 16;
  [plat.name, plat.address, plat.siren, plat.vatNumber, `pour le compte de : ${club.name}`, `${club.address ? club.address + ", " : ""}${club.postalCode} ${club.city}`]
    .forEach((l, i) => text(l, 40, y - i * 13, { f: i === 0 || i === 4 ? bold : font, size: 9.5 }));
  [`${payer.firstName} ${payer.lastName}`, payer.email, [payer.family?.address, payer.family?.postalCode, payer.family?.city].filter(Boolean).join(" ")]
    .filter(Boolean).forEach((l, i) => text(l, 320, y - i * 13, { f: i === 0 ? bold : font, size: 9.5 }));

  // object
  y = 640;
  text("Objet", 40, y, { size: 8, f: bold, color: muted });
  text(isLicense ? `Licence ${p.registration!.season} - ${p.registration!.child.firstName} ${p.registration!.child.lastName} - ${p.registration!.category.name}` : `Commande boutique ${p.order?.number ?? ""} - ${club.name}`, 40, y - 14, { f: bold, size: 11 });

  // detail table
  y = 595;
  page.drawRectangle({ x: 40, y: y - 6, width: 515, height: 22, color: light });
  text("Désignation", 48, y, { f: bold, size: 9 });
  right("TVA", 470, y, { f: bold, size: 9 });
  right("Montant", 547, y, { f: bold, size: 9 });
  y -= 24;
  const rows: [string, string, number][] = isLicense
    ? [
        [`Cotisation licence ${p.registration!.season} - ${p.registration!.category.name}`, "non applicable*", p.clubAmountCents - extrasOf(p.registration!.extras).reduce((t, e) => t + e.amountCents, 0)],
        ...extrasOf(p.registration!.extras).map((e) => [e.label, "non applicable*", e.amountCents] as [string, string, number]),
        ["Frais de service LICENGO (dossier en ligne et paiement)", `${PLATFORM_VAT_BPS / 100} %`, p.platformFeeCents],
      ]
    : (p.order?.items ?? []).map((i) => [`${i.productName} - taille ${i.size} x ${i.quantity}${i.personalization ? ` (flocage "${i.personalization}")` : ""}`, "non applicable*", i.unitPriceCents * i.quantity] as [string, string, number]);
  for (const [label, vat, amount] of rows) {
    text(label.length > 70 ? label.slice(0, 69) + "…" : label, 48, y);
    right(vat, 470, y, { size: 9, color: muted });
    right(eur(amount), 547, y);
    y -= 18;
  }
  rule(y + 6);
  y -= 10;
  const totals: [string, string, boolean][] = isLicense
    ? [["dont frais de service HT", eur(p.platformFeeCents - inv.vatCents), false], ["dont TVA 20 % sur frais de service", eur(inv.vatCents), false], ["TOTAL TTC", eur(p.totalCents), true]]
    : [["TOTAL", eur(p.totalCents), true]];
  for (const [l, v, strong] of totals) {
    right(l, 440, y, { f: strong ? bold : font, size: strong ? 12 : 9, color: strong ? ink : muted });
    right(v, 547, y, { f: strong ? bold : font, size: strong ? 12 : 9, color: strong ? ink : muted });
    y -= strong ? 20 : 14;
  }

  // schedule
  y -= 10;
  const paid = p.installments.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amountCents, 0);
  text(p.installmentsCount > 1 ? `Échéancier - paiement en ${p.installmentsCount} fois sans frais` : "Règlement", 40, y, { f: bold, size: 11 });
  y -= 20;
  page.drawRectangle({ x: 40, y: y - 6, width: 515, height: 20, color: light });
  text("N°", 48, y, { f: bold, size: 9 });
  text("Date", 90, y, { f: bold, size: 9 });
  text("Statut", 260, y, { f: bold, size: 9 });
  right("Montant", 547, y, { f: bold, size: 9 });
  y -= 20;
  for (const i of p.installments) {
    const st = i.status === "PAID" ? `Payée le ${day(i.paidAt ?? i.dueDate)}` : i.status === "FAILED" ? "Impayée - à régulariser" : i.status === "CANCELLED" ? "Annulée" : i.status === "REFUNDED" ? "Remboursée" : "À venir (prélèvement automatique)";
    text(`${i.index}/${p.installmentsCount}`, 48, y, { size: 9.5 });
    text(day(i.dueDate), 90, y, { size: 9.5 });
    text(st, 260, y, { size: 9.5, color: i.status === "PAID" ? green : i.status === "FAILED" ? rgb(0.76, 0.21, 0.17) : muted, f: i.status === "PAID" ? bold : font });
    right(eur(i.amountCents), 547, y, { size: 9.5 });
    y -= 16;
  }
  rule(y + 6);
  y -= 10;
  right("Déjà payé", 440, y, { size: 10 }); right(eur(paid), 547, y, { size: 10, f: bold }); y -= 15;
  right("Reste à payer", 440, y, { size: 10 }); right(eur(Math.max(0, p.totalCents - paid)), 547, y, { size: 10, f: bold }); y -= 15;
  const refunded = p.refunds.filter((r) => r.status !== "FAILED").reduce((s, r) => s + r.amountCents, 0);
  if (refunded) { right("Remboursé", 440, y, { size: 10 }); right(eur(refunded), 547, y, { size: 10, f: bold }); y -= 15; }

  // legal mentions
  const mentions = [
    "* TVA non applicable sur la cotisation et les articles du club - article 261, 7-1° du CGI (association sportive à but non lucratif).",
    `Facture émise par ${plat.name} en son nom pour les frais de service, et au nom et pour le compte du club pour la cotisation (mandat de facturation).`,
    "Paiement par carte bancaire via LICENGO. Pas d'escompte pour paiement anticipé.",
  ];
  mentions.forEach((m, i) => text(m, 40, 74 - i * 11, { size: 7, color: muted }));
  if (p.provider === "mock") {
    page.drawText("DÉMONSTRATION", { x: 110, y: 300, size: 60, font: bold, color: rgb(0.85, 0.2, 0.15), opacity: 0.1, rotate: degrees(30) });
    text("Document de démonstration : aucun paiement réel n'a été effectué.", 40, 98, { size: 8, f: bold, color: rgb(0.76, 0.21, 0.17) });
  }
  return { invoice: inv, pdf: await doc.save() };
}
