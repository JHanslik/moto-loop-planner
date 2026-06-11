# 🏍️ Moto Loop Planner

Génère des **boucles moto optimisées** à partir d'un point de départ, d'une
durée et d'un style de conduite — tracées sur de **vraies routes OpenStreetMap**,
notées pour le plaisir, sauvegardées, partagées avec une communauté, et
exportées directement vers ton GPS.

Conçu comme un projet **open data + algorithme + cartographie**.

---

## ✨ Fonctionnalités

- **Algorithme de génération de boucles** — disperse des boucles candidates
  autour de ton départ, route chacune sur de vraies routes (OSRM), les note, et
  renvoie la meilleure.
- **Points d'intérêt malins** — privilégie le **patrimoine** (châteaux, abbayes,
  ruines), les **points de vue** et la **nature remarquable** (via Overpass /
  OpenStreetMap) plutôt que des villages au hasard ; les villages ne servent que
  de repli quand un secteur n'a rien de mieux.
- **Fun score** — notation par style sur la sinuosité, l'évitement des axes
  rapides, le respect de la distance et (optionnel) le dénivelé.
- **Autocomplétion d'adresse** — suggestions à la frappe sur le champ de départ
  via Photon (OpenStreetMap) + la Base Adresse Nationale, avec navigation au
  clavier. Choisir une suggestion transmet les coordonnées exactes au générateur
  (pas de re-géocodage, pas d'ambiguïté).
- **Dossier open data** — une page dédiée (`/data`) qui montre, pour chaque
  recherche, **toutes les données publiques récupérées** (POIs, géocodage,
  routage), **le détail du calcul du fun score**, et les sources + licences.
- **Carte interactive** — Leaflet + tuiles OpenStreetMap, tracé animé, marqueurs
  des points de passage. Aucune clé d'API requise.
- **Export GPS** — lien direct Google Maps, lien direct Waze, et fichier **GPX**
  téléchargeable.
- **Comptes & communauté** *(optionnel, via Supabase)* — inscription, sauvegarde
  des boucles, publication, fil communautaire, likes et commentaires, reprise des
  boucles des autres.
- **Interface sombre, style tableau de bord** (formulaire à gauche, carte à
  droite).

---

## 🧱 Stack

| Couche      | Techno                                                |
| ----------- | ----------------------------------------------------- |
| Framework   | Next.js 14 (App Router) + TypeScript                  |
| Style       | Tailwind CSS                                           |
| Carte       | Leaflet + react-leaflet + tuiles OpenStreetMap        |
| Routage     | OSRM (démo `router.project-osrm.org` par défaut)      |
| Points d'intérêt | Overpass API (OpenStreetMap)                     |
| Géocodage   | Nominatim (résolution à la validation) + Photon / BAN (autocomplétion) |
| Dénivelé    | Open-Elevation (optionnel)                             |
| BD + Auth   | Supabase (PostgreSQL + Auth) — **optionnel**          |

---

## 🚀 Démarrage rapide (planner seul, zéro config)

Le générateur de boucles, la carte et l'export GPS fonctionnent **sans compte et
sans clé.**

```bash
npm install
npm run dev
```

Ouvre <http://localhost:3000>, va dans **Planner**, saisis un départ (ex.
`Grenoble` ou `45.188,5.724`), choisis une durée et un style, puis clique sur
**Generate Route**.

> Le routage / géocodage / les tuiles nécessitent un accès internet (OSRM,
> Nominatim, OSM publics).

---

## 🔐 Activer les comptes, la sauvegarde et le fil communautaire (Supabase)

1. Crée un projet gratuit sur <https://supabase.com>.
2. **SQL Editor → New query** → colle le contenu de
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Cela crée les tables
   `profiles`, `rides`, `likes`, `comments`, la vue `ride_feed`, les politiques
   RLS et le trigger d'inscription.
3. *(Recommandé pour les démos)* **Authentication → Providers → Email** →
   désactive **« Confirm email »** pour que l'inscription connecte directement.
4. **Project Settings → API** → copie la **Project URL** et la clé
   **anon public**.
5. Crée `.env.local` (à partir de `.env.example`) :

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

6. Relance `npm run dev`. La barre de navigation affiche maintenant **Sign in**,
   et le Planner peut sauvegarder des boucles.

Si les clés sont absentes, l'app tourne en **« mode planner seul »** et les pages
sociales affichent un message clair au lieu de planter.

---

## 🧠 Comment fonctionne l'algorithme de génération

`src/lib/loopGenerator.ts`

1. **Distance cible** — `durée × vitesse moyenne du style` (Sport 58, Scenic 48,
   Chill 45 km/h).
2. **Rayon** — on calcule le rayon d'un cercle pour qu'un polygone à 3 ou 4
   sommets ≈ la distance cible une fois tracé sur les routes (un facteur de
   détour de 1,35 tient compte du fait que les routes ne sont pas droites).
3. **Points d'intérêt** — on récupère les POI autour du départ via **Overpass**
   (`src/lib/pois.ts`) : patrimoine, points de vue, nature remarquable. Deux jeux
   de résultats séparés évitent que les villages, très nombreux, n'étouffent les
   POI intéressants — les villages ne servent que de repli.
4. **Candidates** — on génère 12 boucles en faisant varier le cap de départ et
   les angles/rayons, en mélangeant `A→B→C→A` (triangle) et boucles à 4 points.
   Dans chaque secteur de boussole, on choisit le POI **le plus intéressant**
   proche de l'anneau cible (patrimoine / point de vue prioritaires, village en
   dernier recours).
5. **Routage** — chaque candidate est envoyée à **OSRM** (`src/lib/osrm.ts`), qui
   renvoie la géométrie réelle des routes + distance/durée par segment.
6. **Notation** (`src/lib/scoring.ts`) — chaque tracé est noté de 0 à 100 :
   - **Sinuosité (twistiness)** — changement de cap total par km (sature à
     ~60°/km).
   - **Petites routes** — les segments rapides (autoroutes ~94 km/h, nationales
     ~59 km/h, déduits de distance ÷ durée) sont pénalisés ; rester sur les
     petites routes est fortement récompensé.
   - **Respect de la distance** — proximité avec la distance cible.
   - **Dénivelé** — optionnel, récompense le grimpe (Scenic uniquement).

   Les poids sont réglés par style (Sport = virages, Scenic = virages +
   dénivelé, Chill = virages modérés + régularité).
7. La boucle au **fun score le plus élevé** est retournée (à score égal, celle
   qui passe par les POI les plus intéressants).

---

## 🗺️ Export GPS

`src/lib/exportLinks.ts` et `src/lib/gpx.ts`

- **Google Maps** — `…/maps/dir/?api=1&origin=…&destination=…&waypoints=…`
  (origine = destination = départ ; points B/C en waypoints).
- **Waze** — `https://waze.com/ul?ll=LAT,LNG&navigate=yes`. Les URL Waze ne
  gèrent qu'une seule destination, donc les boucles multi-arrêts se replient sur
  **A → B**.
- **GPX** — un fichier GPX 1.1 téléchargeable (trace complète + points de
  passage), compatible avec les GPS moto.

---

## 📁 Structure du projet

```
src/
├─ app/
│  ├─ page.tsx                 Accueil
│  ├─ planner/page.tsx         Tableau de bord principal (formulaire + carte + export + sauvegarde)
│  ├─ data/page.tsx            Explorateur open data (données + sources d'une recherche)
│  ├─ community/page.tsx       Fil public (filtres, like, commentaire, sauvegarde)
│  ├─ rides/page.tsx           Mes boucles sauvegardées
│  ├─ auth/page.tsx            Connexion / inscription
│  └─ api/generate-route/route.ts   Géocodage + exécution de l'algorithme (serveur)
├─ components/
│  ├─ MapView.tsx              Carte Leaflet (client uniquement, animée)
│  ├─ RouteForm.tsx  RouteStats.tsx  ExportButtons.tsx  RideCard.tsx
│  ├─ OpenDataPanel.tsx        Dossier open data (POIs, sources, détail du score)
│  ├─ Navbar.tsx  AuthProvider.tsx
└─ lib/
   ├─ loopGenerator.ts  scoring.ts  osrm.ts  pois.ts  geo.ts  elevation.ts
   ├─ gpx.ts  exportLinks.ts  geocode.ts  supabaseClient.ts  types.ts
supabase/schema.sql            Schéma BD + RLS + vue feed
```

---

## ⚠️ Notes & limites

- L'**Overpass public** et la **démo OSRM publique** sont à débit limité et au
  mieux. Pour de la production ou une démo intensive, héberge ton propre OSRM (ou
  utilise GraphHopper) et renseigne `OSRM_BASE_URL` dans `.env.local`.
- La détection des axes rapides est une **heuristique de vitesse** (le profil
  OSRM de démo n'expose pas la classe de route). C'est un bon indicateur, pas une
  vérité absolue.
- **La durée cible le _gabarit_ de la boucle, pas une limite stricte.** On
  convertit la durée demandée en distance cible via une vitesse nominale par
  style, puis on affiche l'estimation de temps d'OSRM — qui dépend du terrain.
  En zone vallonnée (ex. les Alpes), une demande « 2h » peut renvoyer une
  estimation plus longue car les vraies routes sont plus lentes que la vitesse
  nominale. Une amélioration possible : un passage de recalibrage quand
  l'estimation d'OSRM s'éloigne trop de la demande.
- Open-Elevation est public et parfois indisponible ; le dénivelé est
  **désactivé par défaut** et échoue proprement.
- Politique d'usage de Nominatim : OK pour une démo ; ne pas le marteler en
  production.

## 🔒 Sécurité (npm audit)

Figé sur **Next.js 14.2.35** (dernière stable 14.x, patchée pour l'avis de
sécurité de décembre 2025). `npm audit` signale encore Next.js car certains avis
plus récents n'ont été rétroportés que sur la branche 15.x/16.x — son « correctif »
suggéré est `next@16.2.7`, un saut cassant qui force aussi React 19 +
react-leaflet 5. Les surfaces signalées (**optimiseur `next/image`, middleware,
rewrites, i18n, nonces CSP**) ne sont **pas utilisées par cette app**, donc le
risque pratique pour un build local/démo est minime. Pour un audit propre,
migrer vers Next 16 + React 19 + react-leaflet 5.

---

## 📦 Scripts

```bash
npm run dev     # serveur de développement
npm run build   # build de production
npm start       # sert le build de production
```

---

## ☁️ Déploiement

Déploiement sur Vercel : importe le dépôt, ajoute `NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_ANON_KEY` en variables d'environnement (optionnel),
déploie.
