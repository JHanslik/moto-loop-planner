"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { generateInviteCode, type RideGroup } from "@/lib/groups";
import type { RouteResult } from "@/lib/types";

export default function GroupsPage() {
  const { user, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<RideGroup[]>([]);
  const [rides, setRides] = useState<{ id: string; name: string; route_geojson: RouteResult }[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [rideId, setRideId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

      const ids = (memberships ?? []).map((m) => m.group_id);
      if (ids.length) {
        const { data } = await supabase
          .from("ride_groups")
          .select("*")
          .in("id", ids)
          .order("created_at", { ascending: false });
        setGroups((data as RideGroup[]) ?? []);
      }

      const { data: myRides } = await supabase
        .from("rides")
        .select("id, name, route_geojson")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setRides((myRides as typeof rides) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const createGroup = async () => {
    if (!supabase || !user || !name.trim()) return;
    setBusy(true);
    setMsg(null);
    const selected = rides.find((r) => r.id === rideId);
    let code = generateInviteCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase
        .from("ride_groups")
        .insert({
          name: name.trim(),
          invite_code: code,
          leader_id: user.id,
          ride_id: rideId || null,
          route_geojson: selected?.route_geojson ?? null,
        })
        .select()
        .single();

      if (!error && data) {
        await supabase.from("group_members").insert({
          group_id: data.id,
          user_id: user.id,
          role: "leader",
          sharing_location: false,
        });
        setGroups((g) => [data as RideGroup, ...g]);
        setName("");
        setRideId("");
        setMsg(`Groupe créé — code ${code}`);
        setBusy(false);
        return;
      }
      if (error?.code === "23505") {
        code = generateInviteCode();
        continue;
      }
      setMsg(error?.message ?? "Erreur création");
      break;
    }
    setBusy(false);
  };

  const joinGroup = async () => {
    if (!supabase || !user || !joinCode.trim()) return;
    setBusy(true);
    setMsg(null);
    const code = joinCode.trim().toUpperCase();
    const { data: group, error } = await supabase
      .from("ride_groups")
      .select("*")
      .eq("invite_code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !group) {
      setMsg("Code invalide ou groupe inactif.");
      setBusy(false);
      return;
    }

    const { error: joinErr } = await supabase.from("group_members").upsert({
      group_id: group.id,
      user_id: user.id,
      role: "member",
      sharing_location: false,
    });

    if (joinErr) {
      setMsg(joinErr.message);
    } else {
      setGroups((g) =>
        g.some((x) => x.id === group.id) ? g : [group as RideGroup, ...g]
      );
      setJoinCode("");
      setMsg(`Rejoint « ${group.name} »`);
    }
    setBusy(false);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Group Ride</h1>
        <p className="mt-4 text-zinc-400">
          Configure Supabase pour créer des groupes et partager votre position en direct.
        </p>
      </div>
    );
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Group Ride</h1>
        <p className="mt-4 text-zinc-400">
          <Link href="/auth" className="text-brand hover:underline">Connectez-vous</Link>{" "}
          pour créer ou rejoindre un groupe.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl overflow-x-hidden px-4 py-8">
      <h1 className="text-2xl font-bold">Group Ride</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Roulez en groupe — positions live sur la carte, navigation open data.
      </p>

      {msg && (
        <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
          {msg}
        </div>
      )}

      <div className="mt-6 space-y-6">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="font-semibold">Créer un groupe</h2>
          <div className="mt-3 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du groupe (ex. Sortie Alpes)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <select
              value={rideId}
              onChange={(e) => setRideId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Route optionnelle (mes rides sauvegardées)</option>
              {rides.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              onClick={createGroup}
              disabled={busy || !name.trim()}
              className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Créer
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="font-semibold">Rejoindre avec un code</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-brand"
            />
            <button
              onClick={joinGroup}
              disabled={busy || joinCode.length < 4}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
            >
              Rejoindre
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Mes groupes</h2>
          {loading ? (
            <p className="text-sm text-zinc-500">Chargement…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucun groupe pour l&apos;instant.</p>
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 transition hover:border-zinc-600"
                  >
                    <span className="font-medium">{g.name}</span>
                    <span className="font-mono text-xs text-brand">{g.invite_code}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
