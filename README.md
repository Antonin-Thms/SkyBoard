# SkyBoard

Pilote l'affichage de tes kneeboards dans le casque VR (DCS World + OpenKneeboard) depuis un iPad.

- **Viewer** (`/viewer/[token]`) : page affichée dans l'onglet *Web Dashboard* d'OpenKneeboard.
- **Remote** (`/remote`) : télécommande tactile sur iPad (mode préparation + mode vol à l'aveugle).
- La synchro passe par Supabase Realtime (Broadcast). Seul un **état** (document, page, zoom, pan) circule, jamais de vidéo.

Stack : Next.js 16 (App Router) · TypeScript strict · Tailwind 4 · Supabase (Auth, Storage, Postgres, Realtime) · pdf.js · Vitest.

> État : **phase 3** (setup, auth, migrations, documents, cockpits, viewer statique). Les sections marquées *(à venir)* seront complétées au fil des phases.

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
   **À chaque nouvelle phase**, exécute les nouveaux fichiers de migration (ceux que tu n'as pas encore appliqués).
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
| `VIEWER_CHANNEL_SECRET` | Secret serveur (≥ 32 caractères) qui dérive le nom du canal Realtime de chaque cockpit. **Serveur uniquement.** |
| `NEXT_PUBLIC_SITE_URL` | Optionnel : URL publique pour les liens d'email |

Génère `VIEWER_CHANNEL_SECRET` avec :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

La clé secrète n'est lue que dans `src/lib/supabase/admin.ts`, qui importe `server-only` : le build échoue si ce module est importé côté client.

## 3. Lancer en local

Prérequis : Node.js ≥ 20.9.

```bash
npm ci               # installe les versions exactes du package-lock.json
npm run dev          # http://localhost:3000
```

Vérifications :

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

### Mise à jour du code

```bash
git restore package-lock.json   # au cas où un « npm install » l'aurait modifié
git pull
npm ci
npm run dev
```

Utilise `npm ci` plutôt que `npm install` : il ne réécrit pas `package-lock.json` (une version de npm différente peut le modifier et bloquer ensuite `git pull`).

## 4. Déployer sur Vercel *(détaillé en phase 6)*

1. Importe le dépôt dans Vercel (framework détecté : Next.js).
2. Ajoute les variables d'environnement de la section 2 (Production + Preview).
3. Déploie, puis reporte l'URL dans Supabase (*Site URL* / *Redirect URLs*).

## 5. Configurer OpenKneeboard

1. Dans SkyBoard, page **Cockpits** :
   - crée un cockpit (par ex. « F-16C ») ;
   - coche les options voulues ;
   - clique sur **Copier**.
2. Dans OpenKneeboard :
   - ouvre les réglages, section des onglets (*Tabs*) ;
   - ajoute un onglet de type **Web Dashboard** ;
   - colle l'URL.
3. Dans les réglages de l'onglet, choisis une taille proche du ratio de tes kneeboards (par ex. 768 × 1024 pour du portrait A4/Letter). Pour l'option `?transparent=1`, active aussi la transparence de l'onglet si OpenKneeboard la propose.

Options de l'URL viewer :

| Paramètre | Effet |
| --- | --- |
| `?transparent=1` | `html` et `body` transparents (rien n'est dessiné autour de la page) |
| `?status=0` | masque l'indicateur de connexion (point en bas à droite) |
| `?cursor=1` | autorise l'affichage du curseur envoyé par la remote *(phase 5)* |

Le viewer ne demande aucune interaction : il charge la liste des documents et affiche le dernier document et la dernière page connus. Il renouvelle aussi seul les URLs signées, qui expirent au bout d'1 h.

**Garde l'URL secrète** : elle donne accès en lecture à tes documents. En cas de fuite, clique sur **Régénérer le token** : l'ancienne URL cesse immédiatement de fonctionner.

## 6. Tester hors VR

- **Viewer** : ouvre l'URL du cockpit dans un onglet du navigateur sur PC (bouton **Ouvrir**).
  - En test uniquement, les flèches **← →** changent de page et **↑ ↓** changent de document.
  - **H** affiche une aide (document et page courants, touches, indicateur, options d'URL).
  - Pour vérifier l'ajustement, sors la fenêtre du plein écran (bouton « Restaurer ») et tire sur ses bords.
- **Remote** *(phases 4-5)* : sur iPad, ou dans les DevTools de Chrome/Edge en mode appareil (Ctrl+Shift+M), avec un iPad en émulation tactile.

---

## Structure

```
src/
  app/
    (auth)/        connexion, inscription, server actions d'auth
    (app)/         pages protégées : documents, cockpits, remote
    auth/confirm/  lien de confirmation d'email
    viewer/[token] page viewer (OpenKneeboard), sans compte
    api/viewer/[token]  validation du token (service_role) + URLs signées
  components/
    documents/     upload, grille triable, carte document
    cockpits/      création, URL viewer, régénération du token
    viewer/        rendu de page (canvas), indicateur de statut
  lib/
    documents/     vérification des fichiers, analyse (pages, miniature), upload
    sync/          protocole d'état (ViewState) et nom du canal Realtime
    viewer/        calcul d'ajustement, cache des documents chargés
    pdf/           chargement de pdf.js (build legacy, worker dans public/pdfjs/)
    supabase/      clients navigateur / serveur / admin (service_role) / proxy
    database.types.ts
  proxy.ts         rafraîchissement de session + protection des routes
supabase/migrations/   schéma SQL, RLS, Storage
```

## Documents

- Les fichiers partent **directement du navigateur vers Supabase Storage** : les fonctions Vercel limitent le corps des requêtes à 4,5 Mo.
- Avant l'envoi, le navigateur :
  - vérifie la taille (50 Mo max) et le type réel du fichier (signature binaire, pas l'extension) ;
  - compte les pages avec pdf.js ;
  - génère une miniature WebP (JPEG sur les anciens Safari).
- Le bucket refuse de son côté tout fichier trop gros ou d'un type non autorisé.
- Arborescence : `<user_id>/<uuid>.pdf|png|jpg` et `<user_id>/<uuid>.thumb.webp`.
- Le worker pdf.js est copié de `node_modules` vers `public/pdfjs/` avant `dev` et `build` (`scripts/copy-pdf-worker.mjs`). C'est le build *legacy* : le build moderne exige des API JS trop récentes pour WebView2 et Safari.

## Sécurité (résumé)

- RLS sur toutes les tables et sur le bucket. Chaque utilisateur ne voit que ses lignes et son dossier `<user_id>/`.
- Le token viewer est généré par la base (32 octets aléatoires, base64url). Le client ne peut ni le choisir ni le modifier : privilèges par colonne. Seule la fonction `regenerate_viewer_token` peut le changer, après avoir vérifié le propriétaire.
- La route `/api/viewer/[token]` est la seule à utiliser la clé service_role.
  - Elle renvoie une 404 identique pour un token mal formé ou inconnu.
  - Les URLs signées qu'elle fournit expirent au bout d'1 h.
  - Ses réponses sont en `Cache-Control: no-store`.
- La page viewer est en `referrer: no-referrer` (le token ne fuit pas dans l'en-tête Referer) et en `noindex`.
- Le canal Realtime d'un cockpit s'appelle `cockpit:<HMAC-SHA256(token, VIEWER_CHANNEL_SECRET)>`.
  - Ce nom est non devinable et ne révèle pas le token.
  - Il change quand on régénère le token.
- Les chemins Storage d'un document doivent commencer par l'id de son propriétaire (contrainte `CHECK`). Le viewer, qui signe les URLs avec la clé service_role, ne peut donc jamais exposer le fichier d'un autre utilisateur.
