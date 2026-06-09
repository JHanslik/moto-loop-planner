"use client";

import { useCallback, useEffect, useState } from "react";
import RideCard from "@/components/RideCard";
import { useAuth } from "@/components/AuthProvider";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { STYLES, type Ride, type RideStyle } from "@/lib/types";

export default function CommunityPage() {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [forkedIds, setForkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [styleFilter, setStyleFilter] = useState<RideStyle | "">("");
  const [maxDist, setMaxDist] = useState("");
  const [sort, setSort] = useState<"recent" | "popular">("recent");

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let q = supabase.from("ride_feed").select("*").eq("is_public", true);
    if (styleFilter) q = q.eq("style", styleFilter);
    if (maxDist && !isNaN(Number(maxDist)))
      q = q.lte("distance_km", Number(maxDist));
    q =
      sort === "popular"
        ? q.order("like_count", { ascending: false })
        : q.order("created_at", { ascending: false });

    const { data } = await q.limit(60);
    setRides((data ?? []) as Ride[]);

    if (user) {
      const [{ data: likes }, { data: forks }] = await Promise.all([
        supabase.from("likes").select("ride_id").eq("user_id", user.id),
        supabase
          .from("rides")
          .select("forked_from_ride_id")
          .eq("user_id", user.id)
          .not("forked_from_ride_id", "is", null),
      ]);
      setLikedIds(new Set((likes ?? []).map((l: { ride_id: string }) => l.ride_id)));
      setForkedIds(
        new Set(
          (forks ?? [])
            .map((f: { forked_from_ride_id: string | null }) => f.forked_from_ride_id)
            .filter(Boolean) as string[]
        )
      );
    } else {
      setLikedIds(new Set());
      setForkedIds(new Set());
    }
    setLoading(false);
  }, [styleFilter, maxDist, sort, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Community feed</h1>
        <p className="mt-3 text-zinc-400">
          The community feed needs Supabase. Add your{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>{" "}
          (see the README), then restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Community rides</h1>
          <p className="text-sm text-zinc-400">
            Public loops shared by riders. Like, comment, or save them.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value as RideStyle | "")}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 outline-none focus:border-brand"
          >
            <option value="">All styles</option>
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.label}
              </option>
            ))}
          </select>
          <input
            value={maxDist}
            onChange={(e) => setMaxDist(e.target.value)}
            type="number"
            placeholder="max km"
            className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 outline-none focus:border-brand"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "recent" | "popular")}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 outline-none focus:border-brand"
          >
            <option value="recent">Most recent</option>
            <option value="popular">Most popular</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading rides…</p>
      ) : rides.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-10 text-center text-zinc-400">
          No public rides yet. Generate one in the{" "}
          <a href="/planner" className="text-brand hover:underline">
            Planner
          </a>{" "}
          and tick “Share with the community”.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rides.map((r) => (
            <RideCard
              key={r.id}
              ride={r}
              currentUserId={user?.id}
              likedByMe={likedIds.has(r.id)}
              alreadyForked={forkedIds.has(r.id)}
              mode="feed"
              onChange={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
