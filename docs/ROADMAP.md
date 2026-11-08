# Feuille de route

## Livré (MVP)

Espace famille complet (compte, enfants, recherche de clubs, inscription, documents par photo, signatures, questionnaire de santé, paiement 1–4×, notifications, renouvellement, export/suppression RGPD), espace club (tableau de bord, dossiers avec contrôle automatique, décisions motivées, relances, licenciés + export, paiements/impayés/remboursements, catégories et tarifs, boutique/stocks/fournisseurs/commandes, équipe et rôles, Stripe Connect), back-office (clubs, utilisateurs, offres et commissions, transactions, remboursements, commandes, audit), app mobile iOS/Android, API v1, tests et déploiement.

## Phase 1 — Pilote (10 clubs de football, saison en cours)
- Mise en production Stripe live, AIPD, hébergement HDS des documents, test d'intrusion.
- Accompagnement des secrétaires, mesure du temps gagné et du taux de dossiers complets.
- Publication TestFlight / test interne Google Play, puis stores.

## Phase 2 — 100 clubs
- Pass'Sport et Coupons Sport ANCV comme moyens de paiement.
- 2FA clubs/admin, purge automatique selon les durées de conservation, Sentry.
- Exports au format d'import fédéral, rapprochement des numéros de licence ; démarche de partenariat FFF.
- Ouverture **basket** et **handball** (règles déjà paramétrées), offres multi-sections (clubs omnisports).
- Messagerie club → familles par catégorie, convocations, liste d'attente automatique.
- Boutique : photos produits, flocage avancé, commandes groupées fournisseur, livraison à domicile.

## Phase 3 — 1 000 clubs
- Autoscaling, file de tâches, réplica de lecture, CDN ; support client et base de connaissances.
- Rugby, volley, tennis, judo, et autres sports ; ligues et districts (tableaux de bord territoriaux).
- Facturation des abonnements clubs via Stripe Billing, comptabilité exportable (FEC).
- Programme partenaires équipementiers (commission boutique), marketplace de fournisseurs.
