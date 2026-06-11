export type RideStyle = "SPORT" | "SCENIC" | "CHILL";

export const STYLES: { id: RideStyle; label: string; emoji: string; blurb: string }[] = [
  { id: "SPORT", label: "Sport", emoji: "🏁", blurb: "Twisty, fast secondary roads" },
  { id: "SCENIC", label: "Scenic", emoji: "🏔️", blurb: "Mountains, views, elevation" },
  { id: "CHILL", label: "Chill", emoji: "🌿", blurb: "Easy roads, low traffic" },
];

export interface LatLng {
  lat: number;
  lng: number;
}

/** A loop waypoint — carries a POI name when it was placed on a point of interest. */
export interface Waypoint extends LatLng {
  name?: string;
}

export interface GenerateRequest {
  start: string; // city name or "lat,lng"
  startName?: string; // pretty label when picked from autocomplete (overrides geocoded name)
  durationMin: number;
  style: RideStyle;
  useElevation?: boolean;
}

export interface ScoreBreakdown {
  turnsPerKm: number;
  twistiness: number; // 0..1
  highwayFraction: number; // 0..1 — motorway-like (fast) segments
  mainRoadFraction: number; // 0..1 — nationale / fast main-road segments
  elevationGainM?: number;
}

/** One weighted ingredient of the fun score (for the transparent breakdown). */
export interface ScoreTerm {
  key: string;
  label: string;
  value: number; // 0..1 normalized sub-metric
  weight: number; // 0..1 weight in this style's formula
  contribution: number; // points added to the score (value × weight × 100)
}

/** Full, human-auditable derivation of a route's fun score. */
export interface ScoreExplanation {
  style: RideStyle;
  terms: ScoreTerm[];
  baseScore: number; // 0..100 — sum of contributions before the fast-road malus
  fastRoadsFraction: number; // 0..1 — share of distance on fast roads
  malusApplied: boolean;
  malusFactor: number; // 1 = none; <1 scales the score down
  finalScore: number; // 0..100 — what the user sees
}

/** The shape returned by POST /api/generate-route and stored in `rides.route_geojson`. */
export interface RouteResult {
  geometry: [number, number][]; // [lng, lat] pairs (GeoJSON order)
  waypoints: Waypoint[]; // road-snapped intermediate points (B, C, ...), named when on a POI
  start: LatLng;
  startName: string;
  distanceKm: number;
  durationMin: number;
  score: number; // 0..100 "fun score"
  style: RideStyle;
  breakdown: ScoreBreakdown;
}

// ---------------------------------------------------------------------------
// Open-data dossier — every external open dataset touched to build one loop.
// Returned alongside the route so the UI can show *what* public data was used
// and *where* it came from (transparency / provenance view).
// ---------------------------------------------------------------------------

/** One open-data source credited in the dossier. */
export interface OpenDataSource {
  id: string;
  name: string; // "OpenStreetMap — Overpass API"
  role: string; // what we used it for
  license: string; // "ODbL", "© OpenStreetMap contributors"…
  url: string;
}

/** A single POI returned by Overpass for this search. */
export interface PoiRecord {
  name: string;
  kind: string; // raw OSM tag value (village, viewpoint, castle…)
  category: string; // friendly grouping
  interest: number; // 1–3 tier driving waypoint preference
  lat: number;
  lng: number;
  usedInRoute: boolean; // did the winning loop pass through it?
}

/** Full provenance report for one generated loop. */
export interface OpenDataReport {
  generatedAt: string;
  query: {
    input: string;
    resolvedName: string;
    lat: number;
    lng: number;
    style: RideStyle;
    durationMin: number;
    targetKm: number;
  };
  geocoding: {
    provider: string;
    input: string;
    result: string;
    lat: number;
    lng: number;
  };
  pois: {
    provider: string;
    searchRadiusKm: number;
    overpassQuery: string;
    totalFound: number;
    usedInRoute: number;
    byCategory: { category: string; count: number }[];
    records: PoiRecord[];
  };
  routing: {
    provider: string;
    candidatesTried: number;
    distanceKm: number;
    durationMin: number;
    geometryPoints: number;
    smallRoadsPct: number;
    mainRoadsPct: number;
    highwayPct: number;
  };
  selection: {
    candidatesGenerated: number;
    candidatesRouted: number;
    winnerScore: number;
    scoreMin: number;
    scoreMax: number;
    steps: string[]; // ordered, human-readable decision pipeline
  };
  scoreExplanation: ScoreExplanation;
  sources: OpenDataSource[];
}

/** Response shape of POST /api/generate-route. */
export interface GenerateResponse {
  route: RouteResult;
  openData: OpenDataReport;
}

/** A row of the `rides` table (and the `ride_feed` view, which adds the *_count fields). */
export interface Ride {
  id: string;
  user_id: string;
  name: string;
  distance_km: number;
  duration_min: number;
  route_geojson: RouteResult;
  score: number;
  is_public: boolean;
  rating: number | null;
  style: RideStyle | null;
  start_name: string | null;
  created_at: string;
  /** Set when saved from the community feed (fork of someone else's public ride). */
  forked_from_ride_id?: string | null;
  source_author_name?: string | null;
  // present only when read from the `ride_feed` view:
  author_name?: string | null;
  like_count?: number;
  comment_count?: number;
}

export interface Comment {
  id: string;
  user_id: string;
  ride_id: string;
  content: string;
  created_at: string;
  author_name?: string | null;
}
