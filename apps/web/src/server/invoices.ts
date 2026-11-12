import { createHmac, timingSafeEqual } from "node:crypto";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Invoice, InvoiceIssuer } from "@prisma/client";
import { formatEUR } from "@licengo/core";
import { prisma } from "./db";
import { documentKey } from "./env";
import type { SessionUser } from "./auth";

export const PLATFORM_VAT_BPS = 2000; // 20 % VAT included in LICENGO service fees

/** LICENGO legal identity printed on its invoices (set in the hosting environment). */
export const platformIdentity = () => ({
  name: process.env.LICENGO_LEGAL_NAME || "LICENGO",
  address: process.env.LICENGO_ADDRESS || "Adresse du siège à compléter",
  siren: process.env.LICENGO_SIREN || "SIREN à compléter",
  vatNumber: process.env.LICENGO_VAT_NUMBER || "N° TVA intracommunautaire à compléter",
});

/** VAT part of an amount that already includes VAT. */
export const vatIncluded = (ttcCents: number, bps = PLATFORM_VAT_BPS) => ttcCents - Math.round((ttcCents * 10_000) / (10_000 + bps));

const clubCode = (slug: string) => slug.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "CLUB";

/**
 * Issues the invoices of a paid installment (idempotent). Numbers are sequential with no gap per issuer and year.
 * - Licence: the club invoices the membership fee, LICENGO invoices its service fee (VAT included).
 * - Shop: the club invoices the goods (LICENGO's commission is charged to the club, not to the family).
 */
export async function issueInvoices(installmentId: string): Promise<Invoice[]> {
  return prisma.$transaction(async (tx) => {
    const inst = await tx.installment.findUniqueOrThrow({ where: { id: installmentId }, include: { payment: { include: { club: true } } } });
    if (inst.status !== "PAID") return [];
    const p = inst.payment;
    const year = (inst.paidAt ?? new Date()).getFullYear();
    const wanted: { issuer: InvoiceIssuer; amountCents: number; vatCents: number }[] =
      p.kind === "LICENSE"
        ? [
            { issuer: "CLUB", amountCents: inst.clubAmountCents, vatCents: 0 },
            ...(inst.platformFeeCents > 0 ? [{ issuer: "PLATFORM" as const, amountCents: inst.platformFeeCents, vatCents: vatIncluded(inst.platformFeeCents) }] : []),
          ]
        : [{ issuer: "CLUB", amountCents: inst.amountCents, vatCents: 0 }];
    const out: Invoice[] = [];
    for (const w of wanted) {
      const existing = await tx.invoice.findUnique({ where: { installmentId_issuer: { installmentId, issuer: w.issuer } } });
      if (existing) { out.push(existing); continue; }
      const key = w.issuer === "CLUB" ? `CLUB:${p.clubId}:${year}` : `PLATFORM:${year}`;
      const counter = await tx.invoiceCounter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
      const prefix = w.issuer === "CLUB" ? clubCode(p.club.slug) : "LG";
      out.push(await tx.invoice.create({
        data: {
          number: `${prefix}-${year}-${String(counter.value).padStart(5, "0")}`,
          issuer: w.issuer, paymentId: p.id, installmentId, clubId: p.clubId, payerId: p.payerId,
          amountCents: w.amountCents, vatCents: w.vatCents, issuedAt: inst.paidAt ?? new Date(),
        },
      }));
    }
    return out;
  });
}

/** Payer, staff of the club (club invoices only) and LICENGO admins can read an invoice. */
export function canReadInvoice(user: SessionUser, inv: Invoice) {
  if (inv.payerId === user.id || user.role === "ADMIN") return true;
  return inv.issuer === "CLUB" && user.staff.some((s) => s.clubId === inv.clubId);
}

/** Short-lived signed link (mobile app opens invoices in the system browser, without its session token). */
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

/** Renders an invoice as PDF (A4). */
export async function renderInvoicePdf(invoiceId: string): Promise<{ invoice: Invoice; pdf: Uint8Array }> {
  const inv = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      payment: {
        include: {
          club: true,
          installments: { orderBy: { index: "asc" } },
          registration: { include: { child: true, category: true } },
          order: { include: { items: true } },
        },
      },
    },
  });
  const payer = await prisma.user.findUniqueOrThrow({ where: { id: inv.payerId }, include: { family: true } });
  const p = inv.payment;
  const inst = p.installments.find((i) => i.id === inv.installmentId)!;
  const club = p.club;
  const plat = platformIdentity();

  const doc = await PDFDocument.create();
  doc.setTitle(`Facture ${inv.number}`);
  doc.setAuthor(inv.issuer === "CLUB" ? club.name : plat.name);
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.055, 0.082, 0.07), muted = rgb(0.36, 0.42, 0.39), green = rgb(0.043, 0.239, 0.18), lime = rgb(0.776, 0.957, 0.196);
  const text = (pg: PDFPage, s: string, x: number, y: number, o: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb> } = {}) =>
    pg.drawText(safe(s), { x, y, size: o.size ?? 10, font: o.f ?? font, color: o.color ?? ink });
  const right = (s: string, xr: number, y: number, o: { size?: number; f?: PDFFont } = {}) => {
    const w = (o.f ?? font).widthOfTextAtSize(safe(s), o.size ?? 10);
    text(page, s, xr - w, y, o);
  };

  // header band
  page.drawRectangle({ x: 0, y: 781.89, width: 595.28, height: 60, color: green });
  text(page, "LICEN", 40, 803, { size: 22, f: bold, color: rgb(1, 1, 1) });
  text(page, "GO", 40 + bold.widthOfTextAtSize("LICEN", 22), 803, { size: 22, f: bold, color: lime });
  page.drawText(safe(`FACTURE N° ${inv.number}`), { x: 555 - bold.widthOfTextAtSize(safe(`FACTURE N° ${inv.number}`), 12), y: 808, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText(safe(`Date : ${day(inv.issuedAt)}`), { x: 555 - font.widthOfTextAtSize(safe(`Date : ${day(inv.issuedAt)}`), 10), y: 792, size: 10, font, color: rgb(1, 1, 1) });

  // issuer / customer
  let y = 745;
  text(page, "ÉMETTEUR", 40, y, { size: 8, f: bold, color: muted });
  text(page, "CLIENT", 320, y, { size: 8, f: bold, color: muted });
  y -= 16;
  const issuerLines = inv.issuer === "CLUB"
    ? [club.name, club.address ?? "", `${club.postalCode} ${club.city}`, club.federationNumber ? `N° d'affiliation : ${club.federationNumber}` : "", "Association loi 1901"]
    : [plat.name, plat.address, plat.siren, plat.vatNumber];
  const customerLines = [`${payer.firstName} ${payer.lastName}`, payer.email, [payer.family?.address, payer.family?.postalCode, payer.family?.city].filter(Boolean).join(" ")];
  issuerLines.filter(Boolean).forEach((l, i) => text(page, l, 40, y - i * 14, { f: i === 0 ? bold : font }));
  customerLines.filter(Boolean).forEach((l, i) => text(page, l, 320, y - i * 14, { f: i === 0 ? bold : font }));

  // object
  y = 640;
  const object = p.registration
    ? `Licence ${p.registration.season} - ${p.registration.child.firstName} ${p.registration.child.lastName} - ${p.registration.category.name}`
    : `Commande boutique ${p.order?.number ?? ""}`;
  text(page, "Objet", 40, y, { size: 8, f: bold, color: muted });
  text(page, object + (p.installmentsCount > 1 ? ` (échéance ${inst.index}/${p.installmentsCount})` : ""), 40, y - 14, { f: bold });

  // lines table
  y = 590;
  page.drawRectangle({ x: 40, y: y - 6, width: 515, height: 22, color: rgb(0.965, 0.961, 0.945) });
  text(page, "Désignation", 48, y, { f: bold, size: 9 });
  right("Montant", 547, y, { f: bold, size: 9 });
  y -= 26;
  const lines: [string, number][] =
    inv.issuer === "PLATFORM"
      ? [[`Frais de service LICENGO (gestion du dossier et du paiement en ligne)`, inv.amountCents]]
      : p.registration
        ? [[`Cotisation ${club.name}${p.installmentsCount > 1 ? ` - échéance ${inst.index}/${p.installmentsCount}` : ""}`, inv.amountCents]]
        : (p.order?.items ?? []).map((i) => [`${i.productName} - taille ${i.size} x ${i.quantity}${i.personalization ? ` (flocage "${i.personalization}")` : ""}`, i.unitPriceCents * i.quantity] as [string, number]);
  for (const [label, amount] of lines) {
    text(page, label.length > 80 ? label.slice(0, 79) + "…" : label, 48, y);
    right(eur(amount), 547, y);
    y -= 18;
  }
  page.drawLine({ start: { x: 40, y: y + 6 }, end: { x: 555, y: y + 6 }, thickness: 0.5, color: rgb(0.89, 0.9, 0.88) });
  y -= 10;
  const totals: [string, string, boolean][] =
    inv.issuer === "PLATFORM"
      ? [["Total HT", eur(inv.amountCents - inv.vatCents), false], [`TVA ${PLATFORM_VAT_BPS / 100} %`, eur(inv.vatCents), false], ["Total TTC", eur(inv.amountCents), true]]
      : [["Total", eur(inv.amountCents), true]];
  for (const [l, v, strong] of totals) {
    right(l, 440, y, { f: strong ? bold : font, size: strong ? 11 : 10 });
    right(v, 547, y, { f: strong ? bold : font, size: strong ? 11 : 10 });
    y -= 16;
  }

  // payment block
  y -= 14;
  page.drawRectangle({ x: 40, y: y - 34, width: 515, height: 46, color: rgb(0.933, 0.969, 0.949) });
  text(page, `ACQUITTÉE - payée le ${day(inst.paidAt ?? inv.issuedAt)} par carte bancaire via LICENGO`, 50, y - 4, { f: bold, color: green });
  text(page, `Montant total débité ce jour : ${eur(inst.amountCents)}${p.registration ? ` (dont cotisation club ${eur(inst.clubAmountCents)} et frais LICENGO ${eur(inst.platformFeeCents)})` : ""}`, 50, y - 22, { size: 9, color: muted });
  y -= 60;

  const remaining = p.installments.filter((i) => i.index > inst.index && i.status !== "PAID" && i.status !== "CANCELLED");
  if (remaining.length) {
    text(page, "Échéances restantes", 40, y, { f: bold, size: 9 });
    y -= 14;
    for (const r of remaining) { text(page, `${day(r.dueDate)} : ${eur(r.amountCents)}`, 48, y, { size: 9, color: muted }); y -= 12; }
    y -= 6;
  }

  // legal mentions
  const mentions = inv.issuer === "CLUB"
    ? ["TVA non applicable - article 261, 7-1° du CGI (activité d'une association sportive à but non lucratif envers ses membres).", "Facture émise par LICENGO au nom et pour le compte du club (mandat de facturation)."]
    : ["Pas d'escompte pour paiement anticipé. Facture acquittée : aucune pénalité de retard applicable."];
  mentions.forEach((m, i) => text(page, m, 40, 70 - i * 12, { size: 7.5, color: muted }));
  if (p.provider === "mock") {
    page.drawText("DÉMONSTRATION", { x: 120, y: 330, size: 64, font: bold, color: rgb(0.85, 0.2, 0.15), opacity: 0.12, rotate: degrees(30) });
    text(page, "Document de démonstration : aucun paiement réel n'a été effectué.", 40, 94, { size: 8, f: bold, color: rgb(0.76, 0.21, 0.17) });
  }
  return { invoice: inv, pdf: await doc.save() };
}
