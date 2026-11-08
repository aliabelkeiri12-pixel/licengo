# Intégration avec la FFF, Footclubs et les autres fédérations

## Constat

La licence fédérale reste délivrée par la fédération via son outil (pour le football : **Footclubs**, utilisé par les clubs, avec le parcours de **licence dématérialisée** où la famille complète son dossier via un lien envoyé par le club). À notre connaissance, il n'existe pas d'API publique ouverte aux éditeurs tiers pour créer des licences ; tout accès automatisé doit passer par un **accord avec la fédération**. Les points ci-dessous sont à confirmer directement auprès des services concernés.

## Stratégie en 3 niveaux

| Niveau | Description | Statut |
|---|---|---|
| 1. Sans intégration | LICENGO collecte, contrôle et encaisse ; le secrétaire saisit ou importe dans l'outil fédéral. **Export CSV** des licenciés validés (identité, naissance, catégorie, responsable, droit à l'image) prêt pour la saisie/import ; champ « N° de licence fédérale » renseigné en retour. | ✅ Implémenté (`/club/licencies`, `/api/club/export`) |
| 2. Intégration assistée | Formats d'export alignés sur les gabarits d'import de chaque fédération ; liens profonds vers le dossier fédéral ; rapprochement automatique des numéros de licence. | Phase 2 |
| 3. Partenariat officiel | Convention avec la fédération (partenaire / prestataire référencé) donnant accès à une API ou à des échanges de fichiers sécurisés (création de demande de licence, retour du numéro, statut). | Démarche commerciale & juridique |

**Ce que nous ne ferons pas** : automatiser l'interface web d'un outil fédéral (robot / scraping) : contraire aux conditions d'utilisation et fragile.

## Démarche recommandée auprès de la FFF

1. Pilote avec 5 à 10 clubs d'un même district pour mesurer le temps gagné par les secrétaires (indicateur clé du dossier).
2. Rencontre avec la **Ligue régionale / le District** (relais des clubs) puis la direction des systèmes d'information de la FFF.
3. Proposer LICENGO comme **outil complémentaire** (paiement échelonné, boutique, relances), en respectant le périmètre fédéral (la licence reste délivrée par Footclubs).
4. Sécurité et RGPD : présenter l'AIPD, l'hébergement UE/HDS, le chiffrement des pièces.

## Autres fédérations (déjà paramétrées dans `packages/core/src/sports.ts`)

| Sport | Fédération | Outil fédéral (indicatif) | Particularités à intégrer |
|---|---|---|---|
| Basketball | FFBB | FBI / e-Licence | Licence dématérialisée, surclassements |
| Handball | FFHandball | Gest'hand | Validation par la ligue |
| Rugby | FFR | Oval-e | Certificat médical renforcé, règles mineurs spécifiques (paramétré : certificat annuel) |
| Volley-ball | FFVolley | — | — |
| Tennis | FFT | ADOC / Ten'Up | Saison démarrant en septembre (paramétré) |
| Judo | FFJDA | Extranet fédéral | Passeport sportif, grades |

## Aides financières (feuille de route)

**Pass'Sport** (aide de l'État par enfant éligible) et **Coupons Sport / Chèques-Vacances ANCV** : à intégrer comme moyens de paiement partiels (déduction sur le reste à payer, justificatif contrôlé par le club) — forte valeur pour les familles et les clubs.
