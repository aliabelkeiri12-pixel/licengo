import type { PrismaClient, ProductCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SPORTS, defaultFootballCategories, seasonStartYear, seasonLabel } from "@licengo/core";

const PASSWORD = "Licengo2026!";

const clubs = [
  { name: "FC Lyon Est", city: "Lyon", postalCode: "69003", lat: 45.7597, lng: 4.8592, color: "#0B3D2E" },
  { name: "AS Villeurbanne Éveil", city: "Villeurbanne", postalCode: "69100", lat: 45.7719, lng: 4.8902, color: "#1D4ED8" },
  { name: "Olympique Vénissieux", city: "Vénissieux", postalCode: "69200", lat: 45.6975, lng: 4.8867, color: "#B91C1C" },
  { name: "Caluire SC", city: "Caluire-et-Cuire", postalCode: "69300", lat: 45.7953, lng: 4.8467, color: "#7C3AED" },
  { name: "Paris Belleville FC", city: "Paris", postalCode: "75020", lat: 48.8638, lng: 2.3985, color: "#0F172A" },
  { name: "Red Star Montreuil Jeunes", city: "Montreuil", postalCode: "93100", lat: 48.8638, lng: 2.4485, color: "#15803D" },
  { name: "US Marseille Endoume", city: "Marseille", postalCode: "13007", lat: 43.2833, lng: 5.3570, color: "#0369A1" },
  { name: "Bordeaux Bastide FC", city: "Bordeaux", postalCode: "33100", lat: 44.8430, lng: -0.5560, color: "#9F1239" },
  { name: "Toulouse Minimes FC", city: "Toulouse", postalCode: "31200", lat: 43.6200, lng: 1.4330, color: "#C2410C" },
  { name: "Lille Fives Football", city: "Lille", postalCode: "59800", lat: 50.6320, lng: 3.0890, color: "#BE123C" },
  { name: "Nantes Doulon FC", city: "Nantes", postalCode: "44300", lat: 47.2290, lng: -1.5200, color: "#CA8A04" },
  { name: "Strasbourg Neudorf AS", city: "Strasbourg", postalCode: "67100", lat: 48.5650, lng: 7.7600, color: "#1E3A8A" },
];

const products: { name: string; category: ProductCategory; price: number; sizes: string[]; desc: string }[] = [
  { name: "Maillot domicile 26/27", category: "MAILLOT", price: 3500, sizes: ["6 ans", "8 ans", "10 ans", "12 ans", "14 ans", "S", "M", "L", "XL"], desc: "Maillot officiel, tissu respirant recyclé. Flocage nom possible." },
  { name: "Short officiel", category: "SHORT", price: 1800, sizes: ["6 ans", "8 ans", "10 ans", "12 ans", "14 ans", "S", "M", "L", "XL"], desc: "Short de match aux couleurs du club." },
  { name: "Chaussettes de match", category: "CHAUSSETTES", price: 1000, sizes: ["27-30", "31-34", "35-38", "39-42", "43-46"], desc: "Chaussettes renforcées." },
  { name: "Survêtement club", category: "SURVETEMENT", price: 5900, sizes: ["8 ans", "10 ans", "12 ans", "14 ans", "S", "M", "L", "XL"], desc: "Veste zippée et pantalon, logo brodé." },
  { name: "Veste coupe-vent", category: "VESTE", price: 3900, sizes: ["10 ans", "12 ans", "14 ans", "S", "M", "L", "XL"], desc: "Déperlante, capuche intégrée." },
  { name: "Parka d'hiver", category: "PARKA", price: 7900, sizes: ["10 ans", "12 ans", "14 ans", "S", "M", "L", "XL"], desc: "Parka chaude pour les dimanches matin au bord du terrain." },
  { name: "Sac de sport", category: "SAC", price: 3200, sizes: ["Unique"], desc: "Sac 45 L avec compartiment chaussures." },
  { name: "Bonnet", category: "BONNET", price: 1500, sizes: ["Unique"], desc: "Bonnet maille, écusson brodé." },
  { name: "Gants thermiques", category: "GANTS", price: 1400, sizes: ["Enfant", "Adulte"], desc: "Gants tactiles chauds." },
];

/** Wipes the database and loads the demo data set (12 football clubs, shop, demo accounts). */
export async function seedDemo(prisma: PrismaClient) {
  const now = new Date();
  const season = seasonLabel(seasonStartYear(now, 7));
  const start = seasonStartYear(now, 7);
  const hash = await bcrypt.hash(PASSWORD, 12);

  await prisma.$transaction([
    prisma.auditLog.deleteMany(), prisma.passwordResetToken.deleteMany(), prisma.webhookEvent.deleteMany(), prisma.notification.deleteMany(), prisma.pushToken.deleteMany(),
    prisma.refund.deleteMany(), prisma.installment.deleteMany(), prisma.payment.deleteMany(), prisma.shopOrderItem.deleteMany(), prisma.shopOrder.deleteMany(),
    prisma.cartItem.deleteMany(), prisma.productVariant.deleteMany(), prisma.product.deleteMany(), prisma.supplier.deleteMany(),
    prisma.signature.deleteMany(), prisma.registrationEvent.deleteMany(), prisma.document.deleteMany(), prisma.registration.deleteMany(),
    prisma.category.deleteMany(), prisma.clubStaff.deleteMany(), prisma.session.deleteMany(), prisma.club.deleteMany(),
    prisma.child.deleteMany(), prisma.user.deleteMany(), prisma.family.deleteMany(), prisma.plan.deleteMany(), prisma.sport.deleteMany(),
  ]);

  const [starter, club, premium] = await Promise.all([
    prisma.plan.create({ data: { code: "STARTER", name: "Starter", monthlyPriceCents: 0, licenseFeeCents: 499, shopCommissionBps: 800, maxLicensees: 150 } }),
    prisma.plan.create({ data: { code: "CLUB", name: "Club", monthlyPriceCents: 2900, licenseFeeCents: 499, shopCommissionBps: 500, maxLicensees: 600 } }),
    prisma.plan.create({ data: { code: "PREMIUM", name: "Premium", monthlyPriceCents: 7900, licenseFeeCents: 399, shopCommissionBps: 300 } }),
  ]);
  const plans = [starter, club, premium];

  const sports = await Promise.all(SPORTS.map((s) => prisma.sport.create({ data: { slug: s.slug, name: s.name, federation: s.federation, emoji: s.emoji, active: s.active, rules: s.rules as object } })));
  const football = sports.find((s) => s.slug === "football")!;

  await prisma.user.create({ data: { email: "admin@licengo.fr", passwordHash: hash, firstName: "Admin", lastName: "LICENGO", role: "ADMIN", termsAcceptedAt: now } });
  const globalSupplier = await prisma.supplier.create({ data: { name: "TexSport France (fournisseur partenaire)", email: "commandes@texsport.example" } });

  for (const [i, c] of clubs.entries()) {
    const slug = c.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const created = await prisma.club.create({
      data: {
        name: c.name, slug, sportId: football.id, city: c.city, postalCode: c.postalCode, lat: c.lat, lng: c.lng, primaryColor: c.color,
        address: `${10 + i} avenue du Stade`, email: `contact@${slug}.fr`, phone: "0472000000", federationNumber: `5${(40000 + i * 137).toString()}`,
        description: `Club de football familial à ${c.city}. École de foot labellisée, encadrement diplômé, de U7 à Seniors.`,
        status: "ACTIVE", planId: plans[i % 3].id, subscriptionStatus: "active", stripeAccountId: `acct_mock_demo${i}`, stripeChargesEnabled: true,
      },
    });
    await prisma.category.createMany({ data: defaultFootballCategories(start).map((cat) => ({ ...cat, clubId: created.id, season, capacity: 40 })) });
    if (i === 0) await prisma.category.createMany({ data: defaultFootballCategories(start + 1).map((cat) => ({ ...cat, clubId: created.id, season: seasonLabel(start + 1), capacity: 40 })) });
    for (const [pi, p] of products.entries()) {
      await prisma.product.create({
        data: {
          clubId: created.id, name: p.name, category: p.category, priceCents: p.price, costCents: Math.round(p.price * 0.55), description: p.desc, supplierId: globalSupplier.id,
          variants: { create: p.sizes.map((size, si) => ({ size, sku: `${slug.slice(0, 6).toUpperCase()}-${pi}-${si}`, stock: (si * 7 + pi * 3) % 15 + 2 })) },
        },
      });
    }
  }

  const lyon = await prisma.club.findUniqueOrThrow({ where: { slug: "fc-lyon-est" } });
  await prisma.user.create({ data: { email: "secretariat@fclyonest.fr", passwordHash: hash, firstName: "Nadia", lastName: "Benali", phone: "0611223344", role: "CLUB_STAFF", termsAcceptedAt: now, staff: { create: { clubId: lyon.id, role: "OWNER" } } } });

  const family = await prisma.family.create({ data: { name: "Famille Martin", address: "12 rue Paul Bert", postalCode: "69003", city: "Lyon" } });
  await prisma.user.create({ data: { email: "famille.martin@exemple.fr", passwordHash: hash, firstName: "Claire", lastName: "Martin", phone: "0612345678", termsAcceptedAt: now, familyId: family.id } });
  await prisma.child.createMany({ data: [
    { familyId: family.id, firstName: "Léo", lastName: "Martin", birthDate: new Date(Date.UTC(start - 9, 4, 12)), gender: "M", birthPlace: "Lyon" },
    { familyId: family.id, firstName: "Inès", lastName: "Martin", birthDate: new Date(Date.UTC(start - 12, 9, 3)), gender: "F", birthPlace: "Lyon" },
  ] });

  console.log(`Seed OK – saison ${season}, ${clubs.length} clubs. Comptes (mot de passe ${PASSWORD}) : admin@licengo.fr, secretariat@fclyonest.fr, famille.martin@exemple.fr`);
}

