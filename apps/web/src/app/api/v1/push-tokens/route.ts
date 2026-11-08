import { z } from "zod";
import { api, json } from "@/lib/api";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";

/** Registers an Expo push token (APNs on iOS / FCM on Android behind Expo's free push service). */
export const POST = api(async (req) => {
  const u = await requireUser();
  const d = z.object({ token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[.+\]$/), platform: z.enum(["ios", "android"]) }).parse(await json(req));
  await prisma.pushToken.upsert({ where: { token: d.token }, create: { ...d, userId: u.id }, update: { userId: u.id, platform: d.platform } });
  return { ok: true };
});
