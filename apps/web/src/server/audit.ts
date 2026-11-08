import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function audit(actorId: string | null, action: string, entityType: string, entityId?: string, data?: Prisma.InputJsonValue, ip?: string) {
  await prisma.auditLog.create({ data: { actorId, action, entityType, entityId, data, ip } }).catch((e) => console.error("audit failed", e));
}
