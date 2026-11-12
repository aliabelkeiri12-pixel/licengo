import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { canReadInvoice, renderInvoicePdf, verifyInvoiceLink } from "@/server/invoices";

/** Invoice PDF: for the payer, the club staff (club invoices) and admins, or through a short-lived signed link. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  const url = new URL(req.url);
  const user = await getCurrentUser();
  const allowed = verifyInvoiceLink(id, url.searchParams.get("exp"), url.searchParams.get("sig")) || (user && canReadInvoice(user, inv));
  if (!allowed) return NextResponse.json({ error: "Accès refusé" }, { status: user ? 403 : 401 });
  const { pdf } = await renderInvoicePdf(id);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.get("dl") ? "attachment" : "inline"}; filename="facture-${inv.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
