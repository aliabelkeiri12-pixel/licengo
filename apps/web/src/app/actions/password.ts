"use server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { passwordSchema } from "@licengo/core";
import { prisma } from "@/server/db";
import { hashPassword, clientInfo } from "@/server/auth";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { rateLimit } from "@/server/ratelimit";
import { sendMail, appLink } from "@/server/mail";
import { safe } from "@/lib/safe-action";
import type { ActionState } from "@/lib/action-state";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const GENERIC = "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé (valable 1 heure).";

export async function requestResetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const { ip } = await clientInfo();
    if (!rateLimit(`reset:${ip}`, 5, 3600_000)) throw new AppError("Trop de demandes, réessayez plus tard");
    const email = z.string().trim().toLowerCase().email("Email invalide").parse(fd.get("email"));
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.deletedAt) {
      const token = randomBytes(32).toString("base64url");
      await prisma.passwordResetToken.create({ data: { id: sha(token), userId: user.id, expiresAt: new Date(Date.now() + 3600_000) } });
      await sendMail(email, "Réinitialisation de votre mot de passe LICENGO", `Bonjour ${user.firstName},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${appLink(`/mot-de-passe/nouveau?token=${token}`)}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`);
      await audit(user.id, "user.reset_request", "User", user.id, undefined, ip);
    }
    return { ok: GENERIC }; // same answer whether the account exists or not (no user enumeration)
  });
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const token = String(fd.get("token") ?? "");
    const password = passwordSchema.parse(fd.get("password"));
    if (password !== fd.get("confirm")) throw new AppError("Les mots de passe ne correspondent pas");
    const row = await prisma.passwordResetToken.findUnique({ where: { id: sha(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new AppError("Lien invalide ou expiré. Refaites une demande.");
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } }),
      prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId: row.userId } }), // log out every device
    ]);
    await audit(row.userId, "user.reset_password", "User", row.userId);
    return { ok: "Mot de passe modifié. Vous pouvez vous connecter." };
  });
}
