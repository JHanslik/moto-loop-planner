import { NextResponse } from "next/server";
import { photonFeaturesToPlaces } from "@/lib/geocode";

export const runtime = "nodejs";

/** Default map bias: centre of France — improves city ranking for FR queries. */
const DEFAULT_LAT = "46.6";
const DEFAULT_LON = "2.5";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ places: [] });
  }

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "10");
  url.searchParams.set("lang", searchParams.get("lang") ?? "fr");
  url.searchParams.set("lat", searchParams.get("lat") ?? DEFAULT_LAT);
  url.searchParams.set("lon", searchParams.get("lon") ?? DEFAULT_LON);

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "MotoLoopPlanner/1.0 (school project)" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      return NextResponse.json({ places: [] });
    }
    const data = await res.json();
    return NextResponse.json({
      places: photonFeaturesToPlaces(data.features ?? [], q),
    });
  } catch {
    return NextResponse.json({ places: [] });
  }
}
