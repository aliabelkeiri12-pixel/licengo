import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { runReminders } from "@/server/services/registrations";

export async function POST(req: Request) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new URL(req.url).searchParams.get("now");
  return NextResponse.json(await runReminders(now ? new Date(now) : new Date()));
}
