import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { headers } from "next/headers";
import { AppError } from "@/server/errors";

type Handler<C> = (req: Request, ctx: C) => Promise<unknown>;

/**
 * JSON API wrapper (mobile app). Mutations must use a Bearer token, never the cookie only → no CSRF surface.
 */
export function api<C = unknown>(handler: Handler<C>, opts: { public?: boolean } = {}) {
  return async (req: Request, ctx: C) => {
    try {
      if (req.method !== "GET" && !opts.public) {
        const auth = (await headers()).get("authorization");
        if (!auth?.startsWith("Bearer ")) throw new AppError("Jeton d'authentification requis", 401, "UNAUTHORIZED");
      }
      const data = await handler(req, ctx);
      return data instanceof Response ? data : NextResponse.json(data ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof ZodError) return NextResponse.json({ error: "Données invalides", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
      if (e instanceof AppError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}

export const json = async (req: Request) => {
  try { return await req.json(); } catch { throw new AppError("JSON invalide"); }
};
