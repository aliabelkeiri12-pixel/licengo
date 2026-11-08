import { signupSchema } from "@licengo/core";
import { api, json } from "@/lib/api";
import { prisma } from "@/server/db";
import { createSession, hashPassword, clientInfo } from "@/server/auth";
import { AppError } from "@/server/errors";
import { rateLimit } from "@/server/ratelimit";

export const POST = api(async (req) => {
  const { ip } = await clientInfo();
  if (!rateLimit(`signup:${ip}`, 10, 3600_000)) throw new AppError("Trop de tentatives", 429);
  const d = signupSchema.parse(await json(req));
  if (await prisma.user.findUnique({ where: { email: d.email } })) throw new AppError("Un compte existe déjà avec cet email", 409);
  const user = await prisma.user.create({ data: { email: d.email, passwordHash: await hashPassword(d.password), firstName: d.firstName, lastName: d.lastName, phone: d.phone, termsAcceptedAt: new Date(), family: { create: { name: `Famille ${d.lastName}` } } } });
  const s = await createSession(user.id);
  return { token: s.token, expiresAt: s.expiresAt, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } };
}, { public: true });
