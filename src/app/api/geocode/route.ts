import { NextResponse } from "next/server";
import {
  looksLikeAddress,
  mergePlaces,
  nominatimToPlaces,
  normalizeSearchQuery,
  photonFeaturesToPlaces,
  photonQueryVariants,
} from "@/lib/geocode";

export const runtime = "nodejs";

const DEFAULT_LAT = "46.6";
const DEFAULT_LON = "2.5";
const USER_AGENT = "MotoLoopPlanner/1.0 (school project)";

async function fetchPhoton(
  q: string,
  lat: string,
  lon: string
): Promise<ReturnType<typeof photonFeaturesToPlaces>> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "12");
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
  url.searchParams.set("limit", "8");
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

/** Bias Photon toward Île-de-France when the query names a town in that area. */
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
  const useNominatim = looksLikeAddress(q) || q.length >= 12 || /\d/.test(q);

  try {
    const photonVariants = photonQueryVariants(q);
    const photonLists = await Promise.all(
      photonVariants.map((variant) =>
        fetchPhoton(variant, bias.lat, bias.lon)
      )
    );

    const nominatimPlaces = useNominatim ? await fetchNominatim(q) : [];

    const places = mergePlaces([...photonLists, nominatimPlaces], q);

    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
