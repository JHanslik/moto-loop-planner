"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import StartNavigationButton from "@/components/StartNavigationButton";
import { memberColor } from "@/lib/groups";
import type { GroupMember, RideGroup } from "@/lib/groups";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type { RouteResult } from "@/lib/types";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<RideGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [rides, setRides] = useState<{ id: string; name: string; route_geojson: RouteResult }[]>([]);
  const [rideId, setRideId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isLeader = user?.id === group?.leader_id;

  const load = useCallback(async () => {
    if (!supabase || !user || !id) return;
    const { data: g, error } = await supabase
      .from("ride_groups")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !g) {
      setGroup(null);
      setLoading(false);
      return;
    }
    setGroup(g as RideGroup);

    const { data: mems } = await supabase
      .from("group_members")
      .select("*, profiles(name, email)")
      .eq("group_id", id);
    setMembers((mems as GroupMember[]) ?? []);

    if (g.leader_id === user.id) {
      const { data: myRides } = await supabase
        .from("rides")
        .select("id, name, route_geojson")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setRides((myRides as typeof rides) ?? []);
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    if (!authLoading && user) void load();
    else if (!authLoading) setLoading(false);
  }, [authLoading, user, load]);

  const copyCode = async () => {
    if (!group) return;
    await navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const attachRoute = async () => {
    if (!supabase || !group || !isLeader) return;
    const selected = rides.find((r) => r.id === rideId);
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase
      .from("ride_groups")
      .update({ ride_id: rideId, route_geojson: selected.route_geojson })
      .eq("id", group.id);
    if (error) setMsg(error.message);
    else {
      setGroup({ ...group, ride_id: rideId, route_geojson: selected.route_geojson });
      setMsg("Route attachée au groupe.");
    }
    setBusy(false);
  };

  const toggleActive = async () => {
    if (!supabase || !group || !isLeader) return;
    setBusy(true);
    const next = !group.is_active;
    const { error } = await supabase
      .from("ride_groups")
      .update({ is_active: next })
      .eq("id", group.id);
    if (!error) setGroup({ ...group, is_active: next });
    setBusy(false);
  };

  const leaveGroup = async () => {
    if (!supabase || !user || !group) return;
    setBusy(true);
    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", group.id)
      .eq("user_id", user.id);
    router.push("/groups");
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-zinc-400">
        Supabase requis pour les groupes.
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center text-zinc-500">
        Chargement…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Link href="/auth" className="text-brand hover:underline">Connectez-vous</Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-zinc-400">Groupe introuvable ou accès refusé.</p>
        <Link href="/groups" className="mt-4 inline-block text-brand hover:underline">
          ← Retour
        </Link>
      </div>
    );
  }

  const hasRoute = !!group.route_geojson?.geometry?.length;

  return (
    <div className="mx-auto max-w-2xl overflow-x-hidden px-4 py-8">
      <Link href="/groups" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← Groupes
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {group.is_active ? "Ride active" : "En attente"}
            {hasRoute && ` · ${group.route_geojson!.distanceKm.toFixed(0)} km`}
          </p>
        </div>
        <button
          onClick={copyCode}
          className="rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 font-mono text-sm tracking-widest text-brand hover:bg-brand/20"
        >
          {copied ? "Copié !" : group.invite_code}
        </button>
      </div>

      {msg && (
        <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm">
          {msg}
        </div>
      )}

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="font-semibold">Membres ({members.length})</h2>
        <ul className="mt-3 space-y-2">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center gap-3 rounded-lg bg-zinc-900/60 px-3 py-2"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-zinc-950"
                style={{ background: memberColor(m.user_id) }}
              >
                {(m.profiles?.name ?? m.profiles?.email ?? "?").charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 text-sm">
                {m.profiles?.name ?? m.profiles?.email ?? m.user_id.slice(0, 8)}
              </span>
              {m.role === "leader" && (
                <span className="text-xs text-brand">Chef</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isLeader && (
        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="font-semibold">Route du groupe</h2>
          {hasRoute ? (
            <p className="mt-2 text-sm text-zinc-400">
              {group.route_geojson!.startName} — {group.route_geojson!.distanceKm.toFixed(1)} km
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">Aucune route attachée.</p>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              value={rideId}
              onChange={(e) => setRideId(e.target.value)}
              className="min-w-0 w-full flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Choisir une ride sauvegardée</option>
              {rides.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              onClick={attachRoute}
              disabled={busy || !rideId}
              className="w-full shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              Attacher
            </button>
          </div>
          <button
            onClick={toggleActive}
            disabled={busy}
            className="mt-3 text-sm text-zinc-400 underline hover:text-white"
          >
            {group.is_active ? "Clôturer la ride" : "Rouvrir la ride"}
          </button>
        </section>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {hasRoute && (
          <>
            <StartNavigationButton
              route={group.route_geojson!}
              label={`Naviguer seul · ${group.name}`}
            />
            {group.is_active && (
              <Link
                href={`/groups/${group.id}/ride`}
                className="w-full rounded-xl border border-brand/40 bg-brand/10 py-3 text-center font-semibold text-brand hover:bg-brand/20"
              >
                Ride de groupe (positions live)
              </Link>
            )}
          </>
        )}
        {!isLeader && (
          <button
            onClick={leaveGroup}
            disabled={busy}
            className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-400 hover:border-red-800 hover:text-red-400"
          >
            Quitter le groupe
          </button>
        )}
      </div>
    </div>
  );
}
