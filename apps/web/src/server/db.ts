import { PrismaClient } from "@prisma/client";

const create = () => new PrismaClient({ omit: { product: { imageData: true } } }); // product photos are only loaded by their route
const g = globalThis as unknown as { prisma?: ReturnType<typeof create> };
export const prisma = g.prisma ?? create();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
