"use client";

import { downloadGpx } from "@/lib/gpx";
import { googleMapsUrl } from "@/lib/exportLinks";
import type { RouteResult } from "@/lib/types";
import WazeExportButton from "./WazeExportButton";

export default function ExportButtons({
  route,
  name,
}: {
  route: RouteResult;
  name?: string;
}) {
  const label = name || `Moto loop · ${route.startName}`;
  return (
    <div className="grid min-w-0 grid-cols-3 gap-2">
      <a
        href={googleMapsUrl(route)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-zinc-700 px-1 py-2 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-800 sm:text-xs"
      >
        🗺️ Google
      </a>
      <WazeExportButton route={route} />
      <button
        type="button"
        onClick={() => downloadGpx(route, label)}
        className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-zinc-700 px-1 py-2 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-800 sm:text-xs"
      >
        ⬇️ GPX
      </button>
    </div>
  );
}
