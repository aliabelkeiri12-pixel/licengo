# Mise en production

## 1. Infrastructure (phase 1 : jusqu'à ~100 clubs)

Un serveur en France (ex. Scaleway Instance PRO2-XS, ~30 €/mois) suffit :

```bash
cp .env.production.example .env.production   # remplir les secrets (openssl rand …)
```
```bash
docker compose up -d --build
```

Remplir `DOMAIN` (ex. `app.licengo.fr`, enregistrement DNS A vers le serveur) : Caddy obtient alors le certificat Let's Encrypt automatiquement.

`docker-compose.yml` lance : PostgreSQL 16, la migration de schéma (job unique), l'application (image non-root), **Caddy** (HTTPS Let's Encrypt automatique), un **cron** (échéances à 6 h 15, relances à 17 h 30) et les **sauvegardes chiffrées** nocturnes. Healthcheck : `GET /api/health`.

Phase 2 (100+ clubs) : Scaleway Serverless Containers (autoscaling) + Managed PostgreSQL (haute disponibilité, sauvegardes PITR) + Object Storage (offre HDS pour les documents) + Secret Manager ; mêmes images Docker, aucun changement de code hormis le pilote de stockage S3.

### Recette de la pile de production (validée)

La pile complète a été construite et exécutée telle quelle (`DOMAIN=localhost`) :
- image applicative **distroless non-root** de 88 Mo, construite sans gestionnaire de paquets ;
- job de migration : les 2 migrations Prisma sont appliquées ;
- application *healthy* ; HTTPS HTTP/2 via Caddy, redirection 308 de HTTP vers HTTPS, en-têtes HSTS et CSP présents ;
- **scénario E2E complet (19 étapes) réussi sur `https://localhost`** ;
- planificateur : `installments` et `reminders` répondent 200 ;
- sauvegarde chiffrée GPG produite, **restauration testée** dans une base temporaire (mêmes volumes de données que la base de production) ;
- documents illisibles sur le volume (AES-256-GCM).

Démo : `docker compose run --rm migrate pnpm --filter @licengo/web db:seed`. Restauration : `gpg -d db-….dump.gpg > r.dump && pg_restore -d licengo r.dump`.
Derrière un proxy d'entreprise qui intercepte TLS, ajouter `--secret id=ca,src=ca.pem` au `docker build` (le certificat n'est jamais copié dans l'image).

## 2. Stripe Connect

1. Créer le compte plateforme LICENGO (entité française), activer **Connect** en mode **Express**, renseigner l'image de marque.
2. Variables : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
3. Webhook `https://app.licengo.fr/api/webhooks/stripe` — événements : `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `charge.refunded`, `charge.dispute.created` (cocher « événements des comptes connectés » pour `account.updated`).
4. Chaque club clique « Activer les paiements » (`/club/parametres`) → onboarding Stripe (IBAN, statuts d'association, représentant) → `stripeChargesEnabled` passe à vrai via le webhook.
5. Tester en mode test avec les cartes Stripe, puis basculer les clés live.

Flux d'argent : 154,99 € débités → 150 € transférés automatiquement au club, 4,99 € conservés par LICENGO (`application_fee_amount`) ; les frais Stripe sont prélevés sur le compte plateforme (à intégrer dans le calcul du prix des frais de service).

## 3. Emails et notifications

- `BREVO_API_KEY`, `MAIL_FROM` (domaine authentifié SPF/DKIM/DMARC).
- `EXPO_PUSH_ENABLED=1` (push iOS/Android via Expo, gratuit).

## 4. Publication App Store et Google Play

Prérequis : compte Apple Developer (99 $/an, au nom de la société), compte Google Play Console (25 $ une fois), projet EAS (`eas init`, remplacer `projectId` dans `apps/mobile/app.json`).

```bash
cd apps/mobile && npx eas-cli build --platform all --profile production
```
```bash
npx eas-cli submit --platform all --profile production
```

Checklist de revue :
- Icône 1024 px (`assets/icon.png`), captures iPhone 6,7"/6,5" et Android (voir `docs/ecrans`).
- **Compte de démonstration** fourni aux équipes de revue (famille avec un enfant et un club actif).
- Apple « Confidentialité de l'app » et Google « Sécurité des données » : données d'identité, de contact, documents, santé (attestation), paiements via Stripe ; aucune donnée utilisée pour le suivi publicitaire.
- Suppression de compte accessible depuis l'app (écran Compte → espace web → « Supprimer mon compte ») — exigence Apple 5.1.1(v) et Google.
- Paiements : licences et articles physiques → paiement externe Stripe autorisé (biens/services consommés hors de l'app, règle 3.1.3(e) / 3.1.5).
- Permissions justifiées en français (caméra, photos, notifications) — déjà dans `app.json`.
- Classification d'âge : 4+ / Tout public ; app destinée aux parents (pas aux enfants).

## 5. Exploitation

- CI GitHub Actions (`.github/workflows/ci.yml`) : typecheck, tests unitaires, intégration PostgreSQL, build, E2E.
- Surveillance : Sentry (erreurs web + mobile), uptime sur `/api/health`, alerte si la tâche d'échéances échoue.
- Restauration testée chaque trimestre à partir des sauvegardes chiffrées.
