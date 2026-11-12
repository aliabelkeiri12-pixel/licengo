import { beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { getSport, defaultFootballCategories } from "@licengo/core";

process.env.DOCUMENT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.STORAGE_DIR = "./storage-test";
process.env.STRIPE_SECRET_KEY = "";

const prisma = new PrismaClient();
type SU = Awaited<ReturnType<typeof loadUser>>;
const loadUser = (id: string) => prisma.user.findUniqueOrThrow({ where: { id }, include: { staff: { select: { clubId: true, role: true } } } });

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5d1a5d40000000049454e44ae426082", "hex");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const file = (buf: Buffer, name: string, type: string) => new File([new Uint8Array(buf)], name, { type });

let family: SU, staff: SU, admin: SU, clubId: string, childId: string, u11Id: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.endsWith("/licengo_test")) throw new Error("Les tests d'intégration exigent la base licengo_test");
  execSync("npx prisma migrate deploy", { env: { ...process.env }, stdio: "ignore" });
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  const sport = await prisma.sport.create({ data: { slug: "football", name: "Football", federation: "FFF", active: true, rules: getSport("football")!.rules as object } });
  const plan = await prisma.plan.create({ data: { code: "CLUB", name: "Club", monthlyPriceCents: 2900, licenseFeeCents: 499, shopCommissionBps: 500 } });
  const club = await prisma.club.create({ data: { name: "FC Test", slug: "fc-test", sportId: sport.id, postalCode: "69003", city: "Lyon", lat: 45.76, lng: 4.86, status: "ACTIVE", planId: plan.id, stripeAccountId: "acct_mock_1", stripeChargesEnabled: true } });
  clubId = club.id;
  const { currentSeason } = await import("@/server/services/registrations");
  const season = currentSeason();
  await prisma.category.createMany({ data: defaultFootballCategories(Number(season.slice(0, 4))).map((c) => ({ ...c, clubId, season })) });
  const fam = await prisma.family.create({ data: { name: "Famille Test" } });
  family = await loadUser((await prisma.user.create({ data: { email: "f@test.fr", passwordHash: "x", firstName: "Paul", lastName: "Test", phone: "0611111111", familyId: fam.id } })).id);
  staff = await loadUser((await prisma.user.create({ data: { email: "s@test.fr", passwordHash: "x", firstName: "Sec", lastName: "Club", role: "CLUB_STAFF", staff: { create: { clubId, role: "OWNER" } } } })).id);
  admin = await loadUser((await prisma.user.create({ data: { email: "a@test.fr", passwordHash: "x", firstName: "Ad", lastName: "Min", role: "ADMIN" } })).id);
  const start = Number(season.slice(0, 4));
  childId = (await prisma.child.create({ data: { familyId: fam.id, firstName: "Léo", lastName: "Test", birthDate: new Date(Date.UTC(start - 9, 3, 1)), gender: "M" } })).id;
  u11Id = (await prisma.category.findFirstOrThrow({ where: { clubId, name: "U11" } })).id;
}, 60000);

describe("parcours complet licence", () => {
  let regId: string;

  it("crée le dossier avec prix et frais LICENGO", async () => {
    const { createRegistration } = await import("@/server/services/registrations");
    const r = await createRegistration(family as never, childId, u11Id);
    regId = r.id;
    expect(r.licenseFeeCents).toBe(15000);
    expect(r.platformFeeCents).toBe(499);
    const again = await createRegistration(family as never, childId, u11Id);
    expect(again.id).toBe(r.id);
  });

  it("refuse le paiement tant que le dossier est incomplet", async () => {
    const { startLicensePayment } = await import("@/server/services/payments");
    await expect(startLicensePayment(family as never, regId, 1)).rejects.toThrow("Complétez d'abord le dossier");
    expect(await prisma.payment.count({ where: { registrationId: regId } })).toBe(0);
  });

  it("refuse l'accès au dossier d'une autre famille", async () => {
    const { assertFamilyAccess } = await import("@/server/services/registrations");
    const other = { ...family, familyId: "autre" };
    await expect(assertFamilyAccess(other as never, regId)).rejects.toThrow("Accès refusé");
  });

  it("rejette un faux fichier (contrôle des octets magiques)", async () => {
    const { uploadDocument } = await import("@/server/services/documents");
    await expect(uploadDocument(family as never, { childId, type: "PHOTO", file: file(Buffer.from("<script>alert(1)</script>xxxxx"), "x.jpg", "image/jpeg") })).rejects.toThrow();
  });

  it("documents chiffrés : stockés illisibles, relus à l'identique, accès contrôlé", async () => {
    const { uploadDocument, readDocument } = await import("@/server/services/documents");
    const doc = await uploadDocument(family as never, { childId, registrationId: regId, type: "PHOTO", file: file(PNG, "photo.png", "image/png") });
    await uploadDocument(family as never, { childId, registrationId: regId, type: "ID_DOCUMENT", file: file(JPEG, "id.jpg", "image/jpeg") });
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(`./storage-test/${doc.storageKey}`);
    expect(raw.includes(PNG.subarray(1, 8))).toBe(false);
    const { data } = await readDocument(staff as never, doc.id);
    expect(Buffer.compare(data, PNG)).toBe(0);
    const outsider = await loadUser((await prisma.user.create({ data: { email: "o@test.fr", passwordHash: "x", firstName: "O", lastName: "X", role: "CLUB_STAFF" } })).id);
    await expect(readDocument(outsider as never, doc.id)).rejects.toThrow("Accès refusé");
    const idDoc = await prisma.document.findFirstOrThrow({ where: { childId, type: "ID_DOCUMENT" } });
    await expect(readDocument(admin as never, idDoc.id)).rejects.toThrow("Accès refusé"); // sensible : pas d'accès admin
  });

  it("soumission incomplète → INCOMPLETE, puis signatures → SUBMITTED", async () => {
    const { submitRegistration, setHealthAnswer, signDocument } = await import("@/server/services/registrations");
    let r = await submitRegistration(family as never, regId);
    expect(r.status).toBe("INCOMPLETE");
    expect(r.missingSignatures.length).toBe(3);
    await setHealthAnswer(family as never, regId, "ALL_NO");
    for (const t of ["CLUB_RULES", "PARENTAL_AUTHORIZATION", "HEALTH_QUESTIONNAIRE"] as const) await signDocument(family as never, regId, t, { signerName: "Paul Test", accepted: true });
    r = await (await import("@/server/services/registrations")).recompute(regId);
    expect(r.status).toBe("SUBMITTED");
    expect(r.progress).toBe(100);
  });

  it("le club refuse un document avec motif → dossier à corriger, puis corrigé", async () => {
    const { reviewDocument, uploadDocument } = await import("@/server/services/documents");
    const { getRegistration, submitRegistration } = await import("@/server/services/registrations");
    const photo = await prisma.document.findFirstOrThrow({ where: { childId, type: "PHOTO", deletedAt: null } });
    await expect(reviewDocument(staff as never, photo.id, false)).rejects.toThrow("Motif");
    await reviewDocument(staff as never, photo.id, false, "Photo floue");
    let reg = await getRegistration(regId);
    expect(reg.status).toBe("TO_FIX");
    expect(reg.missingSummary.join()).toContain("Photo floue");
    await uploadDocument(family as never, { childId, type: "PHOTO", file: file(PNG, "photo2.png", "image/png") });
    const res = await submitRegistration(family as never, regId);
    expect(res.status).toBe("SUBMITTED");
    const notifs = await prisma.notification.count({ where: { userId: family.id, type: "DOCUMENT_REJECTED" } });
    expect(notifs).toBe(1);
  });

  it("validation par le club avec historique", async () => {
    const { decide, getRegistration } = await import("@/server/services/registrations");
    await expect(decide(staff as never, regId, "REJECT")).rejects.toThrow("motif");
    await decide(staff as never, regId, "VALIDATE");
    const reg = await getRegistration(regId);
    expect(reg.status).toBe("VALIDATED");
    expect(reg.events.some((e) => e.type === "VALIDATE")).toBe(true);
  });

  it("paiement en 3× : 54,99 € puis 2 × 50 €, prélèvements automatiques", async () => {
    const { startLicensePayment, markInstallmentPaid, runDueInstallments } = await import("@/server/services/payments");
    const { paymentId } = await startLicensePayment(family as never, regId, 3);
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { installments: { orderBy: { index: "asc" } } } });
    expect(p.installments.map((i) => i.amountCents)).toEqual([5499, 5000, 5000]);
    expect(p.clubAmountCents).toBe(15000);
    expect(p.platformFeeCents).toBe(499);
    await markInstallmentPaid(p.installments[0].id, { intentId: "pi_1", customerId: "cus_1", paymentMethodId: "pm_mock_ok" });
    await markInstallmentPaid(p.installments[0].id, { intentId: "pi_1" }); // idempotent
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: regId } })).paymentStatus).toBe("PARTIAL");
    await expect(startLicensePayment(family as never, regId, 1)).rejects.toThrow();
    const far = new Date(Date.now() + 70 * 86400_000);
    const res = await runDueInstallments(far);
    expect(res).toEqual({ charged: 2, failed: 0 });
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: regId } })).paymentStatus).toBe("PAID");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("COMPLETED");
  });

  it("remboursement : la part club d'abord, frais LICENGO réservés à l'admin", async () => {
    const { refundPayment } = await import("@/server/services/payments");
    const p = await prisma.payment.findFirstOrThrow({ where: { registrationId: regId, status: "COMPLETED" } });
    await expect(refundPayment(staff as never, p.id, 15499, "Déménagement", true)).rejects.toThrow("LICENGO");
    await refundPayment(staff as never, p.id, 5000, "Remboursement partiel", false);
    const r = await refundPayment(admin as never, p.id, 10499, "Solde", true);
    expect(r.full).toBe(true);
    const refunds = await prisma.refund.findMany({ where: { paymentId: p.id } });
    expect(refunds.reduce((s, x) => s + x.amountCents, 0)).toBe(15499);
    expect(refunds.reduce((s, x) => s + x.feeCents, 0)).toBe(499);
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: regId } })).paymentStatus).toBe("REFUNDED");
  });
});

describe("impayés", () => {
  it("échec de prélèvement → LATE, notification famille et club, 3 tentatives max", async () => {
    const { createRegistration } = await import("@/server/services/registrations");
    const { startLicensePayment, markInstallmentPaid, runDueInstallments } = await import("@/server/services/payments");
    const fam = await prisma.family.findFirstOrThrow({ where: { guardians: { some: { id: family.id } } } });
    const start = Number((await prisma.category.findUniqueOrThrow({ where: { id: u11Id } })).season.slice(0, 4));
    const c2 = await prisma.child.create({ data: { familyId: fam.id, firstName: "Inès", lastName: "Test", birthDate: new Date(Date.UTC(start - 12, 1, 1)), gender: "F" } });
    const u13 = await prisma.category.findFirstOrThrow({ where: { clubId, name: "U13" } });
    const reg = await createRegistration(family as never, c2.id, u13.id);
    // complete the file first: payment is only possible on a complete file
    const { uploadDocument } = await import("@/server/services/documents");
    const { setHealthAnswer, signDocument } = await import("@/server/services/registrations");
    await uploadDocument(family as never, { childId: c2.id, type: "PHOTO", file: file(PNG, "p.png", "image/png") });
    await uploadDocument(family as never, { childId: c2.id, type: "ID_DOCUMENT", file: file(JPEG, "id.jpg", "image/jpeg") });
    await setHealthAnswer(family as never, reg.id, "ALL_NO");
    for (const t of ["CLUB_RULES", "PARENTAL_AUTHORIZATION", "HEALTH_QUESTIONNAIRE"] as const) await signDocument(family as never, reg.id, t, { signerName: "Paul Test", accepted: true });
    const { paymentId } = await startLicensePayment(family as never, reg.id, 2);
    const inst = await prisma.installment.findMany({ where: { paymentId }, orderBy: { index: "asc" } });
    await markInstallmentPaid(inst[0].id, { customerId: "cus", paymentMethodId: "pm_mock_faillater_1" });
    const d = new Date(Date.now() + 40 * 86400_000);
    expect(await runDueInstallments(d)).toEqual({ charged: 0, failed: 1 });
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } })).paymentStatus).toBe("LATE");
    expect(await prisma.notification.count({ where: { userId: staff.id, type: "PAYMENT_FAILED" } })).toBe(1);
    // relances à J+3, J+6 puis arrêt
    await prisma.installment.update({ where: { id: inst[1].id }, data: { updatedAt: new Date(Date.now() - 4 * 86400_000) } });
    expect((await runDueInstallments(d)).failed).toBe(1);
    await prisma.installment.update({ where: { id: inst[1].id }, data: { updatedAt: new Date(Date.now() - 4 * 86400_000) } });
    expect((await runDueInstallments(d)).failed).toBe(1);
    await prisma.installment.update({ where: { id: inst[1].id }, data: { updatedAt: new Date(Date.now() - 4 * 86400_000) } });
    expect((await runDueInstallments(d)).failed).toBe(0);
    expect((await prisma.installment.findUniqueOrThrow({ where: { id: inst[1].id } })).attempts).toBe(3);
  });

  it("relances automatiques des dossiers incomplets", async () => {
    const { runReminders } = await import("@/server/services/registrations");
    await prisma.registration.updateMany({ where: { status: { in: ["DRAFT", "INCOMPLETE"] } }, data: { updatedAt: new Date(Date.now() - 10 * 86400_000) } });
    const r1 = await runReminders();
    expect(r1.sent).toBeGreaterThan(0);
    const r2 = await runReminders();
    expect(r2.sent).toBe(0); // pas de double relance
  });
});

describe("boutique", () => {
  it("panier → commande, stock réservé atomiquement, commission 5 %", async () => {
    const { addToCart, checkoutCart } = await import("@/server/services/shop");
    const product = await prisma.product.create({ data: { clubId, name: "Maillot", category: "MAILLOT", priceCents: 3500, variants: { create: [{ size: "M", sku: "T-M", stock: 2 }] } }, include: { variants: true } });
    const v = product.variants[0];
    await expect(addToCart(family as never, v.id, 3)).rejects.toThrow("Stock insuffisant");
    await addToCart(family as never, v.id, 2);
    const [order] = await checkoutCart(family as never);
    expect(order.subtotalCents).toBe(7000);
    expect(order.platformFeeCents).toBe(350);
    expect(order.clubAmountCents).toBe(6650);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: v.id } })).stock).toBe(0);
    expect(await prisma.cartItem.count({ where: { userId: family.id } })).toBe(0);
  });

  it("annulation d'une commande non payée → stock restitué", async () => {
    const { cancelUnpaidOrder } = await import("@/server/services/shop");
    const o = await prisma.shopOrder.findFirstOrThrow({ where: { userId: family.id } });
    await cancelUnpaidOrder(family as never, o.id);
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { sku: "T-M" } });
    expect(v.stock).toBe(2);
  });
});

describe("recherche de clubs", () => {
  it("par coordonnées et rayon", async () => {
    const { searchClubs } = await import("@/server/services/clubs");
    const near = await searchClubs({ lat: 45.75, lng: 4.85, radiusKm: 10 });
    expect(near.results.map((c) => c.slug)).toContain("fc-test");
    const far = await searchClubs({ lat: 48.85, lng: 2.35, radiusKm: 10 });
    expect(far.results).toHaveLength(0);
  });
});
