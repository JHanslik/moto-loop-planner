import { NextResponse } from "next/server";
import { generateLoop } from "@/lib/loopGenerator";
import type { GenerateRequest, LatLng } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Resolve a free-text start into coordinates: accepts "lat,lng" directly, else geocodes via Nominatim. */
async function resolveStart(
  input: string
): Promise<{ point: LatLng; name: string } | null> {
  const coordMatch = input
    .trim()
    .match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { point: { lat, lng }, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    }
  }

  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=` +
    encodeURIComponent(input);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "MotoLoopPlanner/1.0 (school project)",
      "Accept-Language": "fr,en",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return null;

  return {
    point: { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) },
    name: String(data[0].display_name).split(",").slice(0, 2).join(",").trim(),
  };
}

export async function POST(req: Request) {
  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { start, startName, durationMin, style, useElevation } = body;
  if (!start || !durationMin || !style) {
    return NextResponse.json(
      { error: "Missing required fields: start, durationMin, style." },
      { status: 400 }
    );
  }
  if (durationMin < 30 || durationMin > 600) {
    return NextResponse.json(
      { error: "durationMin must be between 30 and 600 minutes." },
      { status: 400 }
    );
  }

  const resolved = await resolveStart(start);
  if (!resolved) {
    return NextResponse.json(
      { error: `Could not find a starting location for "${start}".` },
      { status: 404 }
    );
  }

  // Credit the geocoding path that produced these coordinates.
  const isCoords = /^-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(
    start.trim()
  );
  const provider = isCoords
    ? startName?.trim()
      ? "Autocomplétion (Photon + BAN)"
      : "Coordonnées GPS directes"
    : "Nominatim (OpenStreetMap)";

  const loop = await generateLoop(
    resolved.point,
    startName?.trim() || resolved.name,
    durationMin,
    style,
    {
      useElevation,
      provenance: { input: startName?.trim() || start.trim(), provider },
    }
  );
  if (!loop) {
    return NextResponse.json(
      { error: "No routable loop found here. Try another start or duration." },
      { status: 502 }
    );
  }

  return NextResponse.json(loop);
}
