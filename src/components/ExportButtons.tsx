"use client";

import { downloadGpx } from "@/lib/gpx";
import { googleMapsUrl, wazeUrl } from "@/lib/exportLinks";
import type { RouteResult } from "@/lib/types";

export default function ExportButtons({
  route,
  name,
}: {
  route: RouteResult;
  name?: string;
}) {
  const label = name || `Moto loop · ${route.startName}`;
  return (
    <div className="grid grid-cols-3 gap-2">
      <a
        href={googleMapsUrl(route)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
      >
        🗺️ Google
      </a>
      <a
        href={wazeUrl(route)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
      >
        🚗 Waze
      </a>
      <button
        onClick={() => downloadGpx(route, label)}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
      >
        ⬇️ GPX
      </button>
    </div>
  );
}
