"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import NavigationPanel from "@/components/NavigationPanel";
import { useAuth } from "@/components/AuthProvider";
import { useGroupRealtime } from "@/hooks/useGroupRealtime";
import type { RideGroup } from "@/lib/groups";
import {
  activeStepIndex,
  distanceM,
  type NavRoute,
} from "@/lib/navigation";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { LatLng } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-zinc-500">
      Carte…
    </div>
  ),
});

export default function GroupRidePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<RideGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [selfPos, setSelfPos] = useState<LatLng | null>(null);
  const [nav, setNav] = useState<NavRoute | null>(null);
  const [navLoading, setNavLoading] = useState(false);

  const displayName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Rider";

  const { locations, online, connected } = useGroupRealtime(
    id ?? null,
    user?.id ?? null,
    displayName,
    sharing
  );

  const loadGroup = useCallback(async () => {
    if (!supabase || !id) return;
    const { data } = await supabase
      .from("ride_groups")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setGroup((data as RideGroup) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!authLoading) void loadGroup();
  }, [authLoading, loadGroup]);

  // GPS local pour navigation (toujours actif sur cet écran)
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setSelfPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Charger instructions navigation OSRM
  useEffect(() => {
    const route = group?.route_geojson;
    if (!route?.start || !route.geometry?.length) return;

    const points: LatLng[] = [
      route.start,
      ...route.waypoints,
      route.start,
    ];

    setNavLoading(true);
    fetch("/api/navigate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.steps) setNav(data as NavRoute);
      })
      .catch(() => {})
      .finally(() => setNavLoading(false));
  }, [group?.route_geojson]);

  const syncSharing = async (next: boolean) => {
    setSharing(next);
    if (!supabase || !user || !id) return;
    await supabase
      .from("group_members")
      .update({ sharing_location: next })
      .eq("group_id", id)
      .eq("user_id", user.id);
  };

  const stepIndex = useMemo(() => {
    if (!nav?.steps.length || !selfPos) return 0;
    return activeStepIndex(nav.steps, selfPos);
  }, [nav, selfPos]);

  const currentStep = nav?.steps[stepIndex] ?? null;
  const distToStep =
    selfPos && currentStep ? distanceM(selfPos, currentStep.location) : null;

  const otherMembers = useMemo(
    () => locations.filter((m) => m.userId !== user?.id),
    [locations, user?.id]
  );

  if (!isSupabaseConfigured) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-zinc-400">
        Supabase requis.
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-zinc-500">
        Chargement…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">Connectez-vous pour rejoindre la ride.</p>
        <Link href="/auth" className="text-brand hover:underline">
          Connexion
        </Link>
      </div>
    );
  }

  if (!group?.route_geojson) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-zinc-400">Aucune route attachée à ce groupe.</p>
        <Link href={`/groups/${id}`} className="text-brand hover:underline">
          ← Retour au groupe
        </Link>
      </div>
    );
  }

  const route = group.route_geojson;

  return (
    <div className="relative h-[calc(100vh-3.5rem)]">
      <MapView
        geometry={route.geometry}
        waypoints={route.waypoints}
        start={route.start}
        animate={false}
        members={otherMembers}
        selfPosition={selfPos}
        followSelf
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] space-y-2 p-3">
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <Link
            href={`/groups/${id}`}
            className="rounded-lg bg-zinc-950/90 px-3 py-2 text-sm text-zinc-300 backdrop-blur hover:text-white"
          >
            ← {group.name}
          </Link>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-xs ${
                connected
                  ? "bg-green-500/20 text-green-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {connected ? `${online.length} en ligne` : "Connexion…"}
            </span>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-zinc-950/90 px-3 py-2 text-sm backdrop-blur">
              <input
                type="checkbox"
                checked={sharing}
                onChange={(e) => void syncSharing(e.target.checked)}
                className="accent-brand"
              />
              Partager GPS
            </label>
          </div>
        </div>

        <div className="pointer-events-auto max-w-md">
          {navLoading ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 text-sm text-zinc-500">
              Calcul navigation…
            </div>
          ) : (
            <NavigationPanel
              step={currentStep}
              stepIndex={stepIndex}
              totalSteps={nav?.steps.length ?? 0}
              distanceToStepM={distToStep}
            />
          )}
        </div>
      </div>
    </div>
  );
}
