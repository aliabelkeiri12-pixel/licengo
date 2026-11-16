import { prisma } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import type { SessionUser } from "../auth";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Deletes registrations (and everything hanging from them), then the players left without any registration. */
async function deleteRegistrations(regIds: string[], childIds: string[] = []) {
  const payments = await prisma.payment.findMany({ where: { registrationId: { in: regIds } }, select: { id: true } });
  const payIds = payments.map((p) => p.id);
  const docs = await prisma.document.findMany({ where: { OR: [{ registrationId: { in: regIds } }, { childId: { in: childIds } }] }, select: { id: true, storageKey: true } });
  const sigs = await prisma.signature.findMany({ where: { registrationId: { in: regIds } }, select: { imageKey: true } });
  const keys = [...docs.map((d) => d.storageKey), ...sigs.map((s) => s.imageKey).filter((k): k is string => !!k)];
  await prisma.$transaction([
    prisma.refund.deleteMany({ where: { paymentId: { in: payIds } } }),
    prisma.invoice.deleteMany({ where: { paymentId: { in: payIds } } }),
    prisma.installment.deleteMany({ where: { paymentId: { in: payIds } } }),
    prisma.payment.deleteMany({ where: { id: { in: payIds } } }),
    prisma.signature.deleteMany({ where: { registrationId: { in: regIds } } }),
    prisma.registrationEvent.deleteMany({ where: { registrationId: { in: regIds } } }),
    prisma.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } }),
    prisma.registration.deleteMany({ where: { id: { in: regIds } } }),
    prisma.storedObject.deleteMany({ where: { key: { in: keys } } }),
  ]);
  // players left without any registration disappear too
  const orphans = await prisma.child.findMany({ where: { id: { in: childIds }, registrations: { none: {} } }, select: { id: true } });
  if (orphans.length) {
    await prisma.document.deleteMany({ where: { childId: { in: orphans.map((o) => o.id) } } });
    await prisma.child.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  }
  return { registrations: regIds.length, players: orphans.length };
}

/** Deletes a family entirely: players, files, payments, shop orders, invoices, guardian accounts. */
export async function deleteFamilyData(familyId: string) {
  const children = await prisma.child.findMany({ where: { familyId }, select: { id: true } });
  const childIds = children.map((c) => c.id);
  const regs = await prisma.registration.findMany({ where: { childId: { in: childIds } }, select: { id: true } });
  await deleteRegistrations(regs.map((r) => r.id), childIds);
  const users = await prisma.user.findMany({ where: { familyId, role: "FAMILY" }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const orders = await prisma.shopOrder.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
  const pays = await prisma.payment.findMany({ where: { OR: [{ orderId: { in: orders.map((o) => o.id) } }, { payerId: { in: userIds } }] }, select: { id: true } });
  const payIds = pays.map((p) => p.id);
  const docs = await prisma.document.findMany({ where: { familyId }, select: { storageKey: true } });
  await prisma.$transaction([
    prisma.refund.deleteMany({ where: { paymentId: { in: payIds } } }),
    prisma.invoice.deleteMany({ where: { paymentId: { in: payIds } } }),
    prisma.installment.deleteMany({ where: { paymentId: { in: payIds } } }),
    prisma.payment.deleteMany({ where: { id: { in: payIds } } }),
    prisma.shopOrder.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } }),
    prisma.signature.deleteMany({ where: { signerId: { in: userIds } } }),
    prisma.auditLog.updateMany({ where: { actorId: { in: userIds } }, data: { actorId: null } }),
    prisma.storedObject.deleteMany({ where: { key: { in: docs.map((d) => d.storageKey) } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.family.deleteMany({ where: { id: familyId } }),
  ]);
  return { users: userIds.length, players: childIds.length };
}

/** Admin: deletes every family except the one(s) of the players to keep. */
export async function purgeFamiliesExcept(user: SessionUser, keepQuery: string) {
  const words = norm(keepQuery).split(/\s+/).filter(Boolean);
  if (!words.length) throw new AppError("Indiquez le joueur dont la famille est à garder");
  const children = await prisma.child.findMany({ select: { familyId: true, firstName: true, lastName: true } });
  const keepFamilies = new Set(children.filter((c) => { const parts = norm(`${c.firstName} ${c.lastName}`).split(/[\s-]+/); return words.every((w) => parts.some((p) => p.startsWith(w))); }).map((c) => c.familyId));
  if (!keepFamilies.size) throw new AppError(`Aucun joueur « ${keepQuery} » trouvé : aucune famille n'a été effacée`);
  const families = await prisma.family.findMany({ where: { id: { notIn: [...keepFamilies] } }, select: { id: true } });
  let users = 0;
  for (const f of families) users += (await deleteFamilyData(f.id)).users;
  // family accounts never attached to a family
  const loose = await prisma.user.findMany({ where: { role: "FAMILY", familyId: null }, select: { id: true } });
  for (const u of loose) {
    await prisma.auditLog.updateMany({ where: { actorId: u.id }, data: { actorId: null } });
    await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
  }
  await audit(user.id, "admin.purge_families", "Platform", undefined, { deleted: families.length });
  return { families: families.length, users: users + loose.length };
}

/** Club: delete a player's file in this club; the player disappears entirely if he has no other club. */
export async function deletePlayerFromClub(user: SessionUser, clubId: string, registrationId: string) {
  const r = await prisma.registration.findFirst({ where: { id: registrationId, clubId }, include: { child: true } });
  if (!r) throw new AppError("Dossier introuvable");
  const res = await deleteRegistrations([r.id], [r.childId]);
  await audit(user.id, "registration.delete", "Registration", r.id, { player: `${r.child.firstName} ${r.child.lastName}` });
  return { ...res, name: `${r.child.lastName.toUpperCase()} ${r.child.firstName}` };
}

/**
 * Admin (demo): deletes every player everywhere except those matching the names to keep
 * (each word must start a word of the player's name, accents and case ignored: "Idriss Dramé" keeps "DRAMÉ Idrissa").
 */
export async function purgePlayersExcept(user: SessionUser, keepQuery: string) {
  const words = norm(keepQuery).split(/\s+/).filter(Boolean);
  if (!words.length) throw new AppError("Indiquez le joueur à garder");
  const children = await prisma.child.findMany({ select: { id: true, firstName: true, lastName: true } });
  const keep = children.filter((c) => { const parts = norm(`${c.firstName} ${c.lastName}`).split(/[\s-]+/); return words.every((w) => parts.some((p) => p.startsWith(w))); });
  if (!keep.length) throw new AppError(`Aucun joueur « ${keepQuery} » trouvé : rien n'a été effacé`);
  const del = children.filter((c) => !keep.includes(c)).map((c) => c.id);
  const regs = await prisma.registration.findMany({ where: { childId: { in: del } }, select: { id: true } });
  const res = await deleteRegistrations(regs.map((r) => r.id), del);
  const left = await prisma.child.deleteMany({ where: { id: { in: del } } }); // players never registered
  await audit(user.id, "admin.purge_players", "Platform", undefined, { kept: keep.map((k) => `${k.firstName} ${k.lastName}`), deleted: del.length });
  return { kept: keep.map((k) => `${k.lastName.toUpperCase()} ${k.firstName}`), deleted: res.players + left.count, registrations: res.registrations };
}
