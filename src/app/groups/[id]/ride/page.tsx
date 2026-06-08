"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import RideNavigationView from "@/components/RideNavigationView";
import { useAuth } from "@/components/AuthProvider";
import type { RideGroup } from "@/lib/groups";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export default function GroupRidePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<RideGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const displayName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Rider";

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

  const syncSharing = async (next: boolean) => {
    setSharing(next);
    if (!supabase || !user || !id) return;
    await supabase
      .from("group_members")
      .update({ sharing_location: next })
      .eq("group_id", id)
      .eq("user_id", user.id);
  };

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

  return (
    <RideNavigationView
      route={group.route_geojson}
      title={group.name}
      backHref={`/groups/${id}`}
      backLabel="Quitter"
      groupId={id}
      userId={user.id}
      displayName={displayName}
      sharing={sharing}
      onSharingChange={(v) => void syncSharing(v)}
    />
  );
}
