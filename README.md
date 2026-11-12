# LICENGO

Plateforme multisport de gestion des licences : inscriptions, dossiers administratifs, documents, signatures, paiements échelonnés répartis automatiquement entre club et plateforme, boutique de club et back-office.

| Espace | Support | Chemin |
|---|---|---|
| Familles | App iOS / Android (Expo) + PWA web responsive | `apps/mobile`, `apps/web` → `/famille` |
| Clubs | Site web (tableau de bord secrétaire / trésorier) | `apps/web` → `/club` |
| LICENGO | Back-office administrateur | `apps/web` → `/admin` |
| API | REST JSON v1 (consommée par l'app mobile) | `apps/web/src/app/api/v1` |

## Démarrage rapide

Prérequis : Node 22, pnpm 10, PostgreSQL 16.

```bash
pnpm install
```
```bash
cp apps/web/.env.example apps/web/.env   # ajuster DATABASE_URL
```
```bash
pnpm --filter @licengo/web exec prisma migrate deploy && pnpm db:seed
```
```bash
pnpm dev   # http://localhost:3000
```

Comptes de démonstration (mot de passe `Licengo2026!`) : `famille.martin@exemple.fr`, `secretariat@fclyonest.fr` (club FC Lyon Est), `admin@licengo.fr`.
Sans clé Stripe, un prestataire de paiement **simulé** est utilisé (cartes de test : `4242…` succès, `4000 0000 0000 0002` refus, `4000 0000 0000 0341` échéances suivantes en échec).

App mobile : `cd apps/mobile && EXPO_PUBLIC_API_URL=http://<ip-locale>:3000 pnpm start` puis Expo Go / build de développement.

## Tests

```bash
pnpm --filter @licengo/core test        # 20 tests unitaires (tarification, échéancier, complétude, validation)
```
```bash
pnpm --filter @licengo/web test         # 14 tests d'intégration sur PostgreSQL (base licengo_test)
```
```bash
pnpm --filter @licengo/web e2e          # scénario navigateur complet famille → club → admin (serveur lancé)
```

## Structure

```
packages/core     Logique métier pure, partagée web + mobile (prix, échéances, règles sportives, complétude, schémas zod)
apps/web          Next.js 15 (App Router) : pages famille/club/admin, server actions, API v1, Prisma/PostgreSQL
apps/mobile       Expo SDK 58 / React Native : app famille (caméra, signature, push, paiement)
docs/             Architecture, sécurité & RGPD, fédérations, déploiement & stores, identité visuelle, écrans
```

**Mise en ligne en quelques clics : [docs/MISE-EN-LIGNE-RENDER.md](docs/MISE-EN-LIGNE-RENDER.md)**

Documentation : [Architecture](docs/ARCHITECTURE.md) · [Sécurité & RGPD](docs/SECURITE-RGPD.md) · [Fédérations](docs/FEDERATIONS.md) · [Déploiement & stores](docs/DEPLOIEMENT.md) · [Identité visuelle](docs/IDENTITE-VISUELLE.md) · [Écrans](docs/ECRANS.md) · [Feuille de route](docs/ROADMAP.md)
