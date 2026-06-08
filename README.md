# 🏍️ Moto Loop Planner

Generate **optimized motorcycle loops** from a starting point, a duration and a
riding style — routed on **real OpenStreetMap roads**, scored for fun, saved,
shared with a community, and exported straight to your GPS.

Built as an **open data + algorithm + cartography** project.

---

## ✨ Features

- **Loop generation algorithm** — sprays candidate loops around your start,
  routes each on real roads (OSRM), scores them, and returns the best.
- **Fun score** — per-style scoring on twistiness, motorway avoidance, distance
  fit and (optional) elevation gain.
- **Address autocomplete** — type-ahead suggestions on the start field via
  Photon (OpenStreetMap), with keyboard navigation. Picking a suggestion passes
  exact coordinates to the generator (no re-geocoding, no ambiguity).
- **Interactive map** — Leaflet + OpenStreetMap tiles, animated polyline,
  waypoint markers. No API key required.
- **GPS export** — Google Maps deep link, Waze deep link, and downloadable
  **GPX** file.
- **Accounts & community** *(optional, via Supabase)* — sign up, save rides,
  publish them, browse a community feed, like and comment, save others' loops.
- **Dark, dashboard-style UI** (form on the left, map on the right).

---

## 🧱 Stack

| Layer       | Tech                                             |
| ----------- | ------------------------------------------------ |
| Framework   | Next.js 14 (App Router) + TypeScript             |
| Styling     | Tailwind CSS                                      |
| Map         | Leaflet + react-leaflet + OpenStreetMap tiles    |
| Routing     | OSRM (`router.project-osrm.org` demo by default) |
| Geocoding   | Nominatim (resolve on submit) + Photon (autocomplete) |
| Elevation   | Open-Elevation (optional)                         |
| DB + Auth   | Supabase (PostgreSQL + Auth) — **optional**      |

---

## 🚀 Quick start (planner-only, zero config)

The route generator, map and GPS export work **with no accounts and no keys.**

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, go to **Planner**, type a start (e.g. `Grenoble`
or `45.188,5.724`), pick a duration and a style, and hit **Generate Route**.

> Routing/geocoding/tiles need internet access (public OSRM, Nominatim, OSM).

---

## 🔐 Enable accounts, saved rides & the community feed (Supabase)

1. Create a free project at <https://supabase.com>.
2. **SQL Editor → New query** → paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**. This creates the
   `profiles`, `rides`, `likes`, `comments` tables, the `ride_feed` view, RLS
   policies and the sign-up trigger.
3. *(Recommended for demos)* **Authentication → Providers → Email** → turn
   **"Confirm email" OFF** so sign-up logs you in instantly.
4. **Project Settings → API** → copy the **Project URL** and the **anon public**
   key.
5. Create `.env.local` (copy from `.env.example`):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

6. Restart `npm run dev`. The navbar now shows **Sign in**, and the Planner can
   save rides.

If the keys are absent, the app runs in **"planner-only mode"** and the social
pages show a friendly notice instead of breaking.

---

## 🧠 How the loop algorithm works

`src/lib/loopGenerator.ts`

1. **Target distance** — `duration × average style speed` (Sport 58, Scenic 48,
   Chill 45 km/h).
2. **Radius** — derive a circle radius so a 3- or 4-point polygon ≈ the target
   distance once snapped to roads (a 1.35 detour factor accounts for roads not
   being straight lines).
3. **Candidates** — generate ~7 loops by rotating the start bearing and
   jittering angles/radii, mixing `A→B→C→A` (triangle) and 4-point loops.
4. **Routing** — each candidate is sent to **OSRM** (`src/lib/osrm.ts`), which
   returns real road geometry + per-segment distance/duration.
5. **Scoring** (`src/lib/scoring.ts`) — each route is scored 0–100:
   - **Twistiness** — total heading change per km (saturates ~60°/km).
   - **Highway fraction** — segments faster than ~97 km/h are treated as
     motorway and penalized (inferred from segment distance ÷ duration).
   - **Distance match** — closeness to the target distance.
   - **Elevation** — optional, rewards climbing (Scenic only).

   Weights are tuned per style (Sport = curves, Scenic = curves + elevation,
   Chill = moderate curves + steady).
6. The **highest-scoring** loop is returned.

---

## 🗺️ GPS export

`src/lib/exportLinks.ts` and `src/lib/gpx.ts`

- **Google Maps** — `…/maps/dir/?api=1&origin=…&destination=…&waypoints=…`
  (origin = destination = start; B/C points as waypoints).
- **Waze** — `https://waze.com/ul?ll=LAT,LNG&navigate=yes`. Waze URLs are
  single-destination, so multi-stop loops fall back to **A → B**.
- **GPX** — a downloadable GPX 1.1 file (full track + waypoints), compatible
  with moto GPS units.

---

## 📁 Project structure

```
src/
├─ app/
│  ├─ page.tsx                 Landing
│  ├─ planner/page.tsx         Main dashboard (form + map + export + save)
│  ├─ community/page.tsx       Public feed (filters, like, comment, save)
│  ├─ rides/page.tsx           My saved rides
│  ├─ auth/page.tsx            Sign in / sign up
│  └─ api/generate-route/route.ts   Geocode + run the algorithm (server)
├─ components/
│  ├─ MapView.tsx              Leaflet map (client-only, animated)
│  ├─ RouteForm.tsx  RouteStats.tsx  ExportButtons.tsx  RideCard.tsx
│  ├─ Navbar.tsx  AuthProvider.tsx
└─ lib/
   ├─ loopGenerator.ts  scoring.ts  osrm.ts  geo.ts  elevation.ts
   ├─ gpx.ts  exportLinks.ts  supabaseClient.ts  types.ts
supabase/schema.sql            DB schema + RLS + feed view
```

---

## ⚠️ Notes & limitations

- The **public OSRM demo** is rate-limited and best-effort. For production or
  heavy demo use, self-host OSRM (or use GraphHopper) and set `OSRM_BASE_URL`
  in `.env.local`.
- Motorway detection is a **speed heuristic** (the demo OSRM profile doesn't
  expose road class). It's a good proxy, not ground truth.
- **Duration is a target for loop _size_, not a hard cap.** We turn the
  requested duration into a target distance using a nominal style speed, then
  display OSRM's own time estimate — which is terrain-dependent. In hilly areas
  (e.g. the Alps) a "2h" request can return a longer estimate because real roads
  are slower than the nominal speed. A possible refinement is one rescale pass
  when OSRM's estimate is far from the request.
- Open-Elevation is public and sometimes down; elevation is **off by default**
  and fails gracefully.
- Nominatim usage policy: fine for a demo; don't hammer it in production.

## 🔒 Security (npm audit)

Pinned to **Next.js 14.2.35** (latest stable 14.x, patched for the December 2025
advisory). `npm audit` still flags Next.js because some newer advisories were
only backported to the 15.x/16.x line — its suggested "fix" is `next@16.2.7`, a
breaking jump that also forces React 19 + react-leaflet 5. The flagged surfaces
(**`next/image` optimizer, middleware, rewrites, i18n, CSP nonces**) are **not
used by this app**, so the practical risk for a local/demo build is minimal. To
get a clean audit, migrate to Next 16 + React 19 + react-leaflet 5.

---

## 📦 Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm start       # serve the production build
```

---

## ☁️ Deploy

Deploy on Vercel: import the repo, add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables (optional), deploy.
