import { NextResponse } from "next/server";
import {
  banFeaturesToPlaces,
  looksLikeAddress,
  mergePlaces,
  nominatimToPlaces,
  normalizeSearchQuery,
  photonFeaturesToPlaces,
} from "@/lib/geocode";

export const runtime = "nodejs";

const DEFAULT_LAT = "46.6";
const DEFAULT_LON = "2.5";
const USER_AGENT = "MotoLoopPlanner/1.0 (school project)";

async function fetchBan(q: string) {
  const url = new URL("https://api-adresse.data.gouv.fr/search/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("autocomplete", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return banFeaturesToPlaces(data.features ?? [], q);
}

async function fetchPhoton(q: string, lat: string, lon: string) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "fr");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return photonFeaturesToPlaces(data.features ?? [], q);
}

async function fetchNominatim(q: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "fr");
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "fr,en",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return nominatimToPlaces(Array.isArray(data) ? data : [], q);
}

function photonBias(q: string): { lat: string; lon: string } {
  const n = normalizeSearchQuery(q).toLowerCase();
  if (n.includes("saint-cloud")) return { lat: "48.846", lon: "2.221" };
  if (n.includes("paris")) return { lat: "48.856", lon: "2.352" };
  if (n.includes("versailles")) return { lat: "48.805", lon: "2.120" };
  if (/\b(92|93|94|95|78|91|77)\d{3}\b/.test(n))
    return { lat: "48.85", lon: "2.35" };
  return { lat: DEFAULT_LAT, lon: DEFAULT_LON };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q")?.trim() ?? "";
  const q = normalizeSearchQuery(raw);
  if (q.length < 2) {
    return NextResponse.json({ places: [] });
  }

  const bias = photonBias(q);

  try {
    const [banPlaces, photonPlaces] = await Promise.all([
      fetchBan(q),
      fetchPhoton(q, bias.lat, bias.lon),
    ]);

    let places = mergePlaces([banPlaces, photonPlaces], q);

    // OSM fallback when BAN + Photon return few hits on a full address query.
    if (places.length < 3 && (looksLikeAddress(q) || q.length >= 12)) {
      const nominatimPlaces = await fetchNominatim(q);
      places = mergePlaces([banPlaces, photonPlaces, nominatimPlaces], q);
    }

    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
