"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signupSchema, loginSchema, phoneFR, postalCodeFR, passwordSchema } from "@licengo/core";
import { prisma } from "@/server/db";
import { authenticate, createSession, hashPassword, logout, setSessionCookie, clientInfo } from "@/server/auth";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { geocode } from "@/server/services/clubs";
import { rateLimit } from "@/server/ratelimit";
import { safe } from "@/lib/safe-action";
import type { ActionState } from "@/lib/action-state";

const homeFor = (role: string) => (role === "ADMIN" ? "/admin" : role === "CLUB_STAFF" ? "/club" : "/famille");
const safeNext = (n: FormDataEntryValue | null) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : null);

export async function signupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let dest = "/famille/enfants/nouveau";
  const res = await safe(async () => {
    const { ip } = await clientInfo();
    if (!rateLimit(`signup:${ip}`, 10, 3600_000)) throw new AppError("Trop de créations de compte depuis cette connexion");
    const data = signupSchema.parse({ ...Object.fromEntries(fd), acceptTerms: fd.get("acceptTerms") === "on" });
    if (await prisma.user.findUnique({ where: { email: data.email } })) throw new AppError("Un compte existe déjà avec cet email");
    const user = await prisma.user.create({
      data: {
        email: data.email, passwordHash: await hashPassword(data.password), firstName: data.firstName, lastName: data.lastName, phone: data.phone,
        termsAcceptedAt: new Date(), marketingOptIn: fd.get("marketing") === "on",
        family: { create: { name: `Famille ${data.lastName}` } },
      },
    });
    await audit(user.id, "user.signup", "User", user.id, undefined, ip);
    const s = await createSession(user.id);
    await setSessionCookie(s.token, s.expiresAt);
    dest = safeNext(fd.get("next")) ?? dest;
  });
  if (res) return res;
  redirect(dest);
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let dest = "/famille";
  const res = await safe(async () => {
    const data = loginSchema.parse(Object.fromEntries(fd));
    const user = await authenticate(data.email, data.password);
    const s = await createSession(user.id);
    await setSessionCookie(s.token, s.expiresAt);
    await audit(user.id, "user.login", "User", user.id, undefined, (await clientInfo()).ip);
    dest = safeNext(fd.get("next")) ?? homeFor(user.role);
  });
  if (res) return res;
  redirect(dest);
}

export async function logoutAction() {
  await logout();
  redirect("/");
}

const clubSignupSchema = z.object({
  clubName: z.string().trim().min(3, "Nom du club requis").max(120),
  sport: z.string().min(1),
  federationNumber: z.string().trim().max(20).optional(),
  postalCode: postalCodeFR,
  city: z.string().trim().min(1, "Ville requise"),
  firstName: z.string().trim().min(1, "Requis"),
  lastName: z.string().trim().min(1, "Requis"),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  phone: phoneFR,
  password: passwordSchema,
});

export async function clubSignupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await safe(async () => {
    if (fd.get("acceptTerms") !== "on") throw new AppError("Vous devez accepter les conditions");
    const d = clubSignupSchema.parse(Object.fromEntries(fd));
    if (await prisma.user.findUnique({ where: { email: d.email } })) throw new AppError("Un compte existe déjà avec cet email");
    const sport = await prisma.sport.findUnique({ where: { slug: d.sport } });
    if (!sport) throw new AppError("Sport inconnu");
    const geo = (await geocode(d.postalCode)) ?? (await geocode(d.city)) ?? { lat: 46.6, lng: 2.4 };
    const base = d.clubName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = (await prisma.club.findUnique({ where: { slug: base } })) ? `${base}-${Date.now().toString(36)}` : base;
    const starter = await prisma.plan.findUnique({ where: { code: "STARTER" } });
    const user = await prisma.user.create({
      data: {
        email: d.email, passwordHash: await hashPassword(d.password), firstName: d.firstName, lastName: d.lastName, phone: d.phone, role: "CLUB_STAFF", termsAcceptedAt: new Date(),
        staff: { create: { role: "OWNER", club: { create: { name: d.clubName, slug, sportId: sport.id, federationNumber: d.federationNumber || null, postalCode: d.postalCode, city: d.city, lat: geo.lat, lng: geo.lng, email: d.email, phone: d.phone, planId: starter?.id } } } },
      },
    });
    await audit(user.id, "club.signup", "Club", slug);
    const s = await createSession(user.id);
    await setSessionCookie(s.token, s.expiresAt);
  });
  if (res) return res;
  redirect("/club?bienvenue=1");
}
