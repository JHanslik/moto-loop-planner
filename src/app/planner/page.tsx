"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import RouteForm from "@/components/RouteForm";
import RouteStats from "@/components/RouteStats";
import ExportButtons from "@/components/ExportButtons";
import { useAuth } from "@/components/AuthProvider";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { GenerateRequest, RouteResult } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-zinc-500">
      Loading map…
    </div>
  ),
});

export default function PlannerPage() {
  const { user } = useAuth();
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [makePublic, setMakePublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const generate = async (req: GenerateRequest) => {
    setLoading(true);
    setError(null);
    setRoute(null);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/generate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");
      setRoute(data as RouteResult);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const saveRide = async () => {
    if (!supabase || !user || !route) return;
    setSaving(true);
    setSavedMsg(null);
    const { error: err } = await supabase.from("rides").insert({
      user_id: user.id,
      name: name.trim() || `Loop from ${route.startName}`,
      distance_km: route.distanceKm,
      duration_min: route.durationMin,
      route_geojson: route,
      score: route.score,
      style: route.style,
      start_name: route.startName,
      is_public: makePublic,
    });
    setSaving(false);
    setSavedMsg(err ? `Error: ${err.message}` : "Ride saved!");
    if (!err) setName("");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Left: form + results */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h1 className="mb-4 text-lg font-bold">Plan a loop</h1>
            <RouteForm onGenerate={generate} loading={loading} />
          </div>

          {error && (
            <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {route && (
            <>
              <RouteStats route={route} />

              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Export to GPS
                </div>
                <ExportButtons route={route} name={name || undefined} />
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                  Save ride
                </div>
                {!isSupabaseConfigured ? (
                  <p className="text-sm text-zinc-400">
                    Configure Supabase to save and share rides. The route above
                    is fully usable and exportable right now.
                  </p>
                ) : !user ? (
                  <p className="text-sm text-zinc-400">
                    <a href="/auth" className="text-brand hover:underline">
                      Sign in
                    </a>{" "}
                    to save this ride to your account.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={`Loop from ${route.startName}`}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
                      <input
                        type="checkbox"
                        checked={makePublic}
                        onChange={(e) => setMakePublic(e.target.checked)}
                        className="h-4 w-4 accent-brand"
                      />
                      Share with the community
                    </label>
                    <button
                      onClick={saveRide}
                      disabled={saving}
                      className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save Ride"}
                    </button>
                    {savedMsg && (
                      <p className="text-sm text-zinc-400">{savedMsg}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: map */}
        <div className="h-[55vh] overflow-hidden rounded-xl border border-zinc-800 lg:h-[calc(100vh-7rem)]">
          <MapView
            geometry={route?.geometry ?? []}
            waypoints={route?.waypoints ?? []}
            start={route?.start ?? null}
          />
        </div>
      </div>
    </div>
  );
}
