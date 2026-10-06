# SkyBoard

Pilote l'affichage de tes kneeboards dans le casque VR (DCS World + OpenKneeboard) depuis un iPad.

- **Viewer** (`/viewer/[token]`) : page affichée dans l'onglet *Web Dashboard* d'OpenKneeboard.
- **Remote** (`/remote`) : télécommande tactile sur iPad (mode préparation + mode vol à l'aveugle).
- La synchro passe par Supabase Realtime (Broadcast). Seul un **état** (document, page, zoom, pan) circule, jamais de vidéo.

Stack : Next.js 16 (App Router) · TypeScript strict · Tailwind 4 · Supabase (Auth, Storage, Postgres, Realtime) · pdf.js · Vitest.

> État : **phase 1** (setup, auth, migrations). Les sections marquées *(à venir)* seront complétées au fil des phases.

---

## 1. Créer le projet Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) (le plan gratuit suffit).
2. Applique les migrations du dossier `supabase/migrations`, au choix :
   - **SQL Editor** : colle et exécute chaque fichier `.sql`, dans l'ordre des noms ;
   - **CLI** :
     ```bash
     npx supabase login
     npx supabase init          # crée supabase/config.toml si absent (les migrations sont conservées)
     npx supabase link --project-ref <ref-du-projet>
     npx supabase db push
     ```
   Les migrations créent les tables `cockpits` et `documents`, la RLS, et le bucket privé `kneeboards` (50 Mo max, PDF/PNG/JPEG).
3. **Authentication → Sign In / Providers → Email** : laisse « Email » activé.
   - Pour un usage perso, tu peux désactiver *Confirm email* : le compte est alors utilisable immédiatement.
   - Si tu gardes la confirmation, va dans **Authentication → Emails → Confirm signup** et remplace le lien du template par :
     ```html
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmer mon email</a>
     ```
     Le lien fonctionne alors depuis n'importe quel appareil.
4. **Authentication → URL Configuration** : mets *Site URL* à l'URL de ton déploiement (ou `http://localhost:3000` en local). Ajoute aussi les deux dans *Redirect URLs*.

## 2. Variables d'environnement

Copie `.env.example` en `.env.local` et remplis-le (Supabase → **Project Settings → API Keys**) :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (*publishable* ou ancienne *anon*) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète (*secret* ou ancienne *service_role*). **Serveur uniquement.** |
| `NEXT_PUBLIC_SITE_URL` | Optionnel : URL publique pour les liens d'email |

La clé secrète n'est lue que dans `src/lib/supabase/admin.ts`, qui importe `server-only` : le build échoue si ce module est importé côté client.

## 3. Lancer en local

Prérequis : Node.js ≥ 20.9.

```bash
npm install
npm run dev          # http://localhost:3000
```

Vérifications :

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 4. Déployer sur Vercel *(détaillé en phase 6)*

1. Importe le dépôt dans Vercel (framework détecté : Next.js).
2. Ajoute les variables d'environnement de la section 2 (Production + Preview).
3. Déploie, puis reporte l'URL dans Supabase (*Site URL* / *Redirect URLs*).

## 5. Configurer OpenKneeboard *(à venir — phase 3)*

## 6. Tester hors VR *(à venir)*

---

## Structure

```
src/
  app/
    (auth)/        connexion, inscription, server actions d'auth
    (app)/         pages protégées : documents, cockpits, remote
    auth/confirm/  lien de confirmation d'email
  lib/
    supabase/      clients navigateur / serveur / admin (service_role) / proxy
    database.types.ts
  proxy.ts         rafraîchissement de session + protection des routes
supabase/migrations/   schéma SQL, RLS, Storage
```

## Sécurité (résumé)

- RLS sur toutes les tables et sur le bucket. Chaque utilisateur ne voit que ses lignes et son dossier `<user_id>/`.
- Le token viewer est généré par la base (32 octets aléatoires, base64url). Le client ne peut ni le choisir ni le modifier : privilèges par colonne. Seule la fonction `regenerate_viewer_token` peut le changer, après avoir vérifié le propriétaire.
- Les chemins Storage d'un document doivent commencer par l'id de son propriétaire (contrainte `CHECK`). Le viewer, qui signe les URLs avec la clé service_role, ne peut donc jamais exposer le fichier d'un autre utilisateur.
