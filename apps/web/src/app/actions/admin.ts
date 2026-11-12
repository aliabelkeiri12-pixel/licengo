"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { toCents } from "@licengo/core";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { notifyClubStaff } from "@/server/notify";
import { refundPayment } from "@/server/services/payments";
import { safe } from "@/lib/safe-action";
import type { ActionState } from "@/lib/action-state";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function setClubStatusAction(fd: FormData) {
  const admin = await requireUser("ADMIN");
  const status = z.enum(["PENDING", "ACTIVE", "SUSPENDED"]).parse(fd.get("status"));
  const club = await prisma.club.update({ where: { id: str(fd, "clubId") }, data: { status } });
  await audit(admin.id, "admin.club_status", "Club", club.id, { status });
  if (status === "ACTIVE") await notifyClubStaff(club.id, { type: "CLUB_ACTIVATED", title: "Votre club est activé 🎉", body: "Les familles peuvent désormais s'inscrire en ligne.", link: "/club" });
  revalidatePath("/admin/clubs");
}

export async function setClubPlanAction(fd: FormData) {
  const admin = await requireUser("ADMIN");
  await prisma.club.update({ where: { id: str(fd, "clubId") }, data: { planId: str(fd, "planId") || null } });
  await audit(admin.id, "admin.club_plan", "Club", str(fd, "clubId"), { planId: str(fd, "planId") });
  revalidatePath("/admin/clubs");
}

export async function savePlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const admin = await requireUser("ADMIN");
    const d = z.object({ name: z.string().min(2), monthly: z.coerce.number().min(0), fee: z.coerce.number().min(0).max(50), commission: z.coerce.number().min(0).max(50), maxLicensees: z.coerce.number().int().min(0).optional() }).parse(Object.fromEntries(fd));
    await prisma.plan.update({ where: { id: str(fd, "id") }, data: { name: d.name, monthlyPriceCents: toCents(d.monthly), licenseFeeCents: toCents(d.fee), shopCommissionBps: Math.round(d.commission * 100), maxLicensees: d.maxLicensees || null } });
    await audit(admin.id, "admin.plan_update", "Plan", str(fd, "id"), d);
    revalidatePath("/admin/abonnements");
    return { ok: "Offre mise à jour (s'applique aux nouvelles inscriptions)" };
  });
}

export async function adminRefundAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const admin = await requireUser("ADMIN");
    const r = await refundPayment(admin, str(fd, "paymentId"), toCents(Number(str(fd, "amount").replace(",", "."))), str(fd, "reason"), fd.get("refundFee") === "on");
    revalidatePath("/admin", "layout");
    return { ok: r.full ? "Remboursement total effectué" : "Remboursement partiel effectué" };
  });
}

export async function unlockUserAction(fd: FormData) {
  const admin = await requireUser("ADMIN");
  await prisma.user.update({ where: { id: str(fd, "userId") }, data: { lockedUntil: null, failedLogins: 0 } });
  await audit(admin.id, "admin.user_unlock", "User", str(fd, "userId"));
  revalidatePath("/admin/utilisateurs");
}

export async function revokeSessionsAction(fd: FormData) {
  const admin = await requireUser("ADMIN");
  await prisma.session.deleteMany({ where: { userId: str(fd, "userId") } });
  await audit(admin.id, "admin.sessions_revoke", "User", str(fd, "userId"));
  revalidatePath("/admin/utilisateurs");
}

/**
 * Demo only (DEMO_DATA=1): wipes everything created during presentations (accounts, files, photos,
 * documents, payments, orders) and reloads the original demo data. LICENGO admin accounts are kept.
 */
export async function resetDemoAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const admin = await requireUser("ADMIN");
    if (process.env.DEMO_DATA !== "1") throw new AppError("Réinitialisation réservée au site de démonstration");
    if (str(fd, "confirm") !== "REINITIALISER") return { error: "Tapez REINITIALISER pour confirmer" };
    const keep = await prisma.user.findMany({ where: { role: "ADMIN", email: { not: "admin@licengo.fr" } }, select: { email: true, passwordHash: true, firstName: true, lastName: true } });
    const { seedDemo } = await import("@/server/demo-seed");
    await seedDemo(prisma as unknown as Parameters<typeof seedDemo>[0]);
    await prisma.user.deleteMany({ where: { email: "admin@licengo.fr" } }); // public demo password
    for (const u of keep) await prisma.user.create({ data: { ...u, role: "ADMIN", termsAcceptedAt: new Date() } });
    const { rm } = await import("node:fs/promises");
    const path = await import("node:path");
    await rm(path.resolve(process.env.STORAGE_DIR || "./storage"), { recursive: true, force: true }); // uploaded photos & documents
    await audit(null, "admin.demo_reset", "Platform", undefined, { by: admin.email });
    redirect("/connexion?reinitialise=1");
  });
}
