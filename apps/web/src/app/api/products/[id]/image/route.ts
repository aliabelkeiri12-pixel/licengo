import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/** Public product photo (shop catalogue). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await prisma.product.findUnique({ where: { id: (await params).id }, select: { imageData: true, imageMime: true } });
  if (!p?.imageData) return NextResponse.json({ error: "Pas de photo" }, { status: 404 });
  return new NextResponse(new Uint8Array(p.imageData), { headers: { "Content-Type": p.imageMime ?? "image/jpeg", "Cache-Control": "public, max-age=300" } });
}
