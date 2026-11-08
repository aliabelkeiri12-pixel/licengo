import { NextResponse } from "next/server";
import { requireUser, clientInfo } from "@/server/auth";
import { readDocument } from "@/server/services/documents";
import { AppError } from "@/server/errors";

/** Streams a decrypted document to an authorised user. Never cached, every read is audited. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { doc, data } = await readDocument(user, (await params).id, (await clientInfo()).ip);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${doc.type.toLowerCase()}${doc.mimeType === "application/pdf" ? ".pdf" : ""}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: e instanceof AppError ? e.message : "Erreur" }, { status });
  }
}
