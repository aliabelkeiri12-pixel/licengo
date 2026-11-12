"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { childSchema, installmentsSchema, DOCUMENT_TYPES, SIGNABLE_DOCUMENTS, phoneFR, addressSchema } from "@licengo/core";
import type { DocumentType, SignatureType } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireUser, clientInfo, logout } from "@/server/auth";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { storeEncrypted } from "@/server/storage";
import { createRegistration, submitRegistration, setHealthAnswer, signDocument, renewRegistration, cancelRegistration } from "@/server/services/registrations";
import { uploadDocument, deleteDocument, sniffMime } from "@/server/services/documents";
import { startLicensePayment, retryInstallmentCheckout, startShopPayment } from "@/server/services/payments";
import { addToCart, updateCartItem, checkoutCart, cancelUnpaidOrder } from "@/server/services/shop";
import { safe } from "@/lib/safe-action";
import type { ActionState } from "@/lib/action-state";

const family = async () => {
  const u = await requireUser("FAMILY");
  if (!u.familyId) throw new AppError("Compte famille introuvable");
  return u as typeof u & { familyId: string };
};
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function saveChildAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await safe(async () => {
    const u = await family();
    const data = childSchema.parse({ ...Object.fromEntries(fd), isSelf: fd.get("isSelf") === "on" });
    const payload = { firstName: data.firstName, lastName: data.lastName, birthDate: data.birthDate, gender: data.gender, birthPlace: data.birthPlace || null, nationality: data.nationality || null, isSelf: !!data.isSelf };
    const existingId = str(fd, "id");
    if (existingId) {
      const c = await prisma.child.findFirst({ where: { id: existingId, familyId: u.familyId } });
      if (!c) throw new AppError("Enfant introuvable");
      await prisma.child.update({ where: { id: c.id }, data: payload });
      id = c.id;
    } else {
      const count = await prisma.child.count({ where: { familyId: u.familyId, deletedAt: null } });
      if (count >= 12) throw new AppError("Nombre maximum de membres atteint");
      id = (await prisma.child.create({ data: { ...payload, familyId: u.familyId } })).id;
    }
    await audit(u.id, existingId ? "child.update" : "child.create", "Child", id);
    const regs = await prisma.registration.findMany({ where: { childId: id, status: { notIn: ["VALIDATED", "REJECTED", "CANCELLED"] } } });
    const { recompute } = await import("@/server/services/registrations");
    for (const r of regs) await recompute(r.id);
  });
  if (res) return res;
  const next = str(fd, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : `/famille/enfants/${id}?ok=1`);
}

export async function deleteChildAction(fd: FormData) {
  const u = await family();
  const c = await prisma.child.findFirst({ where: { id: str(fd, "id"), familyId: u.familyId }, include: { registrations: { where: { status: { notIn: ["CANCELLED", "REJECTED"] } } } } });
  if (!c) return;
  if (c.registrations.length) throw new AppError("Cet enfant a une inscription en cours");
  await prisma.child.update({ where: { id: c.id }, data: { deletedAt: new Date() } });
  await prisma.document.updateMany({ where: { childId: c.id }, data: { deletedAt: new Date() } });
  await audit(u.id, "child.delete", "Child", c.id);
  redirect("/famille/enfants");
}

export async function createRegistrationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await safe(async () => {
    const u = await family();
    id = (await createRegistration(u, str(fd, "childId"), str(fd, "categoryId"), fd.getAll("extras").map(String))).id;
  });
  if (res) return res;
  redirect(`/famille/inscriptions/${id}`);
}

export async function uploadDocumentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const u = await family();
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AppError("Sélectionnez ou photographiez un fichier");
    const type = z.enum(DOCUMENT_TYPES).parse(fd.get("type")) as DocumentType;
    const exp = str(fd, "expiresAt");
    await uploadDocument(u, { childId: str(fd, "childId"), registrationId: str(fd, "registrationId") || null, type, file, expiresAt: exp ? new Date(exp) : null });
    revalidatePath("/famille", "layout");
    return { ok: "Document envoyé ✔" };
  });
}

export async function deleteDocumentAction(fd: FormData) {
  const u = await family();
  await deleteDocument(u, str(fd, "id"));
  revalidatePath("/famille", "layout");
}

export async function healthAnswerAction(fd: FormData) {
  const u = await family();
  await setHealthAnswer(u, str(fd, "registrationId"), z.enum(["ALL_NO", "SOME_YES"]).parse(fd.get("answer")));
  revalidatePath(`/famille/inscriptions/${str(fd, "registrationId")}`);
}

export async function signAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const u = await family();
    const type = z.enum(SIGNABLE_DOCUMENTS).parse(fd.get("type")) as SignatureType;
    const accepted = str(fd, "accepted") !== "false";
    let imageKey: string | undefined;
    const sig = str(fd, "signature");
    if (accepted) {
      const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(sig);
      if (!m) throw new AppError("Merci de signer dans le cadre");
      const buf = Buffer.from(m[1], "base64");
      if (buf.length > 400_000 || sniffMime(buf) !== "image/png") throw new AppError("Signature invalide");
      imageKey = (await storeEncrypted(`families/${u.familyId}/signatures`, buf)).key;
    }
    const info = await clientInfo();
    await signDocument(u, str(fd, "registrationId"), type, { signerName: str(fd, "signerName"), accepted, imageKey, ip: info.ip, userAgent: info.userAgent.slice(0, 250) });
    revalidatePath(`/famille/inscriptions/${str(fd, "registrationId")}`);
    return { ok: accepted ? "Document signé ✔" : "Réponse enregistrée" };
  });
}

export async function submitRegistrationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const u = await family();
    const r = await submitRegistration(u, str(fd, "registrationId"));
    revalidatePath(`/famille/inscriptions/${str(fd, "registrationId")}`);
    return r.status === "SUBMITTED" ? { ok: "Dossier complet envoyé au club 🎉" } : { error: `Dossier envoyé mais incomplet : ${r.summary.join(" · ")}` };
  });
}

export async function startPaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let url = "";
  const res = await safe(async () => {
    const u = await family();
    url = (await startLicensePayment(u, str(fd, "registrationId"), installmentsSchema.parse(fd.get("installments")), { acceptBalanceClause: fd.get("balanceClause") === "on" })).url;
  });
  if (res) return res;
  redirect(url);
}

export async function retryInstallmentAction(fd: FormData) {
  const u = await family();
  const { url } = await retryInstallmentCheckout(u, str(fd, "installmentId"));
  redirect(url);
}

export async function renewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await safe(async () => {
    const u = await family();
    id = (await renewRegistration(u, str(fd, "registrationId"))).id;
  });
  if (res) return res;
  redirect(`/famille/inscriptions/${id}`);
}

export async function cancelRegistrationAction(fd: FormData) {
  const u = await family();
  await cancelRegistration(u, str(fd, "registrationId"));
  redirect("/famille");
}

export async function markAllReadAction() {
  const u = await requireUser();
  await prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const u = await family();
    const d = z.object({ firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), phone: phoneFR }).parse(Object.fromEntries(fd));
    const addr = addressSchema.safeParse(Object.fromEntries(fd));
    await prisma.user.update({ where: { id: u.id }, data: { ...d, marketingOptIn: fd.get("marketing") === "on" } });
    if (addr.success) await prisma.family.update({ where: { id: u.familyId }, data: addr.data });
    revalidatePath("/famille", "layout");
    return { ok: "Profil mis à jour" };
  });
}

/** RGPD right to erasure: anonymises the account, deletes documents; payment records kept (legal obligation). */
export async function deleteAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await safe(async () => {
    const u = await family();
    if (str(fd, "confirm") !== "SUPPRIMER") throw new AppError('Tapez SUPPRIMER pour confirmer');
    const active = await prisma.installment.count({ where: { status: { in: ["SCHEDULED", "FAILED"] }, payment: { payerId: u.id, status: { in: ["ACTIVE", "FAILED"] } } } });
    if (active) throw new AppError("Des échéances restent dues : la suppression sera possible après leur règlement");
    await prisma.$transaction([
      prisma.document.updateMany({ where: { familyId: u.familyId }, data: { deletedAt: new Date() } }),
      prisma.child.updateMany({ where: { familyId: u.familyId }, data: { deletedAt: new Date(), firstName: "Supprimé", lastName: "Supprimé", birthPlace: null, nationality: null } }),
      prisma.user.update({ where: { id: u.id }, data: { deletedAt: new Date(), email: `deleted-${u.id}@licengo.invalid`, firstName: "Compte", lastName: "supprimé", phone: null, passwordHash: "!" } }),
      prisma.session.deleteMany({ where: { userId: u.id } }),
      prisma.pushToken.deleteMany({ where: { userId: u.id } }),
    ]);
    await audit(u.id, "user.erase", "User", u.id);
    await logout();
  });
  if (res) return res;
  redirect("/?compte=supprime");
}

export async function addToCartAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const u = await requireUser();
    const variantId = str(fd, "variantId");
    if (!variantId) throw new AppError("Choisissez une taille");
    await addToCart(u, variantId, Number(fd.get("quantity") ?? 1), str(fd, "personalization").slice(0, 30) || undefined);
    revalidatePath("/", "layout");
    return { ok: "Ajouté au panier" };
  });
}

export async function updateCartAction(fd: FormData) {
  const u = await requireUser();
  await updateCartItem(u, str(fd, "itemId"), Number(fd.get("quantity")));
  revalidatePath("/panier");
}

export async function checkoutAction(_: ActionState): Promise<ActionState> {
  let url = "/commandes";
  const res = await safe(async () => {
    const u = await requireUser();
    const orders = await checkoutCart(u);
    if (orders.length === 1) url = (await startShopPayment(u, orders[0].id)).url;
  });
  if (res) return res;
  redirect(url);
}

export async function payOrderAction(fd: FormData) {
  const u = await requireUser();
  const { url } = await startShopPayment(u, str(fd, "orderId"));
  redirect(url);
}

export async function cancelOrderAction(fd: FormData) {
  const u = await requireUser();
  await cancelUnpaidOrder(u, str(fd, "orderId"));
  revalidatePath(`/commandes/${str(fd, "orderId")}`);
}

/** Step 2 in one go: health questionnaire answer + every required authorisation + image rights, one signature. */
export async function signAllAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const u = await family();
    const registrationId = str(fd, "registrationId");
    const { assertFamilyAccess, computeCompleteness, getRegistration } = await import("@/server/services/registrations");
    await assertFamilyAccess(u, registrationId);
    const health = str(fd, "healthAnswer");
    if (health) await setHealthAnswer(u, registrationId, z.enum(["ALL_NO", "SOME_YES"]).parse(health));
    if (fd.get("readAll") !== "on") throw new AppError("Cochez la case pour confirmer avoir lu les documents");
    const imageRights = str(fd, "imageRights");
    if (!["yes", "no"].includes(imageRights)) throw new AppError("Indiquez si vous acceptez le droit à l'image");
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(str(fd, "signature"));
    if (!m) throw new AppError("Merci de signer dans le cadre");
    const buf = Buffer.from(m[1], "base64");
    if (buf.length > 400_000 || sniffMime(buf) !== "image/png") throw new AppError("Signature invalide");
    const imageKey = (await storeEncrypted(`families/${u.familyId}/signatures`, buf)).key;
    const info = await clientInfo();
    const base = { signerName: str(fd, "signerName"), imageKey, ip: info.ip, userAgent: info.userAgent.slice(0, 250) };
    // requirements are always computed server-side, never trusted from the browser
    const c = await computeCompleteness(await getRegistration(registrationId));
    for (const t of c.requiredSignatures) await signDocument(u, registrationId, t as SignatureType, { ...base, accepted: true });
    await signDocument(u, registrationId, "IMAGE_RIGHTS", { ...base, accepted: imageRights === "yes" });
    revalidatePath(`/famille/inscriptions/${registrationId}`);
    return { ok: "Signature enregistrée ✔" };
  });
}
