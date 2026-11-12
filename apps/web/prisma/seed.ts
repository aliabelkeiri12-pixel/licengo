import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/server/demo-seed";

const prisma = new PrismaClient();
seedDemo(prisma).finally(() => prisma.$disconnect());
