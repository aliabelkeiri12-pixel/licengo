"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { decisionSchema, defaultFootballCategories, toCents, ORDER_STATUS_LABELS } from "@licengo/core";
import type { OrderStatus, ProductCategory, StaffRole } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireClubAccess, hashPassword } from "@/server/auth";
import type { StaffRole as SR } from "@prisma/client";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { notifyFamily } from "@/server/notify";
import { decide, assertClubAccess, currentSeason, setRegistrationExtras } from "@/server/services/registrations";
import { reviewDocument } from "@/server/services/documents";
import { refundPayment } from "@/server/services/payments";
import { updateOrderStatus, lowStockAlert } from "@/server/services/shop";
import { paymentProvider } from "@/server/payments";
import { env } from "@/server/env";
import { safe } from "@/lib/safe-action";
import type { ActionState } from "@/lib/action-state";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Role-based access inside a club: COACH is read-only, TREASURER handles money, SECRETARY handles files. */
async function clubWriter(...roles: SR[]) {
  const ctx = await requireClubAccess();
  if (ctx.user.role !== "ADMIN" && !ctx.user.staff.some((s) => s.clubId === ctx.clubId && (s.role === "OWNER" || roles.includes(s.role as SR))))
    throw new AppError("Votre rôle ne permet pas cette action", 403);
  return ctx;
}

export async function decisionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { user } = await clubWriter("SECRETARY");
    const d = decisionSchema.parse({ decision: fd.get("decision"), reason: str(fd, "reason") || undefined });
    await decide(user, str(fd, "registrationId"), d.decision, d.reason);
    revalidatePath("/club", "layout");
    return { ok: { VALIDATE: "Dossier validé, la famille est notifiée.", REJECT: "Dossier refusé.", REQUEST_CHANGES: "Demande de modification envoyée." }[d.decision] };
  });
}

export async function reviewDocumentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { user } = await clubWriter("SECRETARY");
    const accept = str(fd, "accept") === "1";
    await reviewDocument(user, str(fd, "documentId"), accept, str(fd, "reason") || undefined);
    revalidatePath("/club", "layout");
    const regId = str(fd, "registrationId");
    if (regId) redirect(`/club/dossiers/${regId}?doc=${accept ? "valide" : "refuse"}`);
    return { ok: accept ? "Document validé" : "Document refusé, la famille est prévenue" };
  });
}

export async function setLicenseNumberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { user } = await clubWriter("SECRETARY");
    const r = await assertClubAccess(user, str(fd, "registrationId"));
    const n = z.string().trim().regex(/^[A-Z0-9-]{4,20}$/i, "Numéro invalide").parse(fd.get("number"));
    await prisma.registration.update({ where: { id: r.id }, data: { federationLicenseNumber: n } });
    await prisma.registrationEvent.create({ data: { registrationId: r.id, actorId: user.id, type: "LICENSE_NUMBER", message: `N° de licence fédérale enregistré : ${n}` } });
    revalidatePath(`/club/dossiers/${r.id}`);
    return { ok: "Numéro enregistré" };
  });
}

export async function remindAction(fd: FormData) {
  const { user, clubId } = await clubWriter("SECRETARY");
  const ids = fd.getAll("ids").map(String);
  const regs = await prisma.registration.findMany({ where: { clubId, id: ids.length ? { in: ids } : undefined, status: { in: ["DRAFT", "INCOMPLETE", "TO_FIX"] } }, include: { child: true, club: true } });
  for (const r of regs) {
    await notifyFamily(r.child.familyId, { type: "REMINDER", title: `${r.club.name} : dossier de ${r.child.firstName} à compléter`, body: r.missingSummary.slice(0, 3).join(" • ") || "Finalisez le dossier", link: `/famille/inscriptions/${r.id}` });
    await prisma.registration.update({ where: { id: r.id }, data: { lastReminderAt: new Date() } });
    await prisma.registrationEvent.create({ data: { registrationId: r.id, actorId: user.id, type: "REMINDER", message: "Relance envoyée par le club" } });
  }
  revalidatePath("/club/dossiers");
  redirect(`/club/dossiers?relance=${regs.length}`);
}

export async function refundAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { user } = await clubWriter("TREASURER");
    const amount = toCents(Number(str(fd, "amount").replace(",", ".")));
    const r = await refundPayment(user, str(fd, "paymentId"), amount, str(fd, "reason"), fd.get("refundFee") === "on");
    revalidatePath("/", "layout");
    return { ok: r.full ? "Remboursement total effectué" : "Remboursement partiel effectué" };
  });
}

export async function generateCategoriesAction(fd: FormData) {
  const { user, clubId } = await clubWriter("SECRETARY", "TREASURER");
  const season = str(fd, "season") || currentSeason();
  const start = Number(season.slice(0, 4));
  const existing = await prisma.category.count({ where: { clubId, season } });
  if (!existing) await prisma.category.createMany({ data: defaultFootballCategories(start).map((c) => ({ ...c, clubId, season, capacity: 40 })) });
  await audit(user.id, "category.generate", "Club", clubId, { season });
  revalidatePath("/club/categories");
}

const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  birthYearMin: z.coerce.number().int().min(1920).max(2100),
  birthYearMax: z.coerce.number().int().min(1920).max(2100),
  price: z.coerce.number().min(0).max(5000),
  capacity: z.coerce.number().int().min(0).max(5000).optional(),
  maxInstallments: z.coerce.number().int().min(1).max(4),
  gender: z.enum(["MIXED", "M", "F"]),
}).refine((d) => d.birthYearMin <= d.birthYearMax, { message: "Années incohérentes", path: ["birthYearMin"] });

export async function saveCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { user, clubId } = await clubWriter("SECRETARY", "TREASURER");
    const d = categorySchema.parse(Object.fromEntries(fd));
    const data = { name: d.name, birthYearMin: d.birthYearMin, birthYearMax: d.birthYearMax, priceCents: toCents(d.price), capacity: d.capacity || null, maxInstallments: d.maxInstallments, gender: d.gender, open: fd.get("open") === "on" };
    const id = str(fd, "id");
    if (id) {
      const c = await prisma.category.findFirst({ where: { id, clubId } });
      if (!c) throw new AppError("Catégorie introuvable");
      await prisma.category.update({ where: { id }, data });
    } else await prisma.category.create({ data: { ...data, clubId, season: str(fd, "season") || currentSeason() } });
    await audit(user.id, "category.save", "Category", id || undefined);
    revalidatePath("/club/categories");
    return { ok: "Catégorie enregistrée" };
  });
}

const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.enum(["MAILLOT", "SHORT", "CHAUSSETTES", "SURVETEMENT", "VESTE", "PARKA", "SAC", "BONNET", "GANTS", "AUTRE"]),
  price: z.coerce.number().min(0.5).max(2000),
  cost: z.coerce.number().min(0).max(2000).optional(),
  description: z.string().trim().max(500).optional(),
  sizes: z.string().trim().min(1, "Indiquez au moins une taille"),
  stock: z.coerce.number().int().min(0).max(10000),
  supplierId: z.string().optional(),
});

export async function createProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { user, clubId } = await clubWriter("SECRETARY", "TREASURER");
    const d = productSchema.parse(Object.fromEntries(fd));
    const sizes = [...new Set(d.sizes.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 20);
    const p = await prisma.product.create({
      data: {
        clubId, name: d.name, category: d.category as ProductCategory, priceCents: toCents(d.price), costCents: d.cost ? toCents(d.cost) : null, description: d.description, supplierId: d.supplierId || null,
        variants: { create: sizes.map((size, i) => ({ size, stock: d.stock, sku: `${clubId.slice(-5).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${i}` })) },
      },
    });
    await audit(user.id, "product.create", "Product", p.id);
    revalidatePath("/club/boutique");
    return { ok: "Article ajouté à la boutique" };
  });
}

export async function updateStockAction(fd: FormData) {
  const { clubId } = await clubWriter("SECRETARY", "TREASURER");
  const v = await prisma.productVariant.findFirst({ where: { id: str(fd, "variantId"), product: { clubId } } });
  if (!v) throw new AppError("Article introuvable");
  const stock = Math.max(0, Math.min(10000, Number(fd.get("stock")) | 0));
  await prisma.productVariant.update({ where: { id: v.id }, data: { stock } });
  await lowStockAlert(clubId);
  revalidatePath("/club/boutique");
}

export async function toggleProductAction(fd: FormData) {
  const { clubId } = await clubWriter("SECRETARY", "TREASURER");
  const p = await prisma.product.findFirst({ where: { id: str(fd, "productId"), clubId } });
  if (p) await prisma.product.update({ where: { id: p.id }, data: { active: !p.active } });
  revalidatePath("/club/boutique");
}

export async function orderStatusAction(fd: FormData) {
  const { user } = await clubWriter("SECRETARY", "TREASURER");
  const status = z.enum(Object.keys(ORDER_STATUS_LABELS) as [OrderStatus, ...OrderStatus[]]).parse(fd.get("status"));
  await updateOrderStatus(user, str(fd, "orderId"), status, str(fd, "tracking") || undefined);
  revalidatePath("/club/boutique");
}

export async function createSupplierAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { clubId } = await clubWriter("SECRETARY", "TREASURER");
    const d = z.object({ name: z.string().trim().min(2), email: z.string().email().optional().or(z.literal("")), phone: z.string().optional() }).parse(Object.fromEntries(fd));
    await prisma.supplier.create({ data: { clubId, name: d.name, email: d.email || null, phone: d.phone || null } });
    revalidatePath("/club/boutique");
    return { ok: "Fournisseur ajouté" };
  });
}

export async function updateClubAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { user, clubId } = await clubWriter("SECRETARY");
    const d = z.object({
      name: z.string().trim().min(3).max(120), description: z.string().trim().max(1000).optional(), address: z.string().trim().max(200).optional(),
      email: z.string().email().optional().or(z.literal("")), phone: z.string().max(20).optional(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), reminderEveryDays: z.coerce.number().int().min(1).max(30),
    }).parse(Object.fromEntries(fd));
    await prisma.club.update({ where: { id: clubId }, data: { ...d, email: d.email || null } });
    await audit(user.id, "club.update", "Club", clubId);
    revalidatePath("/club", "layout");
    return { ok: "Paramètres enregistrés" };
  });
}

/** Stripe Connect Express onboarding: the club fills its bank & KYC details directly on Stripe. */
export async function connectStripeAction() {
  const { user, clubId } = await clubWriter("TREASURER");
  const club = await prisma.club.findUniqueOrThrow({ where: { id: clubId } });
  const provider = paymentProvider();
  const accountId = club.stripeAccountId ?? (await provider.createConnectedAccount({ name: club.name, email: club.email }));
  await prisma.club.update({ where: { id: clubId }, data: { stripeAccountId: accountId, ...(provider.name === "mock" ? { stripeChargesEnabled: true } : {}) } });
  await audit(user.id, "club.stripe_connect", "Club", clubId);
  redirect(await provider.onboardingLink(accountId, `${env.appUrl}/club/parametres`));
}

export async function addStaffAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { user, clubId } = await clubWriter();
    if (!user.staff.some((s) => s.clubId === clubId && s.role === "OWNER")) throw new AppError("Seul le responsable peut gérer l'équipe");
    const d = z.object({ email: z.string().trim().toLowerCase().email(), firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), role: z.enum(["SECRETARY", "TREASURER", "COACH", "OWNER"]), password: z.string().min(10) }).parse(Object.fromEntries(fd));
    const existing = await prisma.user.findUnique({ where: { email: d.email } });
    if (existing && existing.role === "FAMILY") throw new AppError("Cet email est utilisé par un compte famille");
    const u = existing ?? (await prisma.user.create({ data: { email: d.email, firstName: d.firstName, lastName: d.lastName, role: "CLUB_STAFF", passwordHash: await hashPassword(d.password), termsAcceptedAt: new Date() } }));
    await prisma.clubStaff.upsert({ where: { userId_clubId: { userId: u.id, clubId } }, create: { userId: u.id, clubId, role: d.role as StaffRole }, update: { role: d.role as StaffRole } });
    await audit(user.id, "club.staff_add", "Club", clubId, { email: d.email, role: d.role });
    revalidatePath("/club/parametres");
    return { ok: "Membre ajouté à l'équipe" };
  });
}

export async function saveClubFeeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { user, clubId } = await clubWriter("SECRETARY", "TREASURER");
    const d = z.object({ label: z.string().trim().min(2, "Libellé requis").max(60), amount: z.coerce.number().min(0.5).max(1000), description: z.string().trim().max(200).optional() }).parse(Object.fromEntries(fd));
    await prisma.clubFee.create({ data: { clubId, label: d.label, amountCents: toCents(d.amount), description: d.description || null, mandatory: str(fd, "mandatory") === "yes" } });
    await audit(user.id, "club.fee_create", "Club", clubId, { label: d.label });
    revalidatePath("/club/categories");
    return { ok: "Supplément ajouté" };
  });
}

export async function toggleClubFeeAction(fd: FormData) {
  const { clubId } = await clubWriter("SECRETARY", "TREASURER");
  const f = await prisma.clubFee.findFirst({ where: { id: str(fd, "feeId"), clubId } });
  if (f) await prisma.clubFee.update({ where: { id: f.id }, data: { active: !f.active } });
  revalidatePath("/club/categories");
}

export async function setExtrasAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { user } = await clubWriter("SECRETARY", "TREASURER");
    const total = await setRegistrationExtras(user, str(fd, "registrationId"), fd.getAll("extras").map(String));
    revalidatePath(`/club/dossiers/${str(fd, "registrationId")}`);
    return { ok: `Tarif mis à jour : ${(total / 100).toFixed(2).replace(".", ",")} €, la famille est prévenue` };
  });
}
