# Architecture technique

## Vue d'ensemble

```
 App iOS/Android (Expo)  ──HTTPS Bearer──┐
 Navigateur famille (PWA) ─┐             │
 Navigateur club / admin ──┼─cookie──►  Next.js (web + API v1 + server actions)
                           │                │        │          │
                           │          PostgreSQL  Stockage   Stripe Connect
                           │          (Prisma)    objet UE   (paiements, KYC clubs)
                           │                      chiffré    │
                           └──────────── Expo Push (APNs/FCM) · Brevo (emails) · Cron (échéances, relances)
```

Un **monolithe modulaire** TypeScript : une seule base de code serveur (Next.js) sert les écrans web et l'API mobile ; la logique métier sans dépendance (`packages/core`) est partagée avec l'app mobile, si bien qu'un échéancier affiché sur le téléphone est calculé par le même code que celui qui débite la carte.

## Choix technologiques et justification

| Besoin | Choix | Pourquoi (économique · sûr · évolutif) |
|---|---|---|
| Web clubs + admin + PWA famille | **Next.js 15 / React 19**, rendu serveur, server actions | Un seul déploiement pour 3 espaces ; pas d'API à dupliquer pour le web ; protection CSRF native des server actions ; SEO des pages clubs. |
| App iPhone / Android | **Expo (React Native)** + EAS Build | Une base de code pour les 2 stores, mises à jour OTA, push gratuits via Expo ; même langage que le web → une seule équipe. |
| Base de données | **PostgreSQL 16 + Prisma** | Transactions ACID (paiements, stocks), index géographiques simples, JSON pour règles par sport ; hébergeable en managé en France (Scaleway, OVHcloud). |
| Paiements | **Stripe Connect Express**, *destination charges* + `application_fee_amount` | Le club reçoit directement 150 €, LICENGO garde 4,99 € sans rapprochement manuel ; KYC/IBAN des associations gérés par Stripe ; 3-D Secure ; LICENGO hors périmètre PCI (page de paiement hébergée). |
| Paiement 2×/3×/4× | Carte enregistrée (`setup_future_usage=off_session`) + échéancier en base + tâche quotidienne | Coût Stripe standard (pas de frais BNPL), échéances maîtrisées (relances, 3 tentatives, impayés visibles côté club). |
| Documents | Chiffrement applicatif **AES-256-GCM** puis stockage objet UE | Même un accès au bucket ne révèle rien ; clé dans un coffre (Secret Manager). |
| Notifications | In-app (base) + **Expo Push** + email **Brevo** | Gratuit / très faible coût, prestataire email français. |
| Validation | **zod** partagé | Mêmes règles côté formulaire mobile, web et serveur. |

## Modules métier (`apps/web/src/server/services`)

- `registrations.ts` : création (prix + frais du plan), **moteur de complétude** (`@licengo/core/completeness`) qui détecte pièces manquantes, documents refusés/expirés, âge incompatible avec la catégorie, genre, téléphone du responsable ; statuts automatiques ; décisions club avec motif ; historique ; relances automatiques ; renouvellement annuel.
- `documents.ts` : contrôle du vrai type de fichier (octets magiques), chiffrement, remplacement, droits de lecture (famille, staff du club concerné ; jamais l'admin pour les pièces sensibles), audit de chaque consultation.
- `payments.ts` : échéancier, encaissement, prélèvements différés idempotents (verrou optimiste), impayés + 3 tentatives, remboursements partiels/totaux (part club d'abord, *reverse transfer*), paiement boutique.
- `shop.ts` : panier, commande par club, **réservation de stock atomique** (`UPDATE … WHERE stock >= qty`), commission plateforme, statuts de commande, alertes de stock bas.
- `clubs.ts` : recherche par sport / ville / code postal / rayon (géocodage API officielle geo.api.gouv.fr + boîte englobante indexée + haversine).
- `stats.ts` : statistiques club et plateforme.

## Multisport

`packages/core/src/sports.ts` décrit chaque sport (fédération, logiciel fédéral, règles documentaires, validité du certificat, mois de début de saison). Activer le basket = passer `active: true` (et en base) et, si besoin, ajuster ses règles : le moteur d'inscription, la complétude et les catégories sont génériques.

## Montée en charge

| Phase | Clubs / licenciés | Infrastructure | Coût mensuel indicatif |
|---|---|---|---|
| 1 | 10 clubs · ~2 000 | 1 VM (docker-compose : app, Postgres, Caddy, cron, sauvegardes) | ~30–60 € |
| 2 | 100 clubs · ~20 000 | 2 conteneurs app (Scaleway Serverless Containers) + PostgreSQL managé (HA) + Object Storage + Redis (rate limit) | ~150–300 € |
| 3 | 1 000 clubs · ~200 000 | Autoscaling, réplica de lecture pour les stats, file de tâches (échéances, emails), CDN, observabilité (Sentry, Grafana) | ~800–2 000 € |

Points prévus pour la phase 2–3 : le limiteur de débit en mémoire (`ratelimit.ts`) se remplace par Redis (même interface) ; le pilote de stockage local se remplace par un pilote S3 (interface `StorageDriver`) ; les tâches cron deviennent des jobs en file ; les pics de rentrée (juillet–septembre) justifient l'autoscaling.

## Modèle de données (extrait)

`User` (rôle FAMILY / CLUB_STAFF / ADMIN) — `Family` 1-n `Child` — `Club` (sport, plan, compte Stripe) 1-n `Category` (saison, années de naissance, prix, places, échéances max) — `Registration` (enfant × club × saison, statut, statut de paiement, résumé des manques) 1-n `Document`, `Signature`, `Payment` 1-n `Installment`, `Refund` — `Product` 1-n `ProductVariant` (taille, stock) — `ShopOrder` 1-n `ShopOrderItem` — `Notification`, `PushToken`, `AuditLog`, `WebhookEvent`, `PasswordResetToken`. Schéma complet : `apps/web/prisma/schema.prisma`.
