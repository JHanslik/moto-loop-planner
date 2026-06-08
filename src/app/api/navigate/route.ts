import { NextResponse } from "next/server";
import { osrmNavigationRoute } from "@/lib/navigation";
import type { LatLng } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: { points?: LatLng[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const points = body.points;
  if (!Array.isArray(points) || points.length < 2) {
    return NextResponse.json(
      { error: "At least 2 points required." },
      { status: 400 }
    );
  }

  const nav = await osrmNavigationRoute(points);
  if (!nav) {
    return NextResponse.json(
      { error: "Could not compute navigation route." },
      { status: 502 }
    );
  }

  return NextResponse.json(nav);
}
