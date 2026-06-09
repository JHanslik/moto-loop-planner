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
