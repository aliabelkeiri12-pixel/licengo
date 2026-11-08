import type { DocumentType, Document } from "@prisma/client";
import { isAllowedUpload, SENSITIVE_DOCUMENTS, DOCUMENT_LABELS } from "@licengo/core";
import { prisma } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import { storeEncrypted, readDecrypted } from "../storage";
import { audit } from "../audit";
import { notifyFamily } from "../notify";
import type { SessionUser } from "../auth";
import { recompute } from "./registrations";

/** Detects the real file type from magic bytes – the client-declared MIME type is never trusted. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|mif1|msf1|hevc)/.test(buf.subarray(8, 12).toString("latin1"))) return "image/heic";
  return null;
}

export async function uploadDocument(
  user: SessionUser,
  input: { childId: string; registrationId?: string | null; type: DocumentType; file: File; expiresAt?: Date | null },
) {
  const child = await prisma.child.findFirst({ where: { id: input.childId, deletedAt: null } });
  if (!child || child.familyId !== user.familyId) throw forbidden();
  const buf = Buffer.from(await input.file.arrayBuffer());
  const mime = sniffMime(buf);
  const check = isAllowedUpload(mime ?? "unknown", buf.length);
  if (!check.ok || !mime) throw new AppError(check.ok ? "Format non reconnu" : check.reason);

  const { key, sha256 } = await storeEncrypted(`families/${child.familyId}`, buf);
  // A new upload of the same type replaces the previous (rejected/expired) one for this child
  await prisma.document.updateMany({ where: { childId: child.id, type: input.type, deletedAt: null, status: { not: "ACCEPTED" } }, data: { deletedAt: new Date() } });
  const doc = await prisma.document.create({
    data: {
      familyId: child.familyId, childId: child.id, registrationId: input.registrationId ?? null, type: input.type,
      storageKey: key, sha256, mimeType: mime, size: buf.length, originalName: input.file.name.slice(0, 120) || "document",
      sensitive: SENSITIVE_DOCUMENTS.includes(input.type as never), uploadedById: user.id, expiresAt: input.expiresAt ?? null,
    },
  });
  await audit(user.id, "document.upload", "Document", doc.id, { type: input.type });
  await recomputeChildRegistrations(child.id);
  return doc;
}

async function recomputeChildRegistrations(childId: string) {
  const regs = await prisma.registration.findMany({ where: { childId, status: { notIn: ["VALIDATED", "REJECTED", "CANCELLED"] } }, select: { id: true } });
  for (const r of regs) await recompute(r.id);
}

/** Who can read a document: the family, the staff of a club where the child is registered. Admins cannot read sensitive documents. */
export async function canReadDocument(user: SessionUser, doc: Document): Promise<boolean> {
  if (doc.familyId === user.familyId) return true;
  if (user.role === "ADMIN") return !doc.sensitive;
  if (user.role === "CLUB_STAFF" && doc.childId) {
    const clubIds = user.staff.map((s) => s.clubId);
    const n = await prisma.registration.count({ where: { childId: doc.childId, clubId: { in: clubIds } } });
    return n > 0;
  }
  return false;
}

export async function readDocument(user: SessionUser, id: string, ip?: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.deletedAt) throw notFound("Document");
  if (!(await canReadDocument(user, doc))) throw forbidden();
  await audit(user.id, "document.read", "Document", doc.id, { type: doc.type }, ip);
  return { doc, data: await readDecrypted(doc.storageKey) };
}

export async function reviewDocument(user: SessionUser, id: string, accept: boolean, reason?: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.deletedAt) throw notFound("Document");
  if (user.role !== "ADMIN" && !(user.role === "CLUB_STAFF" && (await canReadDocument(user, doc)))) throw forbidden();
  if (!accept && (!reason || reason.trim().length < 3)) throw new AppError("Motif de refus obligatoire");
  await prisma.document.update({ where: { id }, data: { status: accept ? "ACCEPTED" : "REJECTED", rejectReason: accept ? null : reason, reviewedById: user.id, reviewedAt: new Date() } });
  await audit(user.id, accept ? "document.accept" : "document.reject", "Document", id, { reason: reason ?? null });
  if (!accept) await notifyFamily(doc.familyId, { type: "DOCUMENT_REJECTED", title: `Document refusé : ${DOCUMENT_LABELS[doc.type]}`, body: reason!, link: "/famille" });
  if (doc.childId) await recomputeChildRegistrations(doc.childId);
}

export async function deleteDocument(user: SessionUser, id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.familyId !== user.familyId) throw forbidden();
  if (doc.status === "ACCEPTED") throw new AppError("Document validé par le club : demandez sa suppression au club");
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(user.id, "document.delete", "Document", id);
  if (doc.childId) await recomputeChildRegistrations(doc.childId);
}
