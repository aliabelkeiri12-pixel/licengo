import { formatEUR } from "@licengo/core";
import { prisma } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { notifyFamily } from "../notify";
import { sendMail, appLink } from "../mail";
import type { SessionUser } from "../auth";
import { assertClubAccess, assertFamilyAccess, recompute } from "./registrations";
import { markInstallmentPaid } from "./payments";

/** Items the secretary can tick when the FFF form is incomplete. */
export const FFF_ITEMS = [
  "Certificat médical",
  "Questionnaire de santé",
  "Photo d'identité",
  "Pièce d'identité",
  "Autorisation parentale",
  "Signature du formulaire FFF",
] as const;

async function event(registrationId: string, actorId: string | null, type: string, message: string) {
  await prisma.registrationEvent.create({ data: { registrationId, actorId, type, message } });
}

/** The family declares it has filled the FFF form received by e-mail (or completed what was missing). */
export async function declareFffForm(user: SessionUser, registrationId: string) {
  const r = await assertFamilyAccess(user, registrationId);
  if (!r.club.footclubsMode) throw new AppError("Ce club n'utilise pas le formulaire FFF en ligne");
  const wasMissing = r.fffStatus === "MISSING";
  await prisma.registration.update({ where: { id: r.id }, data: { fffDeclaredAt: new Date(), fffStatus: null, fffMissing: [] } });
  await event(r.id, user.id, "FFF_DECLARED", wasMissing ? "La famille indique avoir complété les documents manquants sur le formulaire FFF" : "La famille indique avoir rempli son formulaire de licence FFF");
  return recompute(r.id, { forceStatus: ["DRAFT", "INCOMPLETE", "TO_FIX"].includes(r.status) });
}

/** The secretary checks the FFF file in Footclubs: complete, or missing items sent to the family. */
export async function checkFffForm(user: SessionUser, registrationId: string, ok: boolean, missing: string[], note?: string) {
  const r = await assertClubAccess(user, registrationId);
  if (!ok && missing.length === 0 && !note?.trim()) throw new AppError("Cochez ce qui manque ou écrivez un message");
  const list = missing.filter((m) => (FFF_ITEMS as readonly string[]).includes(m));
  await prisma.registration.update({
    where: { id: r.id },
    data: { fffStatus: ok ? "OK" : "MISSING", fffMissing: ok ? [] : [...list, ...(note?.trim() ? [note.trim()] : [])], fffCheckedAt: new Date(), ...(ok ? {} : { fffDeclaredAt: null }) },
  });
  await audit(user.id, ok ? "fff.ok" : "fff.missing", "Registration", r.id, { missing: list });
  if (ok) {
    await event(r.id, user.id, "FFF_OK", "Formulaire FFF vérifié sur Footclubs : complet");
    if (r.club.payAfterCheck && r.paymentStatus === "UNPAID")
      await notifyFamily(r.child.familyId, { type: "PAYMENT_OPEN", title: `${r.club.name} : dossier vérifié`, body: `Le dossier de ${r.child.firstName} est complet. Vous pouvez maintenant régler la licence en ligne.`, link: `/famille/inscriptions/${r.id}` });
  } else {
    const items = [...list, ...(note?.trim() ? [note.trim()] : [])];
    await event(r.id, user.id, "FFF_MISSING", `Formulaire FFF incomplet : ${items.join(", ")}`);
    const link = `/famille/inscriptions/${r.id}`;
    await notifyFamily(r.child.familyId, { type: "FFF_MISSING", title: `${r.club.name} : il manque des documents`, body: `${r.child.firstName} : ${items.join(", ")}`, link });
    const guardians = await prisma.user.findMany({ where: { familyId: r.child.familyId, deletedAt: null } });
    for (const g of guardians)
      await sendMail(g.email, `${r.club.name} : documents manquants pour la licence de ${r.child.firstName}`, [
        `Bonjour ${g.firstName},`, "",
        `Le club a vérifié votre formulaire de licence FFF. Il manque :`,
        ...items.map((i) => `  • ${i}`), "",
        "Complétez-les sur le formulaire FFF (lien reçu par email de la FFF), puis indiquez-le dans LICENGO :",
        appLink(link), "", r.club.name,
      ].join("\n"));
  }
  return recompute(r.id, { forceStatus: !["VALIDATED", "REJECTED", "CANCELLED"].includes(r.status) });
}

/** The licence has been entered / validated in Footclubs (secretary to-do list). */
export async function markFootclubsDone(user: SessionUser, registrationId: string, done: boolean) {
  const r = await assertClubAccess(user, registrationId);
  await prisma.registration.update({ where: { id: r.id }, data: { footclubsDoneAt: done ? new Date() : null } });
  await event(r.id, user.id, "FOOTCLUBS", done ? "Licence saisie / validée dans Footclubs" : "Saisie Footclubs annulée");
}

/** Payment received at the club (cash, cheque…) during a licence desk session. */
export async function recordOfflinePayment(user: SessionUser, registrationId: string, method: "ESPECES" | "CHEQUE" | "AUTRE", note?: string) {
  const r = await assertClubAccess(user, registrationId);
  if (["REJECTED", "CANCELLED"].includes(r.status)) throw new AppError("Dossier clôturé");
  if (r.payments.some((p) => !["CANCELLED", "PENDING", "REFUNDED"].includes(p.status))) throw new AppError("Un paiement existe déjà pour ce dossier");
  await prisma.payment.updateMany({ where: { registrationId: r.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  const payment = await prisma.payment.create({
    data: {
      kind: "LICENSE", registrationId: r.id, clubId: r.clubId, payerId: r.child.family.guardians[0]?.id ?? user.id,
      provider: `offline:${method}`, totalCents: r.licenseFeeCents, clubAmountCents: r.licenseFeeCents, platformFeeCents: 0, installmentsCount: 1,
      installments: { create: [{ index: 1, dueDate: new Date(), amountCents: r.licenseFeeCents, clubAmountCents: r.licenseFeeCents, platformFeeCents: 0 }] },
    },
    include: { installments: true },
  });
  await markInstallmentPaid(payment.installments[0].id, {});
  const label = { ESPECES: "espèces", CHEQUE: "chèque", AUTRE: "autre moyen" }[method];
  await event(r.id, user.id, "PAID_AT_CLUB", `Paiement reçu au club (${label}) : ${formatEUR(r.licenseFeeCents)}${note ? ` – ${note}` : ""}`);
  await audit(user.id, "payment.offline", "Payment", payment.id, { method, note: note ?? null });
  return payment;
}

/** Daily summary e-mail for club staff (works on a computer, no notification to watch). */
export async function runDailyDigest(now = new Date()) {
  const since = new Date(now.getTime() - 24 * 3600_000);
  const clubs = await prisma.club.findMany({ where: { status: "ACTIVE", dailyDigest: true }, include: { staff: { where: { role: { in: ["OWNER", "SECRETARY", "TREASURER"] } }, include: { user: true } } } });
  let sent = 0;
  for (const c of clubs) {
    const [toValidate, fffToCheck, toFix, readyFootclubs, paid] = await Promise.all([
      prisma.registration.count({ where: { clubId: c.id, status: "SUBMITTED" } }),
      c.footclubsMode ? prisma.registration.count({ where: { clubId: c.id, fffDeclaredAt: { not: null }, fffStatus: null, status: { notIn: ["REJECTED", "CANCELLED"] } } }) : Promise.resolve(0),
      prisma.registration.count({ where: { clubId: c.id, status: "TO_FIX" } }),
      prisma.registration.count({ where: { clubId: c.id, status: "VALIDATED", footclubsDoneAt: null } }),
      prisma.installment.aggregate({ where: { status: "PAID", paidAt: { gte: since }, payment: { clubId: c.id } }, _sum: { clubAmountCents: true }, _count: true }),
    ]);
    if (toValidate + fffToCheck + toFix + readyFootclubs + paid._count === 0) continue;
    const lines = [
      ...(fffToCheck ? [`• ${fffToCheck} formulaire(s) FFF à vérifier sur Footclubs`] : []),
      `• ${toValidate} dossier(s) complet(s) à valider`,
      `• ${readyFootclubs} licence(s) validée(s) à saisir dans Footclubs`,
      `• ${toFix} dossier(s) en attente de correction par les familles`,
      `• ${paid._count} paiement(s) reçu(s) en 24 h : ${formatEUR(paid._sum.clubAmountCents ?? 0)}`,
    ];
    for (const s of c.staff) {
      await sendMail(s.user.email, `LICENGO – ${c.name} : votre récapitulatif du jour`, [`Bonjour ${s.user.firstName},`, "", ...lines, "", `Tout traiter : ${appLink("/club/dossiers")}`, "", "Pour ne plus recevoir ce récapitulatif : Paramètres du club."].join("\n"));
      sent++;
    }
  }
  return { sent };
}
