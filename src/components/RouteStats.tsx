"use client";

import { STYLES, type RouteResult } from "@/lib/types";

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function RouteStats({ route }: { route: RouteResult }) {
  const style = STYLES.find((s) => s.id === route.style);
  const smallRoads =
    1 - route.breakdown.highwayFraction - route.breakdown.mainRoadFraction;
  const fastRoads =
    route.breakdown.highwayFraction + route.breakdown.mainRoadFraction;
  const highlights = route.waypoints.filter((w) => w.name);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Fun score
          </div>
          <div className="text-4xl font-extrabold text-brand">
            {route.score}
            <span className="text-lg text-zinc-500">/100</span>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-medium">
            {style?.emoji} {style?.label}
          </div>
          <div className="text-zinc-400">{route.startName}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Distance
          </div>
          <div className="text-2xl font-bold">{route.distanceKm} km</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Duration
          </div>
          <div className="text-2xl font-bold">{route.durationMin} min</div>
        </div>
      </div>

      {highlights.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
            Passes by
          </div>
          <ul className="space-y-1.5">
            {highlights.map((w, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-zinc-200">
                <span className="text-zinc-500">📍</span>
                {w.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          Why this score
        </div>
        <Bar label="Twistiness" value={route.breakdown.twistiness} />
        <Bar label="Petites routes" value={Math.max(0, smallRoads)} />
        {route.breakdown.mainRoadFraction > 0.15 && (
          <Bar label="Nationales / axes" value={route.breakdown.mainRoadFraction} />
        )}
        {route.breakdown.highwayFraction > 0.05 && (
          <Bar label="Autoroutes" value={route.breakdown.highwayFraction} />
        )}
        {fastRoads > 0.4 && (
          <p className="text-xs text-amber-400/90">
            Beaucoup d&apos;axes rapides sur ce tracé — essaie CHILL ou SCENIC, ou
            un départ plus rural.
          </p>
        )}
        {route.breakdown.elevationGainM !== undefined && (
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Elevation gain</span>
            <span>{route.breakdown.elevationGainM} m</span>
          </div>
        )}
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Curves</span>
          <span>{Math.round(route.breakdown.turnsPerKm)}°/km</span>
        </div>
      </div>
    </div>
  );
}
