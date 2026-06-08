"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RideCard from "@/components/RideCard";
import { useAuth } from "@/components/AuthProvider";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { Ride } from "@/lib/types";

export default function RidesPage() {
  const { user, loading: authLoading } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("ride_feed")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRides((data ?? []) as Ride[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">My rides</h1>
        <p className="mt-3 text-zinc-400">
          Saving rides needs Supabase. Add your keys to <code>.env.local</code>{" "}
          (see the README) to enable accounts and history.
        </p>
      </div>
    );
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">My rides</h1>
        <p className="mt-3 text-zinc-400">
          <Link href="/auth" className="text-brand hover:underline">
            Sign in
          </Link>{" "}
          to see your saved loops.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl overflow-x-hidden px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My rides</h1>
        <p className="text-sm text-zinc-400">
          Your saved loops. Make them public to share, or delete them.
        </p>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : rides.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-10 text-center text-zinc-400">
          You haven’t saved any rides yet. Head to the{" "}
          <Link href="/planner" className="text-brand hover:underline">
            Planner
          </Link>{" "}
          to generate your first loop.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rides.map((r) => (
            <RideCard
              key={r.id}
              ride={r}
              currentUserId={user?.id}
              mode="mine"
              onChange={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
