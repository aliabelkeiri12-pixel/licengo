import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { runDueInstallments } from "@/server/services/payments";

/** Called daily by the scheduler (e.g. Scaleway Cron / GitHub Actions / Vercel Cron) with the CRON_SECRET. */
export async function POST(req: Request) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new URL(req.url).searchParams.get("now");
  return NextResponse.json(await runDueInstallments(now ? new Date(now) : new Date()));
}
