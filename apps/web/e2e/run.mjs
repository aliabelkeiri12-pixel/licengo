// End-to-end scenario (Playwright library): famille → club → admin. Usage: BASE_URL=http://localhost:3000 node e2e/run.mjs
import { createRequire } from "node:module";
const { chromium, devices } = createRequire(import.meta.url)("playwright"); // pre-installed browser, or `npm i -D playwright`
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? path.resolve("../../docs/ecrans");
mkdirSync(SHOTS, { recursive: true });
const tmp = path.resolve("test-results"); mkdirSync(tmp, { recursive: true });
const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5d1a5d40000000049454e44ae426082", "hex");
writeFileSync(path.join(tmp, "photo.png"), png);
writeFileSync(path.join(tmp, "identite.pdf"), Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"));

const step = async (name, fn) => { process.stdout.write(`• ${name} … `); const t = Date.now(); await fn(); console.log(`ok (${Date.now() - t} ms)`); };
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
const expectText = async (page, text, timeout = 15000) => page.getByText(text, { exact: false }).first().waitFor({ timeout });

const browser = await chromium.launch();
const errors = [];
try {
  // ---------------- FAMILLE (iPhone) ----------------
  const tls = { ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS === "1" }; // certificat local (Caddy) en recette
  const mobile = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", ...tls });
  const page = await mobile.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const email = `e2e.${Date.now()}@exemple.fr`;

  await step("Accueil", async () => { await page.goto(BASE); await expectText(page, "sans paperasse"); await shot(page, "01-accueil-mobile"); });
  await step("Création de compte famille", async () => {
    await page.goto(`${BASE}/inscription`);
    await page.fill('[name="firstName"]', "Sarah"); await page.fill('[name="lastName"]', "Durand");
    await page.fill('[name="email"]', email); await page.fill('[name="phone"]', "06 98 76 54 32");
    await page.fill('[name="password"]', "Motdepasse2026");
    await page.check('[name="acceptTerms"]');
    await shot(page, "02-inscription-famille");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/famille/enfants/nouveau");
  });
  await step("Ajout d'un enfant", async () => {
    await page.fill('[name="firstName"]', "Noah");
    await page.fill('[name="birthDate"]', "2016-06-15");
    await page.selectOption('[name="gender"]', "M");
    await page.fill('[name="birthPlace"]', "Lyon");
    await shot(page, "03-ajout-enfant");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/famille\/enfants\/\w+/);
    await expectText(page, "Informations enregistrées");
  });
  await step("Recherche de club par code postal", async () => {
    await page.goto(`${BASE}/clubs?q=69003&rayon=10`);
    await expectText(page, "FC Lyon Est");
    await shot(page, "04-recherche-clubs");
    await page.getByText("FC Lyon Est").first().click();
    await page.waitForURL("**/clubs/fc-lyon-est**");
    await expectText(page, "Commencer l'inscription");
    await shot(page, "05-page-club");
  });
  await step("Création du dossier (catégorie proposée automatiquement)", async () => {
    const cat = await page.locator('[name="categoryId"] option:checked').textContent();
    if (!cat?.includes("U11")) throw new Error(`catégorie inattendue ${cat}`);
    await page.click("text=Commencer l'inscription");
    await page.waitForURL(/\/famille\/inscriptions\/\w+/);
    await expectText(page, "Dossier de Noah");
    await page.getByTestId("payment-locked").waitFor(); // pas de paiement possible tant que le dossier est incomplet
    if (await page.getByRole("button", { name: /Payer/ }).count()) throw new Error("bouton Payer visible sur un dossier incomplet");
  });
  await step("Envoi des documents (photo + pièce d'identité)", async () => {
    await page.setInputFiles('[data-testid="file-PHOTO"]', path.join(tmp, "photo.png"));
    await page.waitForSelector('[data-testid="file-PHOTO"]', { state: "detached", timeout: 15000 });
    await page.setInputFiles('[data-testid="file-ID_DOCUMENT"]', path.join(tmp, "identite.pdf"));
    await page.waitForSelector('[data-testid="file-ID_DOCUMENT"]', { state: "detached", timeout: 15000 });
  });
  await step("Questionnaire de santé + signatures électroniques", async () => {
    await page.click("text=Oui, NON partout");
    await page.waitForSelector('[data-testid="sigpad-HEALTH_QUESTIONNAIRE"]');
    for (const t of ["CLUB_RULES", "PARENTAL_AUTHORIZATION", "HEALTH_QUESTIONNAIRE"]) {
      const pad = page.locator(`[data-testid="sigpad-${t}"]`);
      await pad.scrollIntoViewIfNeeded();
      const b = await pad.boundingBox();
      await page.mouse.move(b.x + 20, b.y + 60); await page.mouse.down();
      for (let i = 0; i < 12; i++) await page.mouse.move(b.x + 30 + i * 18, b.y + 40 + (i % 2) * 40);
      await page.mouse.up();
      if (t === "CLUB_RULES") await shot(page, "06-signature");
      await pad.locator("xpath=ancestor::form").getByRole("button", { name: /Signer/ }).click();
      await page.waitForSelector(`[data-testid="sigpad-${t}"]`, { state: "detached", timeout: 15000 });
    }
  });
  await step("Envoi du dossier complet au club", async () => {
    await page.click("text=Envoyer le dossier complet");
    await expectText(page, "Dossier complet transmis au club");
    await shot(page, "07-dossier-complet");
  });
  await step("Paiement en 3 fois (54,99 € aujourd'hui)", async () => {
    await page.getByRole("radio", { name: /3×/ }).click();
    await expectText(page, "54,99");
    await page.getByTestId("balance-clause").check();
    await shot(page, "08-paiement-echeancier");
    await page.getByRole("button", { name: /Payer 54,99/ }).click();
    await page.waitForURL("**/paiement/simulation/**");
    await shot(page, "09-page-paiement");
    await page.click('button[type="submit"]');
    await page.waitForURL("**paiement=ok**");
    await expectText(page, "Paiement confirmé");
  });
  await step("Mes paiements : échéances et factures PDF", async () => {
    await page.goto(`${BASE}/famille/paiements`);
    await expectText(page, "Toutes mes factures");
    const links = page.getByTestId("invoice-link");
    if ((await links.count()) < 2) throw new Error("factures club + LICENGO attendues");
    const href = await links.first().getAttribute("href");
    const res = await page.request.get(BASE + href);
    if (res.headers()["content-type"] !== "application/pdf" || !(await res.body()).subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("PDF invalide");
    await shot(page, "17-mes-paiements");
  });
  await step("Boutique : ajout au panier et commande", async () => {
    await page.goto(`${BASE}/boutique/fc-lyon-est`);
    await expectText(page, "Boutique officielle");
    await shot(page, "10-boutique");
    await page.getByRole("button", { name: "Ajouter au panier" }).first().click();
    await expectText(page, "Ajouté au panier");
    await page.goto(`${BASE}/panier`);
    await shot(page, "11-panier");
    await page.click("text=Commander et payer");
    await page.waitForURL("**/paiement/simulation/**");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/commandes/**paiement=ok");
    await expectText(page, "Paiement reçu");
    await shot(page, "12-commande");
  });
  await step("Tableau de bord famille & notifications", async () => {
    await page.goto(`${BASE}/famille`);
    await expectText(page, "Bonjour Sarah");
    await shot(page, "13-accueil-famille");
    await page.goto(`${BASE}/famille/notifications`);
    await expectText(page, "Paiement confirmé");
    await shot(page, "14-notifications");
  });
  await mobile.close();

  // ---------------- CLUB (desktop) ----------------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "fr-FR", ...tls });
  const club = await desk.newPage();
  club.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const login = async (p, mail) => {
    await p.goto(`${BASE}/connexion`);
    await p.fill('[name="email"]', mail); await p.fill('[name="password"]', "Licengo2026!");
    await p.click('button[type="submit"]');
  };
  await step("Mot de passe oublié (réponse neutre, jeton invalide refusé)", async () => {
    await club.goto(`${BASE}/mot-de-passe`);
    await club.fill('[name="email"]', "inconnu@exemple.fr");
    await club.click('button[type="submit"]');
    await expectText(club, "Si un compte existe pour cet email");
    await club.goto(`${BASE}/mot-de-passe/nouveau?token=faux`);
    await club.fill('[name="password"]', "Nouveau2026xx"); await club.fill('[name="confirm"]', "Nouveau2026xx");
    await club.click('button[type="submit"]');
    await expectText(club, "Lien invalide ou expiré");
  });
  await step("Connexion secrétaire du club", async () => { await login(club, "secretariat@fclyonest.fr"); await club.waitForURL("**/club"); await expectText(club, "Tableau de bord"); await shot(club, "20-club-tableau-de-bord"); });
  await step("Liste des dossiers à valider", async () => {
    await club.goto(`${BASE}/club/dossiers?statut=SUBMITTED`);
    await expectText(club, "DURAND Noah");
    await shot(club, "21-club-dossiers");
    await club.click("text=DURAND Noah");
    await club.waitForURL(/\/club\/dossiers\/\w+/);
    await expectText(club, "Dossier complet et cohérent");
    await shot(club, "22-club-dossier-detail");
  });
  await step("Validation du dossier", async () => {
    await club.getByRole("button", { name: "✓ Valider le dossier" }).click();
    await expectText(club, "Dossier validé, la famille est notifiée");
  });
  await step("Commande boutique côté club", async () => {
    await club.goto(`${BASE}/club/boutique`);
    await expectText(club, "Commandes");
    await shot(club, "23-club-boutique");
    await club.goto(`${BASE}/club/paiements`);
    await shot(club, "24-club-paiements");
  });
  await step("Déconnexion", async () => { await club.getByRole("button", { name: "Se déconnecter" }).last().click(); await club.waitForURL(BASE + "/"); });

  // ---------------- ADMIN ----------------
  await step("Back-office LICENGO", async () => {
    await login(club, "admin@licengo.fr");
    await club.waitForURL("**/admin");
    await expectText(club, "Revenus transactionnels");
    await shot(club, "30-admin-vue-ensemble");
    await club.goto(`${BASE}/admin/transactions`);
    await expectText(club, "Transactions");
    await shot(club, "31-admin-transactions");
    await club.goto(`${BASE}/admin/clubs`);
    await shot(club, "32-admin-clubs");
  });
  await step("Contrôle d'accès : un admin n'ouvre pas l'espace famille d'autrui", async () => {
    const r = await club.request.get(`${BASE}/api/v1/registrations`);
    if (r.status() !== 403) throw new Error(`attendu 403, reçu ${r.status()}`);
  });
  await desk.close();
} finally {
  await browser.close();
}
if (errors.length) { console.error("Erreurs navigateur :", errors); process.exit(1); }
console.log("\n✅ Scénario E2E complet réussi");
