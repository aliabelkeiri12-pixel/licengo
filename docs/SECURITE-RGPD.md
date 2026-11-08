# Sécurité et conformité RGPD

LICENGO traite des données de **mineurs**, des **pièces d'identité** et des **données de santé** (certificat médical, art. 9 RGPD). Ce sont les catégories les plus sensibles : la protection est appliquée dès la conception.

## Mesures techniques implémentées

| Domaine | Mesure | Où |
|---|---|---|
| Authentification | Mots de passe bcrypt (coût 12), politique 10 caractères + complexité, verrouillage 15 min après 5 échecs, limitation de débit par IP, réponse identique compte existant/inexistant | `server/auth.ts`, `actions/password.ts` |
| Sessions | Jetons opaques 256 bits, **seul le SHA-256 est stocké**, cookie `HttpOnly` `Secure` `SameSite=Lax`, révocation de toutes les sessions au changement de mot de passe et depuis le back-office | `server/auth.ts` |
| Mobile | Jeton dans le trousseau iOS / Keystore Android (`expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`) | `apps/mobile/src/api.ts` |
| CSRF | Server actions (vérification d'origine native) ; l'API exige un en-tête `Authorization: Bearer` pour toute écriture | `lib/api.ts` |
| Contrôle d'accès | Rôles FAMILY / CLUB_STAFF (OWNER, SECRETARY, TREASURER, COACH en lecture seule) / ADMIN ; chaque service vérifie l'appartenance (famille du dossier, club du dossier) | `services/*`, `actions/club.ts` |
| Documents | Type réel vérifié par octets magiques (le MIME déclaré n'est jamais cru), 10 Mo max, **chiffrement AES-256-GCM** avant stockage, aucune URL publique, lecture uniquement via une route authentifiée `no-store`, **chaque consultation est journalisée**, l'administrateur LICENGO n'a pas accès aux pièces sensibles | `services/documents.ts`, `storage.ts` |
| Signatures | Signature électronique simple (eIDAS) : image manuscrite chiffrée + empreinte SHA-256 du texte signé, identité, horodatage, IP et user-agent | `services/registrations.ts` |
| Paiements | Aucune donnée de carte chez LICENGO (page hébergée Stripe, PCI-DSS SAQ-A), webhooks signés et idempotents | `payments/stripe.ts`, `api/webhooks/stripe` |
| En-têtes HTTP | HSTS preload, CSP stricte, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `next.config.ts` |
| Traçabilité | Journal d'audit (connexions, consultations de documents, décisions, remboursements, exports) | `AuditLog`, `/admin/audit` |
| Sauvegardes | Dump PostgreSQL + documents chiffrés GPG AES-256 chaque nuit, rétention 30 jours, copie vers une 2e région UE | `deploy/backup.sh` |
| Conteneur | Image non-root, healthcheck, secrets uniquement par variables d'environnement / coffre | `Dockerfile` |

## Conformité RGPD

- **Rôles** : chaque club est responsable de traitement pour ses licenciés ; LICENGO est sous-traitant (contrat art. 28 accepté à l'inscription du club) et responsable de traitement pour les comptes et paiements.
- **Minimisation** : seules les informations exigées par la licence sont demandées ; pour les mineurs, l'attestation de réponse négative au questionnaire de santé (QS-SPORT) remplace le certificat médical : **aucune réponse détaillée n'est collectée**.
- **Consentements** : CGU / confidentialité horodatées ; droit à l'image facultatif et révocable (acceptation ou refus signé) ; marketing en opt-in.
- **Droits des personnes** : export JSON complet (accès + portabilité) et suppression du compte (anonymisation, effacement des documents) en libre-service ; les écritures comptables sont conservées 10 ans sous forme anonymisée (obligation légale).
- **Durées de conservation** (à automatiser via une tâche planifiée en phase 2) : dossier = saison + 1 an ; pièces sensibles = 12 mois après la fin de la licence ; journaux d'audit = 1 an ; paiements = 10 ans.
- **Hébergement** : Union européenne exclusivement (France) ; sous-traitants : hébergeur, Stripe (UE), Brevo (FR), Expo (push, contenu non sensible).

## À faire avant la mise en production

1. **Analyse d'impact (AIPD)** : obligatoire ici (données de santé + mineurs à grande échelle). Modèle CNIL / outil PIA.
2. **Hébergement de données de santé (HDS)** : l'hébergement de certificats médicaux pour le compte de tiers peut relever de la certification HDS (art. L.1111-8 du Code de la santé publique). Recommandation prudente : placer le bucket de documents chez un hébergeur **certifié HDS** (Scaleway, OVHcloud, Outscale proposent des offres HDS) et faire valider la qualification par un avocat ou DPO.
3. Désigner un **DPO** (recommandé) et tenir le **registre des traitements**.
4. **Test d'intrusion** externe avant ouverture, puis annuel ; programme de divulgation responsable.
5. Clé de chiffrement des documents en coffre (Scaleway Secret Manager / KMS) avec procédure de rotation (ré-chiffrement progressif, l'en-tête du blob pouvant porter une version de clé).
6. Authentification à deux facteurs pour les comptes club et admin (TOTP) — prévue en phase 2.
