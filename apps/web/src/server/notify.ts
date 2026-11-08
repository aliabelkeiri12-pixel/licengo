import { prisma } from "./db";

/**
 * Multi-channel notification: in-app (DB), mobile push (Expo Push API – free, wraps APNs & FCM)
 * and e-mail (transactional provider e.g. Brevo, logged in development).
 */
export async function notify(userId: string, n: { type: string; title: string; body: string; link?: string }) {
  await prisma.notification.create({ data: { userId, ...n } });
  const tokens = await prisma.pushToken.findMany({ where: { userId } });
  if (tokens.length && process.env.EXPO_PUSH_ENABLED === "1") {
    fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tokens.map((t) => ({ to: t.token, title: n.title, body: n.body, data: { link: n.link } }))),
    }).catch((e) => console.error("push failed", e));
  }
  if (process.env.NODE_ENV !== "test") console.info(`[notify] ${userId} – ${n.title}: ${n.body}`);
}

export async function notifyFamily(familyId: string, n: { type: string; title: string; body: string; link?: string }) {
  const guardians = await prisma.user.findMany({ where: { familyId, deletedAt: null }, select: { id: true } });
  await Promise.all(guardians.map((g) => notify(g.id, n)));
}

export async function notifyClubStaff(clubId: string, n: { type: string; title: string; body: string; link?: string }) {
  const staff = await prisma.clubStaff.findMany({ where: { clubId }, select: { userId: true } });
  await Promise.all(staff.map((s) => notify(s.userId, n)));
}
