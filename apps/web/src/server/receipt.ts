import { formatEUR } from "@licengo/core";
import { prisma } from "./db";
import { sendMail, appLink } from "./mail";

export interface ReceiptData {
  number: string;
  paidAt: Date;
  payer: { name: string; email: string };
  club: { name: string; address: string };
  title: string; // "Licence 2026-2027 – Léo Martin – U11" or "Commande LG-2026-ABC123"
  lines: { label: string; amountCents: number }[];
  totalCents: number; // amount debited now
  clubCents: number;
  feeCents: number;
  installment?: { index: number; count: number; remaining: { dueDate: Date; amountCents: number }[] };
  simulated: boolean;
  link: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const day = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(d);

/** Builds the receipt / invoice e-mail (text + HTML). Pure function, unit-testable. */
export function buildReceiptEmail(r: ReceiptData) {
  const subject = `Votre reçu LICENGO n° ${r.number} – ${formatEUR(r.totalCents)}`;
  const inst = r.installment && r.installment.count > 1 ? ` (échéance ${r.installment.index}/${r.installment.count})` : "";
  const text = [
    `Bonjour ${r.payer.name},`,
    "",
    `Merci pour votre paiement. Voici votre reçu.`,
    "",
    `Reçu n° ${r.number} – payé le ${day(r.paidAt)}`,
    `${r.title}${inst}`,
    `Club : ${r.club.name}`,
    "",
    ...r.lines.map((l) => `${l.label} : ${formatEUR(l.amountCents)}`),
    `TOTAL PAYÉ : ${formatEUR(r.totalCents)}`,
    `  dont reversé au club : ${formatEUR(r.clubCents)}`,
    `  dont frais de service LICENGO : ${formatEUR(r.feeCents)}`,
    ...(r.installment?.remaining.length ? ["", "Prochaines échéances :", ...r.installment.remaining.map((x) => `  ${day(x.dueDate)} : ${formatEUR(x.amountCents)}`)] : []),
    "",
    r.simulated ? "⚠ Paiement de démonstration : aucune somme n'a été réellement débitée." : "Paiement par carte bancaire sécurisé (Stripe).",
    `Retrouvez vos paiements : ${r.link}`,
    "",
    "LICENGO",
  ].join("\n");

  const row = (l: string, v: string, strong = false) =>
    `<tr><td style="padding:6px 0;color:${strong ? "#0E1512" : "#5B6B64"};${strong ? "font-weight:700" : ""}">${l}</td><td style="padding:6px 0;text-align:right;${strong ? "font-weight:700" : ""}">${v}</td></tr>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#F6F5F1;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0E1512">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E3E6E1">
<tr><td style="background:#0A2A1F;padding:20px 24px;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px">LICEN<span style="color:#C6F432">GO</span></td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1B6B52">Reçu de paiement</p>
<p style="margin:0;font-size:22px;font-weight:800">${formatEUR(r.totalCents)} payés</p>
<p style="margin:4px 0 16px;color:#5B6B64;font-size:14px">N° ${esc(r.number)} · ${day(r.paidAt)}</p>
${r.simulated ? `<p style="margin:0 0 16px;padding:10px 12px;border-radius:10px;background:#FFF7E6;color:#8A5300;font-size:13px">Paiement de démonstration : aucune somme n'a été réellement débitée.</p>` : ""}
<p style="margin:0 0 4px;font-size:14px">Bonjour ${esc(r.payer.name)},</p>
<p style="margin:0 0 16px;font-size:14px;color:#5B6B64">Merci pour votre paiement à <b style="color:#0E1512">${esc(r.club.name)}</b>.</p>
<p style="margin:0 0 8px;font-weight:700;font-size:15px">${esc(r.title)}${esc(inst)}</p>
<table role="presentation" width="100%" style="font-size:14px;border-top:1px solid #E3E6E1;border-bottom:1px solid #E3E6E1">
${r.lines.map((l) => row(esc(l.label), formatEUR(l.amountCents))).join("")}
${row("Total payé", formatEUR(r.totalCents), true)}
${row("dont reversé au club", formatEUR(r.clubCents))}
${row("dont frais de service LICENGO", formatEUR(r.feeCents))}
</table>
${r.installment?.remaining.length ? `<p style="margin:16px 0 4px;font-weight:700;font-size:14px">Prochaines échéances</p><table role="presentation" width="100%" style="font-size:14px">${r.installment.remaining.map((x) => row(day(x.dueDate), formatEUR(x.amountCents))).join("")}</table>` : ""}
<p style="margin:24px 0 0"><a href="${esc(r.link)}" style="display:inline-block;background:#C6F432;color:#04130D;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Voir mes paiements</a></p>
</td></tr>
<tr><td style="padding:16px 24px;background:#F6F5F1;color:#5B6B64;font-size:12px">Payeur : ${esc(r.payer.name)} (${esc(r.payer.email)})<br>Club : ${esc(r.club.name)}${r.club.address ? ` – ${esc(r.club.address)}` : ""}<br>Ce reçu vous est adressé par LICENGO pour le compte du club.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Loads the paid installment and e-mails the receipt to the payer account's address. Never throws. */
export async function sendPaymentReceipt(installmentId: string): Promise<boolean> {
  try {
    const inst = await prisma.installment.findUnique({
      where: { id: installmentId },
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
    if (!inst || inst.status !== "PAID") return false;
    const p = inst.payment;
    const payer = await prisma.user.findUnique({ where: { id: p.payerId } });
    if (!payer || payer.deletedAt) return false;
    const year = (inst.paidAt ?? new Date()).getFullYear();
    let title: string;
    let lines: { label: string; amountCents: number }[];
    let link: string;
    if (p.registration) {
      const r = p.registration;
      title = `Licence ${r.season} – ${r.child.firstName} ${r.child.lastName} – ${r.category.name}`;
      lines = [
        { label: p.installmentsCount > 1 ? `Cotisation licence (part de l'échéance ${inst.index})` : "Cotisation licence", amountCents: inst.clubAmountCents },
        ...(inst.platformFeeCents ? [{ label: "Frais de service LICENGO", amountCents: inst.platformFeeCents }] : []),
      ];
      link = appLink(`/famille/inscriptions/${r.id}`);
    } else {
      title = `Commande boutique ${p.order?.number ?? ""}`.trim();
      lines = (p.order?.items ?? []).map((i) => ({ label: `${i.productName} – ${i.size} × ${i.quantity}${i.personalization ? ` (flocage « ${i.personalization} »)` : ""}`, amountCents: i.unitPriceCents * i.quantity }));
      link = appLink(p.order ? `/commandes/${p.order.id}` : "/famille/paiements");
    }
    const mail = buildReceiptEmail({
      number: `FAC-${year}-${inst.id.slice(-8).toUpperCase()}`,
      paidAt: inst.paidAt ?? new Date(),
      payer: { name: `${payer.firstName} ${payer.lastName}`, email: payer.email },
      club: { name: p.club.name, address: [p.club.address, p.club.postalCode, p.club.city].filter(Boolean).join(" ") },
      title,
      lines,
      totalCents: inst.amountCents,
      clubCents: inst.clubAmountCents,
      feeCents: inst.platformFeeCents,
      installment: { index: inst.index, count: p.installmentsCount, remaining: p.installments.filter((x) => x.index > inst.index && x.status === "SCHEDULED").map((x) => ({ dueDate: x.dueDate, amountCents: x.amountCents })) },
      simulated: p.provider === "mock",
      link,
    });
    return await sendMail(payer.email, mail.subject, mail.text, mail.html);
  } catch (e) {
    console.error("receipt failed", e);
    return false;
  }
}
