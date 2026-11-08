import { z } from "zod";
import { DOCUMENT_TYPES } from "@licengo/core";
import type { DocumentType } from "@prisma/client";
import { api } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { uploadDocument } from "@/server/services/documents";
import { AppError } from "@/server/errors";

/** multipart/form-data: childId, type, file, [registrationId], [expiresAt] – photo taken with the phone camera. */
export const POST = api(async (req) => {
  const u = await requireUser("FAMILY");
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw new AppError("Fichier manquant");
  const type = z.enum(DOCUMENT_TYPES).parse(fd.get("type")) as DocumentType;
  const exp = fd.get("expiresAt");
  const doc = await uploadDocument(u, { childId: String(fd.get("childId")), registrationId: (fd.get("registrationId") as string) || null, type, file, expiresAt: exp ? new Date(String(exp)) : null });
  return { id: doc.id, type: doc.type, status: doc.status };
});
