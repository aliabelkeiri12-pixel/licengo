import { z } from "zod";
import { SIGNABLE_DOCUMENTS } from "@licengo/core";
import type { SignatureType } from "@prisma/client";
import { api, json } from "@/lib/api";
import { requireUser, clientInfo } from "@/server/auth";
import { signDocument } from "@/server/services/registrations";
import { sniffMime } from "@/server/services/documents";
import { storeEncrypted } from "@/server/storage";
import { AppError } from "@/server/errors";

export const POST = api<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const u = await requireUser("FAMILY");
  const d = z.object({ type: z.enum(SIGNABLE_DOCUMENTS), signerName: z.string().min(3), accepted: z.boolean().default(true), signaturePng: z.string().optional() }).parse(await json(req));
  let imageKey: string | undefined;
  if (d.signaturePng) {
    const buf = Buffer.from(d.signaturePng.replace(/^data:image\/png;base64,/, ""), "base64");
    if (buf.length > 400_000 || sniffMime(buf) !== "image/png") throw new AppError("Signature invalide");
    imageKey = (await storeEncrypted(`families/${u.familyId}/signatures`, buf)).key;
  } else if (d.accepted) throw new AppError("Signature manuscrite requise");
  const info = await clientInfo();
  return signDocument(u, (await params).id, d.type as SignatureType, { signerName: d.signerName, accepted: d.accepted, imageKey, ip: info.ip, userAgent: info.userAgent.slice(0, 250) });
});
