"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import RideNavigationView from "@/components/RideNavigationView";
import { readNavRoute } from "@/lib/navStorage";
import { supabase } from "@/lib/supabaseClient";
import type { RouteResult } from "@/lib/types";

function NavigateContent() {
  const searchParams = useSearchParams();
  const rideId = searchParams.get("ride");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [title, setTitle] = useState("Navigation");
  const [backHref, setBackHref] = useState("/planner");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (rideId && supabase) {
        const { data } = await supabase
          .from("rides")
          .select("name, route_geojson")
          .eq("id", rideId)
          .maybeSingle();
        if (data?.route_geojson) {
          setRoute(data.route_geojson as RouteResult);
          setTitle(data.name);
          setBackHref("/rides");
          setLoading(false);
          return;
        }
      }

      const stored = readNavRoute();
      if (stored) {
        setRoute(stored.route);
        setTitle(stored.label);
        setBackHref(rideId ? "/rides" : "/planner");
      }
      setLoading(false);
    })();
  }, [rideId]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-zinc-500">
        Chargement…
      </div>
    );
  }

  if (!route) {
    return (
      <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-zinc-400">
          Aucune route à suivre. Générez une boucle dans le Planner ou choisissez
          une ride sauvegardée.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/planner"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Planner
          </Link>
          <Link
            href="/rides"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
          >
            Mes rides
          </Link>
        </div>
      </div>
    );
  }

  return (
    <RideNavigationView
      route={route}
      title={title}
      backHref={backHref}
      backLabel="Quitter"
    />
  );
}

export default function NavigatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-zinc-500">
          Chargement…
        </div>
      }
    >
      <NavigateContent />
    </Suspense>
  );
}
