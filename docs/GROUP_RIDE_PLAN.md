# Group Ride — plan de livraison

## Objectif
Permettre à plusieurs motards de se grouper, partager une route, se voir en **temps réel** sur la carte et naviguer turn-by-turn (open data).

## Stack
| Couche | Choix |
|--------|--------|
| Groupes / membres | Supabase PostgreSQL + RLS |
| Positions live | Supabase Realtime **Broadcast** + **Presence** |
| Carte | Leaflet + OSM (existant) |
| Navigation | OSRM `steps=true` (existant, étendu) |
| GPS | `navigator.geolocation.watchPosition` |

## Phases (ordre d’implémentation)

- [x] **P1 — Données** : `ride_groups`, `group_members`, RLS, code d’invitation
- [x] **P2 — Realtime** : hook `useGroupRealtime` (broadcast ~2s, presence online/offline)
- [x] **P3 — UI groupes** : `/groups` (créer/rejoindre), `/groups/[id]` (détail, route, membres)
- [x] **P4 — Ride live** : `/groups/[id]/ride` carte + marqueurs membres live
- [x] **P5 — Navigation** : `/api/navigate` + panneau instructions OSRM
- [x] **P6 — Intégration** : lien navbar, consentement GPS, build, push

## Hors scope (v2)
- Historique positions > 24h
- Notifications push « membre décroché »
- App native / arrière-plan iOS

## RGPD
- Partage GPS uniquement sur écran Ride, toggle explicite
- Arrêt du watch à la sortie de la page
