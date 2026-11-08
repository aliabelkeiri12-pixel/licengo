import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";
import { AppError, forbidden, unauthorized } from "./errors";
import { rateLimit } from "./ratelimit";
import { env } from "./env";

export const SESSION_COOKIE = "licengo_session";
const SESSION_DAYS = 30;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function clientInfo() {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local", userAgent: h.get("user-agent") || "" };
}

/** Creates an opaque session token; only its SHA-256 is stored in DB. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const { ip, userAgent } = await clientInfo();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.session.create({ data: { id: sha256(token), userId, expiresAt, ip, userAgent: userAgent.slice(0, 250) } });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: env.isProd, sameSite: "lax", path: "/", expires: expiresAt });
}

export async function authenticate(email: string, password: string): Promise<User> {
  const { ip } = await clientInfo();
  if (!rateLimit(`login:${ip}`, 20, 15 * 60_000)) throw new AppError("Trop de tentatives, réessayez plus tard", 429, "RATE_LIMITED");
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Constant-ish time: always run a bcrypt compare
  const ok = await verifyPassword(password, user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || user.deletedAt) throw new AppError("Email ou mot de passe incorrect", 401, "INVALID_CREDENTIALS");
  if (user.lockedUntil && user.lockedUntil > new Date())
    throw new AppError("Compte temporairement verrouillé suite à plusieurs échecs. Réessayez dans 15 minutes.", 423, "LOCKED");
  if (!ok) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: failed >= MAX_FAILED ? 0 : failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    throw new AppError("Email ou mot de passe incorrect", 401, "INVALID_CREDENTIALS");
  }
  return prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
}

async function tokenFromRequest(): Promise<string | undefined> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export type SessionUser = User & { staff: { clubId: string; role: string }[] };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await tokenFromRequest();
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { include: { staff: { select: { clubId: true, role: true } } } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.deletedAt) return null;
  return session.user;
}

export async function requireUser(...roles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (roles.length && !roles.includes(user.role)) throw forbidden();
  return user;
}

/** Club staff (or LICENGO admin) access to a given club. */
export async function requireClubAccess(clubId?: string) {
  const user = await requireUser("CLUB_STAFF", "ADMIN");
  const id = clubId ?? user.staff[0]?.clubId;
  if (!id) throw forbidden();
  if (user.role !== "ADMIN" && !user.staff.some((s) => s.clubId === id)) throw forbidden();
  return { user, clubId: id };
}

export async function logout() {
  const token = await tokenFromRequest();
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  (await cookies()).delete(SESSION_COOKIE);
}
