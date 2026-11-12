/**
 * Initialisation idempotente d'une base de production (sans rien supprimer) :
 * offres, sports, et premier compte administrateur (ADMIN_EMAIL / ADMIN_PASSWORD).
 * Avec DEMO_DATA=1 et une base vide, charge d'abord les données de démonstration.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { execSync } from "node:child_process";
import { SPORTS } from "@licengo/core";

const prisma = new PrismaClient();

async function main() {
  if (process.env.DEMO_DATA === "1" && (await prisma.user.count()) === 0) {
    execSync("pnpm exec tsx prisma/seed.ts", { stdio: "inherit" });
    // the demo admin has a public password: never keep it on a reachable server
    await prisma.user.deleteMany({ where: { email: "admin@licengo.fr" } });
  }
  const plans = [
    { code: "STARTER", name: "Starter", monthlyPriceCents: 0, licenseFeeCents: 499, shopCommissionBps: 800, maxLicensees: 150 },
    { code: "CLUB", name: "Club", monthlyPriceCents: 2900, licenseFeeCents: 499, shopCommissionBps: 500, maxLicensees: 600 },
    { code: "PREMIUM", name: "Premium", monthlyPriceCents: 7900, licenseFeeCents: 399, shopCommissionBps: 300, maxLicensees: null },
  ];
  for (const p of plans) await prisma.plan.upsert({ where: { code: p.code }, create: p, update: {} });
  for (const s of SPORTS)
    await prisma.sport.upsert({
      where: { slug: s.slug },
      create: { slug: s.slug, name: s.name, federation: s.federation, emoji: s.emoji, active: s.active, rules: s.rules as object },
      update: {},
    });

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password && (await prisma.user.count({ where: { role: "ADMIN" } })) === 0) {
    if (password.length < 12) throw new Error("ADMIN_PASSWORD : 12 caractères minimum");
    await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(password, 12), firstName: "Admin", lastName: "LICENGO", role: "ADMIN", termsAcceptedAt: new Date() },
    });
    console.log(`Administrateur créé : ${email}`);
  }
  console.log("Bootstrap OK");
}

main().finally(() => prisma.$disconnect());
