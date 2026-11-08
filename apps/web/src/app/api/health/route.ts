import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function GET() {
  try { await prisma.$queryRaw`SELECT 1`; return NextResponse.json({ status: "ok" }); }
  catch { return NextResponse.json({ status: "db_error" }, { status: 503 }); }
}
