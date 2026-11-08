import { loginSchema } from "@licengo/core";
import { api, json } from "@/lib/api";
import { authenticate, createSession } from "@/server/auth";

export const POST = api(async (req) => {
  const d = loginSchema.parse(await json(req));
  const user = await authenticate(d.email, d.password);
  const s = await createSession(user.id);
  return { token: s.token, expiresAt: s.expiresAt, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } };
}, { public: true });
