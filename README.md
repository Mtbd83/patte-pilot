# Asso SaaS — Fondations

Brique 1 du SaaS de gestion d'association : multi-organisation, rôles cumulables, invitations par email.

## Modèle de données

- `organizations` : une association cliente de la plateforme.
- `users` : un compte utilisateur global (peut appartenir à plusieurs organisations).
- `organization_members` : le lien user ↔ organisation (une ligne par couple).
- `organization_member_roles` : les rôles portés par ce membre (`admin`, `benevole`, `famille_accueil`), plusieurs lignes possibles → cumul de rôles.
- `invitations` : invitation en attente/acceptée/révoquée/expirée, avec token unique et rôles pré-assignés.

Ce découpage (membre séparé des rôles) permet à un même bénévole d'être **admin + famille d'accueil** dans une asso, et simple **bénévole** dans une autre, sans dupliquer son compte.

## Sécurité

- Toute la logique d'autorisation vit côté serveur (`src/lib/permissions.ts`). Aucune route/action ne fait confiance à un rôle envoyé par le client.
- `requireRole` / `requireAdmin` lèvent une `ForbiddenError` explicite, à appeler en première ligne de chaque server action.
- Les invitations sont liées à une adresse email précise : l'acceptation vérifie que l'utilisateur connecté correspond à l'email invité.
- Tokens d'invitation aléatoires (32 octets), expiration à 7 jours.
- Mots de passe hashés avec bcrypt, jamais stockés en clair.

## Démarrer

```bash
cp .env.example .env.local   # renseigner DATABASE_URL, AUTH_SECRET, SMTP_*
npm install
npm run db:generate          # génère la migration SQL depuis le schéma
npm run db:migrate
npm run dev
```

## Tests

```bash
npm test          # unitaires + intégration (Jest) — nécessite DATABASE_URL sur une base de test
npm run test:e2e  # Playwright, nécessite l'app lancée (webServer auto-démarré)
```

La CI GitHub Actions (`.github/workflows/ci.yml`) lance lint → migrations → tests → build → E2E sur chaque PR.

## Prochaine brique

Suggestion : **gestion des animaux + familles d'accueil** (fiches animal, checklist santé, statuts, liaison FA), qui viendra s'accrocher à `organizationMembers` pour les FA ayant un compte.
