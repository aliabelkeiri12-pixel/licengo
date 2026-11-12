import { createHash } from "node:crypto";
import type { Prisma, RegistrationStatus, SignatureType } from "@prisma/client";
import { canTransition, evaluateCompleteness, SIGNATURE_LABELS, seasonLabel, seasonStartYear, type SportRules, type DocumentType, type SignableDocument } from "@licengo/core";
import { prisma } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import { notifyClubStaff, notifyFamily } from "../notify";
import { audit } from "../audit";
import type { SessionUser } from "../auth";

export const currentSeason = (date = new Date()) => seasonLabel(seasonStartYear(date, 7));
export const nextSeason = (s: string) => { const y = Number(s.slice(0, 4)) + 1; return seasonLabel(y); };

const fullInclude = {
  child: { include: { family: { include: { guardians: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } } } },
  category: true,
  club: { include: { sport: true, plan: true } },
  signatures: true,
  payments: { include: { installments: { orderBy: { index: "asc" } }, refunds: true }, orderBy: { createdAt: "desc" } },
  events: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.RegistrationInclude;

export type FullRegistration = Prisma.RegistrationGetPayload<{ include: typeof fullInclude }>;

export async function getRegistration(id: string) {
  const r = await prisma.registration.findUnique({ where: { id }, include: fullInclude });
  if (!r) throw notFound("Dossier");
  return r;
}

/** Documents usable for a registration: those of the child (reusable photo / ID) + those attached to it. */
export function registrationDocuments(childId: string) {
  return prisma.document.findMany({ where: { childId, deletedAt: null }, orderBy: { createdAt: "desc" } });
}

export async function assertFamilyAccess(user: SessionUser, registrationId: string) {
  const r = await getRegistration(registrationId);
  if (user.role !== "ADMIN" && r.child.familyId !== user.familyId) throw forbidden();
  return r;
}

export async function assertClubAccess(user: SessionUser, registrationId: string) {
  const r = await getRegistration(registrationId);
  if (user.role !== "ADMIN" && !user.staff.some((s) => s.clubId === r.clubId)) throw forbidden();
  return r;
}

export async function computeCompleteness(r: FullRegistration) {
  const docs = await registrationDocuments(r.childId);
  const guardian = r.child.family.guardians[0];
  return evaluateCompleteness({
    child: { firstName: r.child.firstName, lastName: r.child.lastName, birthDate: r.child.birthDate, gender: r.child.gender === "MIXED" ? null : r.child.gender },
    category: { name: r.category.name, birthYearMin: r.category.birthYearMin, birthYearMax: r.category.birthYearMax, gender: r.category.gender },
    rules: r.club.sport.rules as unknown as SportRules,
    documents: docs.map((d) => ({ type: d.type as DocumentType, status: d.status, expiresAt: d.expiresAt, rejectReason: d.rejectReason })),
    signatures: r.signatures.filter((s) => s.accepted).map((s) => s.type as SignableDocument),
    healthAnswer: (r.healthAnswer as "ALL_NO" | "SOME_YES" | null) ?? null,
    guardian: guardian ? { phone: guardian.phone, email: guardian.email } : undefined,
  });
}

const stateToStatus = { COMPLETE: "SUBMITTED", INCOMPLETE: "INCOMPLETE", TO_FIX: "TO_FIX" } as const;

/** Re-evaluates the file after any change; auto-moves status while the file is in the club's queue. */
export async function recompute(registrationId: string, opts: { forceStatus?: boolean } = {}) {
  const r = await getRegistration(registrationId);
  const c = await computeCompleteness(r);
  const data: Prisma.RegistrationUpdateInput = { missingSummary: c.summary, progress: c.progress };
  const auto: RegistrationStatus[] = ["SUBMITTED", "INCOMPLETE"];
  // Simplicity: a file that becomes complete is sent to the club automatically (no "submit" button to find)
  const autoSubmit = c.state === "COMPLETE" && (r.status === "DRAFT" || r.status === "TO_FIX");
  if (opts.forceStatus || auto.includes(r.status) || autoSubmit) {
    const next = stateToStatus[c.state];
    if (next !== r.status) {
      data.status = next;
      if (next === "SUBMITTED") data.submittedAt = new Date();
    }
  }
  await prisma.registration.update({ where: { id: r.id }, data });
  if (data.status === "SUBMITTED") {
    await event(r.id, null, "SUBMITTED", "Dossier complet transmis automatiquement au club");
    await notifyClubStaff(r.clubId, { type: "REGISTRATION_SUBMITTED", title: "Nouveau dossier complet", body: `${r.child.firstName} ${r.child.lastName} – ${r.category.name}`, link: `/club/dossiers/${r.id}` });
  }
  return { ...c, status: (data.status as RegistrationStatus) ?? r.status };
}

async function event(registrationId: string, actorId: string | null, type: string, message: string) {
  await prisma.registrationEvent.create({ data: { registrationId, actorId, type, message } });
}

export type Extra = { id: string; label: string; amountCents: number };
export const extrasOf = (json: unknown): Extra[] => (Array.isArray(json) ? (json as Extra[]) : []);

/** Mandatory supplements of the club + the optional ones chosen (ids validated against the club). */
async function selectExtras(clubId: string, optionalIds: string[]): Promise<Extra[]> {
  const fees = await prisma.clubFee.findMany({ where: { clubId, active: true }, orderBy: { createdAt: "asc" } });
  return fees.filter((f) => f.mandatory || optionalIds.includes(f.id)).map((f) => ({ id: f.id, label: f.label, amountCents: f.amountCents }));
}

export async function createRegistration(user: SessionUser, childId: string, categoryId: string, optionalExtraIds: string[] = []) {
  const child = await prisma.child.findFirst({ where: { id: childId, familyId: user.familyId ?? "-", deletedAt: null } });
  if (!child) throw notFound("Enfant");
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { club: { include: { plan: true } }, _count: { select: { registrations: { where: { status: { notIn: ["REJECTED", "CANCELLED"] } } } } } } });
  if (!category || !category.open) throw new AppError("Catégorie fermée aux inscriptions");
  if (category.club.status !== "ACTIVE") throw new AppError("Ce club n'accepte pas encore les inscriptions en ligne");
  if (category.capacity && category._count.registrations >= category.capacity) throw new AppError("Catégorie complète – contactez le club pour la liste d'attente");
  const existing = await prisma.registration.findUnique({ where: { childId_clubId_season: { childId, clubId: category.clubId, season: category.season } } });
  if (existing && existing.status === "CANCELLED") {
    // the family re-registers after cancelling: reopen the same file with the chosen category and supplements
    const extras = await selectExtras(category.clubId, optionalExtraIds);
    const reopened = await prisma.registration.update({
      where: { id: existing.id },
      data: { status: "DRAFT", categoryId, extras, licenseFeeCents: category.priceCents + extras.reduce((t, e) => t + e.amountCents, 0), decisionReason: null },
    });
    await event(existing.id, user.id, "CREATED", "Inscription relancée par la famille");
    await recompute(existing.id);
    return reopened;
  }
  if (existing) return existing;
  const previous = await prisma.registration.findFirst({ where: { childId, clubId: category.clubId, status: "VALIDATED" }, orderBy: { createdAt: "desc" } });
  const extras = await selectExtras(category.clubId, optionalExtraIds);
  const reg = await prisma.registration.create({
    data: {
      childId, clubId: category.clubId, categoryId, season: category.season,
      extras,
      licenseFeeCents: category.priceCents + extras.reduce((t, e) => t + e.amountCents, 0),
      platformFeeCents: category.club.plan?.licenseFeeCents ?? 499,
      renewalOfId: previous?.id,
    },
  });
  await event(reg.id, user.id, "CREATED", previous ? "Renouvellement de licence créé" : "Dossier créé par la famille");
  await recompute(reg.id);
  await audit(user.id, "registration.create", "Registration", reg.id);
  return reg;
}

/** Secretary adds / removes optional supplements (e.g. transfer fee) on a file, before any payment. */
export async function setRegistrationExtras(user: SessionUser, registrationId: string, optionalExtraIds: string[]) {
  const r = await assertClubAccess(user, registrationId);
  if (r.paymentStatus !== "UNPAID" || r.payments.some((p) => !["CANCELLED", "PENDING"].includes(p.status)))
    throw new AppError("Un paiement a déjà été effectué : les suppléments ne peuvent plus être modifiés");
  const extras = await selectExtras(r.clubId, optionalExtraIds);
  const total = r.category.priceCents + extras.reduce((t, e) => t + e.amountCents, 0);
  await prisma.registration.update({ where: { id: r.id }, data: { extras, licenseFeeCents: total } });
  await event(r.id, user.id, "EXTRAS", extras.length ? `Suppléments : ${extras.map((e) => `${e.label} (${(e.amountCents / 100).toFixed(2).replace(".", ",")} €)`).join(", ")}` : "Aucun supplément");
  await notifyFamily(r.child.familyId, { type: "EXTRAS_UPDATED", title: `${r.club.name} : tarif mis à jour`, body: `Licence de ${r.child.firstName} : ${(total / 100).toFixed(2).replace(".", ",")} €${extras.length ? ` (dont ${extras.map((e) => e.label).join(", ")})` : ""}`, link: `/famille/inscriptions/${r.id}` });
  await audit(user.id, "registration.extras", "Registration", r.id, { extras });
  return total;
}

export async function submitRegistration(user: SessionUser, registrationId: string) {
  const r = await assertFamilyAccess(user, registrationId);
  if (r.status === "SUBMITTED") return recompute(registrationId); // already sent automatically
  if (!["DRAFT", "INCOMPLETE", "TO_FIX"].includes(r.status)) throw new AppError("Ce dossier ne peut plus être modifié");
  const res = await recompute(registrationId, { forceStatus: true });
  if (res.status !== "SUBMITTED") await event(r.id, user.id, "SUBMITTED", `Dossier transmis incomplet (${res.summary.length} point(s))`);
  return res;
}

export async function decide(user: SessionUser, registrationId: string, decision: "VALIDATE" | "REJECT" | "REQUEST_CHANGES" | "REOPEN", reason?: string) {
  if (decision === "REOPEN") return reopenRegistration(user, registrationId, reason);
  const r = await assertClubAccess(user, registrationId);
  const target: RegistrationStatus = decision === "VALIDATE" ? "VALIDATED" : decision === "REJECT" ? "REJECTED" : "TO_FIX";
  if (!canTransition(r.status, target)) throw new AppError(`Action impossible depuis le statut actuel`);
  if (decision === "VALIDATE") {
    const c = await computeCompleteness(r);
    if (c.state !== "COMPLETE") throw new AppError(`Dossier incomplet : ${c.summary.join(", ")}`);
  } else if (!reason || reason.trim().length < 3) throw new AppError("Un motif est obligatoire");
  await prisma.registration.update({
    where: { id: r.id },
    data: { status: target, decisionReason: decision === "VALIDATE" ? null : reason, validatedAt: decision === "VALIDATE" ? new Date() : undefined },
  });
  if (decision === "REJECT") {
    // a refused licence must not keep charging the family
    const stopped = await prisma.installment.updateMany({ where: { payment: { registrationId: r.id }, status: { in: ["SCHEDULED", "FAILED"] } }, data: { status: "CANCELLED" } });
    const paid = await prisma.installment.aggregate({ where: { payment: { registrationId: r.id }, status: "PAID" }, _sum: { amountCents: true } });
    if (stopped.count) await event(r.id, user.id, "PAYMENTS_STOPPED", `${stopped.count} échéance(s) à venir annulée(s)`);
    if (paid._sum.amountCents)
      await notifyClubStaff(r.clubId, { type: "REFUND_NEEDED", title: "Remboursement à prévoir", body: `${r.child.firstName} ${r.child.lastName} : inscription refusée alors que ${(paid._sum.amountCents / 100).toFixed(2).replace(".", ",")} € ont été payés.`, link: `/club/dossiers/${r.id}` });
  }
  const label = { VALIDATE: "Dossier validé", REJECT: "Dossier refusé", REQUEST_CHANGES: "Modification demandée" }[decision];
  await event(r.id, user.id, decision, reason ? `${label} : ${reason}` : label);
  await audit(user.id, `registration.${decision.toLowerCase()}`, "Registration", r.id, { reason: reason ?? null });
  await notifyFamily(r.child.familyId, {
    type: `REGISTRATION_${decision}`,
    title: `${r.club.name} – ${label}`,
    body: decision === "VALIDATE" ? `L'inscription de ${r.child.firstName} en ${r.category.name} est validée. Bienvenue au club !` : `${r.child.firstName} : ${reason}`,
    link: `/famille/inscriptions/${r.id}`,
  });
}

/** Reopens a file refused by mistake: the family can correct it again. */
export async function reopenRegistration(user: SessionUser, registrationId: string, reason?: string) {
  const r = await assertClubAccess(user, registrationId);
  if (r.status !== "REJECTED") throw new AppError("Seul un dossier refusé peut être rouvert");
  const message = reason?.trim() || "Merci de renvoyer les documents demandés.";
  await prisma.registration.update({ where: { id: r.id }, data: { status: "TO_FIX", decisionReason: message } });
  await event(r.id, user.id, "REOPEN", `Dossier rouvert par le club : ${message}`);
  await audit(user.id, "registration.reopen", "Registration", r.id);
  await notifyFamily(r.child.familyId, { type: "REGISTRATION_REOPENED", title: `${r.club.name} – dossier à compléter`, body: `${r.child.firstName} : ${message}`, link: `/famille/inscriptions/${r.id}` });
}

export async function setHealthAnswer(user: SessionUser, registrationId: string, answer: "ALL_NO" | "SOME_YES") {
  await assertFamilyAccess(user, registrationId);
  await prisma.registration.update({ where: { id: registrationId }, data: { healthAnswer: answer } });
  if (answer === "SOME_YES") await prisma.signature.deleteMany({ where: { registrationId, type: "HEALTH_QUESTIONNAIRE" } });
  return recompute(registrationId);
}

export async function signDocument(
  user: SessionUser,
  registrationId: string,
  type: SignatureType,
  input: { signerName: string; accepted: boolean; imageKey?: string; ip?: string; userAgent?: string },
) {
  const r = await assertFamilyAccess(user, registrationId);
  if (["VALIDATED", "REJECTED", "CANCELLED"].includes(r.status)) throw new AppError("Dossier clôturé");
  if (type === "HEALTH_QUESTIONNAIRE" && r.healthAnswer !== "ALL_NO") throw new AppError("Répondez d'abord au questionnaire de santé");
  if (input.signerName.trim().length < 3) throw new AppError("Nom du signataire requis");
  const signedAt = new Date();
  const text = SIGNATURE_LABELS[type as SignableDocument];
  const contentHash = createHash("sha256").update(JSON.stringify({ text, registrationId, child: r.childId, signer: user.id, name: input.signerName, accepted: input.accepted, at: signedAt.toISOString() })).digest("hex");
  await prisma.signature.upsert({
    where: { registrationId_type: { registrationId, type } },
    create: { registrationId, type, signerId: user.id, signerName: input.signerName.trim(), accepted: input.accepted, contentHash, imageKey: input.imageKey, ip: input.ip, userAgent: input.userAgent, signedAt },
    update: { signerId: user.id, signerName: input.signerName.trim(), accepted: input.accepted, contentHash, imageKey: input.imageKey, ip: input.ip, userAgent: input.userAgent, signedAt },
  });
  if (type === "IMAGE_RIGHTS") await prisma.registration.update({ where: { id: registrationId }, data: { imageRightsOk: input.accepted } });
  await event(registrationId, user.id, "SIGNED", `${input.accepted ? "Signé" : "Refusé"} : ${text}`);
  return recompute(registrationId);
}

export async function cancelRegistration(user: SessionUser, registrationId: string) {
  const r = await assertFamilyAccess(user, registrationId);
  if (!canTransition(r.status, "CANCELLED")) throw new AppError("Annulation impossible");
  if (r.paymentStatus !== "UNPAID") throw new AppError("Un paiement a été effectué : contactez le club pour un remboursement");
  await prisma.registration.update({ where: { id: r.id }, data: { status: "CANCELLED" } });
  await event(r.id, user.id, "CANCELLED", "Dossier annulé par la famille");
}

/** Annual renewal: re-creates the file for next season in the right age category, documents are re-used. */
export async function renewRegistration(user: SessionUser, previousId: string) {
  const prev = await assertFamilyAccess(user, previousId);
  const season = nextSeason(prev.season);
  const year = prev.child.birthDate.getUTCFullYear();
  const category = await prisma.category.findFirst({ where: { clubId: prev.clubId, season, open: true, birthYearMin: { lte: year }, birthYearMax: { gte: year } } });
  if (!category) throw new AppError(`Le club n'a pas encore ouvert les inscriptions ${season}`);
  return createRegistration(user, prev.childId, category.id);
}

/** Automatic reminders (cron): incomplete files, files to fix, unpaid installments, renewals. */
export async function runReminders(now = new Date()) {
  let sent = 0;
  const clubs = await prisma.club.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, reminderEveryDays: true } });
  for (const club of clubs) {
    const threshold = new Date(now.getTime() - club.reminderEveryDays * 86400_000);
    const regs = await prisma.registration.findMany({
      where: {
        clubId: club.id,
        status: { in: ["DRAFT", "INCOMPLETE", "TO_FIX"] },
        updatedAt: { lt: threshold },
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: threshold } }],
      },
      include: { child: true },
    });
    for (const r of regs) {
      await notifyFamily(r.child.familyId, {
        type: "REMINDER",
        title: `${club.name} : dossier de ${r.child.firstName} à compléter`,
        body: r.missingSummary.slice(0, 3).join(" • ") || "Finalisez et envoyez le dossier.",
        link: `/famille/inscriptions/${r.id}`,
      });
      await prisma.registration.update({ where: { id: r.id }, data: { lastReminderAt: now } });
      await event(r.id, null, "REMINDER", "Relance automatique envoyée à la famille");
      sent++;
    }
  }
  return { sent };
}
