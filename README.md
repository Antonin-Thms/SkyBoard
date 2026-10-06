# SkyBoard

Pilote l'affichage de tes kneeboards dans le casque VR (DCS World + OpenKneeboard) depuis une tablette ou un téléphone (tout écran tactile).

- **Viewer** (`/viewer/[token]`) : page affichée dans l'onglet *Web Dashboard* d'OpenKneeboard.
- **Remote** (`/remote`) : télécommande tactile sur tablette ou téléphone (mode préparation + mode vol à l'aveugle).
- La synchro passe par Supabase Realtime (Broadcast). Seul un **état** (document, page, zoom, pan) circule, jamais de vidéo.

Stack : Next.js 16 (App Router) · TypeScript strict · Tailwind 4 · Supabase (Auth, Storage, Postgres, Realtime) · pdf.js · Vitest.

Fonctionnalités :
- comptes ;
- documents PDF, PNG et JPG ;
- cockpits à URL secrète ;
- viewer sans compte ;
- synchro temps réel ;
- mode vol à gestes à l'aveugle ;
- zoom et déplacement lissés, rendu net à tout zoom ;
- cache hors ligne ;
- remote installable en PWA.

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
   **Après une mise à jour du code**, exécute les nouveaux fichiers de migration (ceux que tu n'as pas encore appliqués).
3. **Authentication → Sign In / Providers → Email** : laisse « Email » activé.
   - Pour un usage perso, tu peux désactiver *Confirm email* : le compte est alors utilisable immédiatement.
   - Si tu gardes la confirmation, va dans **Authentication → Emails → Confirm signup** et remplace le lien du template par :
     ```html
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmer mon email</a>
     ```
     Le lien fonctionne alors depuis n'importe quel appareil.
4. **Realtime → Settings** : laisse l'accès public aux canaux autorisé. L'option qui réserve Realtime aux canaux privés doit rester **désactivée**, car le viewer est anonyme. Aucune table n'a besoin d'être « répliquée » : tout passe par Broadcast.
5. **Authentication → URL Configuration** : mets *Site URL* à l'URL de ton déploiement (ou `http://localhost:3000` en local). Ajoute aussi les deux dans *Redirect URLs*.

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

## 4. Déployer sur Vercel

1. Pousse le dépôt sur GitHub, puis sur [vercel.com](https://vercel.com) : **Add New → Project** et importe le dépôt. Vercel détecte Next.js : laisse les réglages de build par défaut.
2. Avant de déployer, dans **Environment Variables**, ajoute les variables de la section 2, pour *Production* et *Preview* :
   - `NEXT_PUBLIC_SUPABASE_URL` ;
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ;
   - `SUPABASE_SERVICE_ROLE_KEY` ;
   - `VIEWER_CHANNEL_SECRET`.

   Utilise **la même valeur** de `VIEWER_CHANNEL_SECRET` partout où l'app tourne pour un même cockpit : le viewer et la remote doivent calculer le même nom de canal.
3. **Deploy**. Note l'URL obtenue, par exemple `https://skyboard-xxx.vercel.app`.
4. Dans Supabase, va dans **Authentication → URL Configuration** :
   - *Site URL* = l'URL Vercel ;
   - *Redirect URLs* : ajoute `https://skyboard-xxx.vercel.app/**` (et garde `http://localhost:3000/**` pour le développement).
5. Recrée ton compte ou connecte-toi sur l'URL Vercel. Recopie ensuite l'URL du viewer depuis la page **Cockpits** dans OpenKneeboard. L'URL `localhost` ne marche que sur le PC qui fait tourner `npm run dev`.

Chaque `git push` redéploie automatiquement. Les migrations SQL, elles, restent à appliquer à la main dans Supabase (section 1).

Une variable d'environnement modifiée dans Vercel ne s'applique qu'après un redéploiement (**Deployments → … → Redeploy**).

## 5. Ouvrir la remote sur une tablette ou un téléphone

### Par QR code (le plus rapide)

1. Sur le PC, ouvre la page **Remote** et choisis le cockpit.
2. Clique sur **Afficher le QR code**.
3. Scanne-le avec l'appareil photo de la tablette ou du téléphone : la remote s'ouvre directement en **mode vol** sur ce cockpit.

Avec l'option **Connexion automatique** (cochée par défaut), le QR code contient un jeton de connexion à **usage unique**. C'est un magic link Supabase, valable 1 h par défaut (réglage *Email OTP Expiration* dans Supabase). Il connecte l'appareil sans saisir de mot de passe.

Ne montre pas ce QR code. Il disparaît de l'écran au bout de 5 minutes. Décoche l'option pour un QR code sans jeton : l'appareil devra alors être déjà connecté.

Le QR code ouvre Safari, pas l'application installée. iOS ne permet pas d'ouvrir une PWA depuis un lien.

### Installer en application (PWA)

1. Ouvre l'URL Vercel sur la tablette ou le téléphone (Safari sur iOS, Chrome sur Android), puis connecte-toi.
2. Bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. L'icône SkyBoard ouvre directement la remote, en plein écran, sans barre Safari.

Une PWA iOS a son propre stockage : il faut s'y connecter une fois, même si tu l'étais déjà dans Safari.

En mode vol, le zoom et le défilement natifs sont désactivés. Si iOS affiche quand même son geste système (bord bas : barre d'accueil), active **Accès guidé** (Réglages → Accessibilité) pour verrouiller l'écran sur SkyBoard pendant le vol.

### Adaptation à l'appareil

La remote détecte le type d'appareil : téléphone, tablette ou ordinateur. Un iPad qui se présente comme un Mac est reconnu à ses points de contact tactiles.

- **Ordinateur** : affiche le panneau QR code.
- **Téléphone** :
  - mise en page resserrée (2 colonnes, barre de commandes collée en haut) ;
  - mode vol compact ;
  - bandes latérales et seuils de swipe réduits (`DEVICE_GESTURE_OVERRIDES` dans `src/lib/gestures/constants.ts`).

### Se souvenir de moi

- **Case cochée** (par défaut) : la session reste ouverte, avec des cookies de 400 jours rafraîchis automatiquement.
- **Case décochée** : la session se ferme avec le navigateur, car les cookies d'auth deviennent des cookies de session.

## 6. Configurer OpenKneeboard

1. Dans SkyBoard, page **Cockpits** :
   - crée un cockpit (par ex. « F-16C ») ;
   - clique sur **Copier**.
2. Dans OpenKneeboard (version 1.7 ou plus) :
   - ouvre les réglages (roue crantée en bas à gauche), puis **Tabs** ;
   - clique sur **+ Add a tab**, choisis **Web Dashboard** ;
   - colle l'URL.
3. Dans les réglages de l'onglet, choisis une taille proche du ratio de tes kneeboards (par ex. 768 × 1024 pour du portrait A4/Letter). Pour l'option `?transparent=1`, active aussi la transparence de l'onglet si OpenKneeboard la propose.

Options facultatives, à ajouter à la main à la fin de l'URL du viewer :

| Paramètre | Effet |
| --- | --- |
| `?transparent=1` | `html` et `body` transparents (rien n'est dessiné autour de la page) |
| `?status=0` | masque l'indicateur de connexion (point en bas à droite) |
| `?cursor=0` | n'affiche jamais le curseur (sinon il apparaît quand le bouton « Curseur » du mode vol est activé) |

Le viewer ne demande aucune interaction : il charge la liste des documents et affiche le dernier document et la dernière page connus. Il renouvelle aussi seul les URLs signées, qui expirent au bout d'1 h.

Si la connexion faiblit :
- l'affichage tient : les documents déjà chargés sont en cache dans le navigateur d'OpenKneeboard, et tous les documents y sont préchargés en arrière-plan ;
- l'indicateur passe à l'orange ;
- la reconnexion est automatique.

**Garde l'URL secrète** : elle donne accès en lecture à tes documents. En cas de fuite, clique sur **Régénérer le token** : l'ancienne URL cesse immédiatement de fonctionner.

## 7. Tester hors VR

- **Viewer** : ouvre l'URL du cockpit dans un onglet du navigateur sur PC (bouton **Ouvrir**).
  - En test uniquement, les flèches **← →** changent de page et **↑ ↓** changent de document.
  - **H** affiche une aide (document et page courants, touches, indicateur, options d'URL).
  - Pour vérifier l'ajustement, sors la fenêtre du plein écran (bouton « Restaurer ») et tire sur ses bords.
- **Remote** : ouvre `/remote` dans un autre onglet, ou sur la tablette / le téléphone (`http://<IP-du-PC>:3000/remote` sur le même Wi-Fi). Tu peux aussi utiliser les DevTools de Chrome/Edge en mode appareil (Ctrl+Shift+M) avec une tablette en émulation tactile.
  - Mode **Préparation** : tape une miniature, le viewer change immédiatement.
  - Mode **Vol** : dans les DevTools, active l'émulation tactile. Pour pincer sans écran tactile, Chrome simule un deuxième doigt avec **Maj + glisser** ; le plus fiable reste un vrai écran tactile.
  - Ferme puis rouvre le viewer : il reprend l'état courant, en le demandant à la remote si elle est ouverte, sinon depuis la base.

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
    viewer/        rendu de page (canvas), indicateur de statut, aide
    remote/        sélection du cockpit, mode préparation, mode vol (gestes)
  lib/
    documents/     vérification des fichiers, analyse (pages, miniature), upload
    gestures/      constantes, reconnaissance des gestes, calculs zoom/pan/bornes
    sync/          protocole (ViewState), séquences, canal Realtime, limitation de débit
    remote/        types et mémoire de page de la remote
    viewer/        ajustement, lissage, cache des documents chargés
    pdf/           chargement de pdf.js (build legacy, worker dans public/pdfjs/)
    supabase/      clients navigateur / serveur / admin (service_role) / proxy
    database.types.ts
  proxy.ts         rafraîchissement de session + protection des routes
supabase/migrations/   schéma SQL, RLS, Storage
```

## Synchronisation temps réel

- **Canal** : un canal Supabase Realtime **Broadcast** par cockpit (`cockpit:<HMAC>`), sans serveur WebSocket custom.
- **Message `state`** (remote → viewers) : `{ docId, page, zoom, panX, panY, seq, ts, cursor? }`.
  - `seq` est basé sur l'horloge et strictement croissant. Une remote rechargée repart donc au-dessus de ses anciens messages.
  - Le viewer ignore tout message plus ancien que le dernier appliqué.
  - Chaque message est validé à la réception : le canal est public pour qui connaît son nom.
- **Message `documents_changed`** (serveur → viewers et remotes) : la liste des documents a changé, la recharger.
- **Message `request_state`** (viewer → remotes) : envoyé à chaque (re)connexion du viewer. La remote répond avec l'état courant.
- **Persistance** : la remote écrit le dernier état dans `cockpits.last_state` 1 s après le dernier changement, et à la fermeture de la page. Un viewer qui démarre seul affiche cet état.
- **Reconnexion** : supabase-js reconnecte le socket et rejoint le canal automatiquement.
  - Un canal fermé de façon inattendue est recréé.
  - Le retour du réseau ou le retour au premier plan relancent la connexion immédiatement.
- **Mémoire de page** : chaque document reprend à sa dernière page vue (mémorisée sur l'appareil de la remote). Changer de page ou de document remet zoom et position à zéro.

## Mode vol : gestes

Tout l'écran reçoit les gestes, sans bouton au centre. Les gestes sont relatifs et utilisables n'importe où.

| Geste | Effet |
| --- | --- |
| Pincer à deux doigts | zoom centré sur le point entre les doigts (×1 à ×6) |
| Glisser à deux doigts | déplacer la page |
| Glisser à un doigt (page zoomée) | déplacer la page |
| Swipe horizontal à un doigt (zoom ×1) | ← document suivant · → document précédent |
| Double tap | zoom et position remis à zéro |
| Swipe vertical dans une bande latérale (bords gauche/droit) | ↓ page suivante · ↑ page précédente (PDF de plusieurs pages) |

- **Bornes** : le zoom va de ×1 à ×6, et le déplacement est limité pour que la page ne sorte jamais du champ.
- **Seuils** : tous dans `src/lib/gestures/constants.ts`.
  - Largeur des bandes, distances et durées de swipe et de tap, délai du double tap.
  - Zoom max, débit d'envoi (`SEND_INTERVAL_MS`, 33 ms ≈ 30 msg/s).
  - Douceur du lissage (`SMOOTHING_TAU_MS`).
- **Architecture** : la reconnaissance des gestes (`recognizer.ts`) et les calculs de zoom, déplacement et bornes (`transform.ts`) sont purs et testés unitairement.
- **Safari** : le zoom et le défilement natifs sont neutralisés.
  - `touch-action: none` sur la zone de gestes ;
  - viewport `user-scalable=no` ;
  - `preventDefault` sur `touchstart`, `touchmove` et `gesturestart`/`gesturechange` ;
  - `overscroll-behavior: none`.
- **Envoi** : pendant un geste, au plus 1 message toutes les 33 ms (en gardant toujours le dernier état), plus un envoi final garanti quand le dernier doigt se lève. Les commandes ponctuelles (page, document, double tap) partent immédiatement.
- **Curseur** : le bouton « Curseur » du mode vol envoie la position du doigt, et le viewer l'affiche (sauf si son URL contient `?cursor=0`).

### Modèle de vue

La page, ajustée à la fenêtre, est agrandie de `zoom` autour du centre de la fenêtre, puis décalée de `(panX, panY)`, en fraction de la taille de la page. Le point de la page au centre de la fenêtre est `(0.5 − panX, 0.5 − panY)`.

Remote et viewer peuvent donc avoir des écrans de tailles et de formats différents.

### Lissage dans le viewer

- **Interpolation** : à chaque image (`requestAnimationFrame`, avec un minuteur de secours), la vue affichée se rapproche exponentiellement de la vue cible.
  - Le zoom est interpolé en logarithme.
  - Le mouvement ne dépend pas du nombre d'images par seconde.
  - Il reste fluide même si les messages arrivent par à-coups.
- **Transformation** : elle est écrite directement dans le DOM, sans re-rendu React.
- **Changement de page ou de document** : la vue saute directement à la cible.

## Dossiers

- **Principe** : un document appartient à au plus un dossier, par exemple un par serveur multijoueur. Les documents sans dossier sont les **Communs**, comme tes checklists perso.
- **Dossier actif** : chaque cockpit en a un (`cockpits.active_folder_id`), choisi sur la page **Remote** ou **Cockpits**. Le viewer et la remote affichent alors ce dossier **plus** les Communs, et les gestes « document suivant/précédent » ne parcourent que ceux-là. Sans dossier actif, tout est affiché.
- **Page Documents** :
  - filtre Tous / Communs / dossier ;
  - création, renommage et suppression des dossiers (supprimer un dossier n'efface pas ses documents : ils redeviennent communs) ;
  - déplacement d'un document via le menu de sa carte ;
  - les envois, `.miz` compris, vont dans le dossier affiché.
- **Mise à jour immédiate** : changer de dossier actif, envoyer, déplacer ou supprimer un document envoie un événement Broadcast `documents_changed` sur le canal des cockpits (côté serveur, par HTTP). Les viewers rechargent alors leur liste sans attendre.
- **Sécurité** : des clés étrangères composites `(folder_id, user_id)` garantissent qu'un document ou un cockpit ne peut référencer que les dossiers de son propriétaire.

## Rotation et sélection multiple (page Documents)

- **Rotation** : les boutons ⟲ ⟳ d'une carte tournent le document par pas de 90°.
  - La rotation est une propriété du document (`documents.rotation`), visible dans toutes les miniatures.
  - Les viewers rechargent leur liste (événement `documents_changed`) et affichent le document tourné, rendu nativement donc net à tout zoom.
  - Zoom, déplacement et curseur sont exprimés dans le repère de la page tournée.
- **Sélection multiple** : une case sur chaque carte, **Maj+clic** pour sélectionner une plage, ou « Tout sélectionner ». La barre d'actions permet ensuite de :
  - **tourner** la sélection ⟲ ⟳ (chaque document depuis sa rotation actuelle) ;
  - la **déplacer** vers un dossier ou vers les Communs ;
  - la **supprimer** (fichiers compris).
- Les modifications sont affichées tout de suite, et annulées si le serveur refuse.

## Rendu et cache du viewer

- **Rendu de base** : la page est rendue ajustée à la fenêtre, à la résolution de l'écran. Pendant un zoom, c'est ce rendu qui est agrandi, en basse résolution.
- **Tuile de détail** : 200 ms après la stabilisation du zoom ou du déplacement, la zone visible (plus une marge de 35 %) est re-rendue à la résolution exacte du zoom par-dessus.
  - Le texte est net à tout niveau de zoom.
  - Le coût est borné : la tuile est limitée à environ 16 Mpx, quelle que soit la taille de la page.
  - Elle n'est re-rendue que si l'on sort de la zone couverte ou si l'on zoome nettement plus.
- **Cache** : chaque fichier téléchargé est stocké dans la **Cache API**, indexé par id de document. Les documents supprimés sont retirés du cache, et tout est purgé si le token est révoqué.
  - Le reste de la liste est préchargé en arrière-plan.
  - La dernière liste de documents est aussi gardée en `localStorage` : un viewer qui redémarre hors ligne affiche quand même le dernier état.

## Documents

- Les fichiers partent **directement du navigateur vers Supabase Storage** : les fonctions Vercel limitent le corps des requêtes à 4,5 Mo.
- Avant l'envoi, le navigateur :
  - vérifie la taille (50 Mo max) et le type réel du fichier (signature binaire, pas l'extension) ;
  - compte les pages avec pdf.js ;
  - génère une miniature WebP (JPEG sur les anciens Safari).
- Le bucket refuse de son côté tout fichier trop gros ou d'un type non autorisé.
- Arborescence : `<user_id>/<uuid>.pdf|png|jpg` et `<user_id>/<uuid>.thumb.webp`.
- **Import de mission (`.miz`) ou de track (`.trk`) DCS** : ce sont deux archives ZIP. Le navigateur les décompresse (`fflate`) en n'extrayant que les images PNG ou JPG utiles.
  - **Kneeboards** : `KNEEBOARD/IMAGES/*` (communs) et `KNEEBOARD/<appareil>/IMAGES/*`. Ils sont cochés par défaut.
  - **Images de briefing** : `l10n/<langue>/*`, dédoublonnées entre les langues. Elles sont décochées par défaut.
  - Les documents créés sont nommés « Mission · Appareil|Briefing · Image ».
  - L'archive elle-même n'est pas envoyée (500 Mo max, lue en mémoire).
  - Sans accès au `.miz` d'un serveur, utilise le **track** de ta session, enregistré dans `Saved Games\DCS\Tracks\Multiplayer`.
- Le worker pdf.js est copié de `node_modules` vers `public/pdfjs/` avant `dev` et `build` (`scripts/copy-pdf-worker.mjs`). C'est le build *legacy* : le build moderne exige des API JS trop récentes pour le navigateur intégré d'OpenKneeboard et pour Safari.

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
- En-têtes HTTP sur toutes les pages :
  - `X-Frame-Options: DENY` et `frame-ancestors 'none'` ;
  - `X-Content-Type-Options: nosniff` ;
  - `Referrer-Policy` ;
  - `Permissions-Policy`.
- Les chemins Storage d'un document doivent commencer par l'id de son propriétaire (contrainte `CHECK`). Le viewer, qui signe les URLs avec la clé service_role, ne peut donc jamais exposer le fichier d'un autre utilisateur.

## Dépannage

| Symptôme | Piste |
| --- | --- |
| « Invalid path specified in request URL » | `NEXT_PUBLIC_SUPABASE_URL` doit être `https://<id>.supabase.co`, sans chemin |
| Point orange permanent (viewer ou remote) | Realtime → Settings : l'accès public aux canaux doit être autorisé ; `VIEWER_CHANNEL_SECRET` identique partout |
| Viewer : « URL invalide ou révoquée » | token régénéré ou cockpit supprimé : recopie l'URL depuis la page Cockpits |
| La tablette / le téléphone n'atteint pas le PC en local | même Wi-Fi, IP `192.168.x.x` (pas celle d'un VPN), pare-feu Windows : autoriser Node.js sur le réseau privé |
| Fonctions manquantes sur tablette / téléphone en `http://192.168…` (cache, copie) | certaines API du navigateur sont réservées au HTTPS : utilise l'URL Vercel |
| `git pull` refuse à cause de `package-lock.json` | `git restore package-lock.json`, puis `git pull` et `npm ci` |
