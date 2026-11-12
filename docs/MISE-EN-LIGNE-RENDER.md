# Mettre LICENGO en ligne en quelques clics (Render)

Render lit directement ce dépôt GitHub, construit l'application, crée la base PostgreSQL, le disque des documents et la tâche planifiée quotidienne (fichier `render.yaml`). Région : Francfort (Union européenne). Coût indicatif : ~7 $/mois l'application + ~6 $/mois la base + ~1 $/mois le disque + ~1 $/mois la tâche planifiée.

1. Créez un compte sur **https://render.com** avec « Sign up with GitHub » (compte `aliabelkeiri12-pixel`), puis ajoutez une carte bancaire (Billing).
2. Menu **New → Blueprint**, autorisez l'accès au dépôt **licengo**, sélectionnez-le.
3. Render affiche les ressources à créer et demande 2 valeurs :
   - `ADMIN_EMAIL` : votre email d'administrateur LICENGO ;
   - `ADMIN_PASSWORD` : un mot de passe d'au moins 12 caractères (à taper uniquement dans Render).
   Laissez `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` vides pour l'instant (paiements simulés).
4. Cliquez **Apply**. Après 5 à 10 minutes, l'adresse du site s'affiche (ex. `https://licengo.onrender.com`).
5. Connectez-vous sur `/connexion` avec votre email et mot de passe administrateur.

Données de démonstration : `DEMO_DATA=1` charge les 12 clubs de démo au premier démarrage (comptes `famille.martin@exemple.fr` et `secretariat@fclyonest.fr`, mot de passe public `Licengo2026!` ; le compte admin de démo est supprimé automatiquement). **Avant l'ouverture au public**, supprimez ces comptes de démo depuis le back-office ou repartez d'une base vide avec `DEMO_DATA=0`.

Nom de domaine : dans Render, service `licengo` → Settings → Custom Domains → ajoutez `app.votre-domaine.fr`, puis créez chez votre registraire l'enregistrement DNS indiqué ; le certificat HTTPS est automatique.

Paiements réels : renseignez `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` dans Render → Environment (voir `docs/DEPLOIEMENT.md`, section Stripe Connect), webhook vers `https://<votre-site>/api/webhooks/stripe`.

Testé : l'image `Dockerfile.render` démarre sur une base vide (migrations, offres, sports, administrateur), redémarre sans dupliquer les données, et la tâche planifiée répond 200.

## Emails (reçus de paiement)

À chaque paiement (licence, chaque échéance, boutique), un reçu détaillé est envoyé à l'email du compte payeur, y compris pour les paiements de démonstration. Envoi par **Brevo** (gratuit jusqu'à 300 emails/jour) :

1. Créez un compte gratuit sur **brevo.com**.
2. Menu **Senders, Domains & Dedicated IPs → Senders → Add a sender** : ajoutez votre adresse email et validez-la via le lien reçu.
3. Menu **SMTP & API → API Keys → Generate a new API key** : copiez la clé (commence par `xkeysib-`).
4. Dans Render, service `licengo-demo` → **Environment** → ajoutez `BREVO_API_KEY` (la clé) et `MAIL_FROM` (l'adresse validée à l'étape 2), puis **Save changes**.

Sans ces deux valeurs, le site fonctionne mais les emails ne sont pas envoyés.
