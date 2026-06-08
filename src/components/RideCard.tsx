"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { STYLES, type Comment, type Ride } from "@/lib/types";
import ExportButtons from "./ExportButtons";
import StartNavigationButton from "./StartNavigationButton";

export default function RideCard({
  ride,
  currentUserId,
  likedByMe = false,
  mode,
  onChange,
}: {
  ride: Ride;
  currentUserId?: string | null;
  likedByMe?: boolean;
  mode: "feed" | "mine";
  onChange?: () => void;
}) {
  const style = STYLES.find((s) => s.id === ride.style);
  const [liked, setLiked] = useState(likedByMe);
  const [likeCount, setLikeCount] = useState(ride.like_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleLike = async () => {
    if (!supabase || !currentUserId) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    if (next) {
      await supabase.from("likes").insert({ ride_id: ride.id, user_id: currentUserId });
    } else {
      await supabase
        .from("likes")
        .delete()
        .eq("ride_id", ride.id)
        .eq("user_id", currentUserId);
    }
  };

  const loadComments = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, author:profiles(name)")
      .eq("ride_id", ride.id)
      .order("created_at", { ascending: true });
    setComments(
      (data ?? []).map((c: any) => ({
        ...c,
        author_name: c.author?.name ?? null,
      }))
    );
  };

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) await loadComments();
  };

  const addComment = async () => {
    if (!supabase || !currentUserId || !newComment.trim()) return;
    setBusy(true);
    await supabase
      .from("comments")
      .insert({ ride_id: ride.id, user_id: currentUserId, content: newComment.trim() });
    setNewComment("");
    await loadComments();
    setBusy(false);
  };

  const saveToMyRides = async () => {
    if (!supabase || !currentUserId) return;
    setBusy(true);
    await supabase.from("rides").insert({
      user_id: currentUserId,
      name: ride.name,
      distance_km: ride.distance_km,
      duration_min: ride.duration_min,
      route_geojson: ride.route_geojson,
      score: ride.score,
      style: ride.style,
      start_name: ride.start_name,
      is_public: false,
    });
    setSaved(true);
    setBusy(false);
  };

  const togglePublic = async () => {
    if (!supabase) return;
    setBusy(true);
    await supabase
      .from("rides")
      .update({ is_public: !ride.is_public })
      .eq("id", ride.id);
    setBusy(false);
    onChange?.();
  };

  const deleteRide = async () => {
    if (!supabase) return;
    if (!confirm("Delete this ride?")) return;
    setBusy(true);
    await supabase.from("rides").delete().eq("id", ride.id);
    setBusy(false);
    onChange?.();
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{ride.name}</h3>
          <p className="truncate text-xs text-zinc-500">
            {style ? `${style.emoji} ${style.label}` : ""}
            {ride.start_name ? ` · from ${ride.start_name}` : ""}
            {mode === "feed" && ride.author_name ? ` · by ${ride.author_name}` : ""}
          </p>
        </div>
        <div className="shrink-0 rounded-lg bg-brand/10 px-2.5 py-1 text-sm font-bold text-brand">
          {ride.score}
        </div>
      </div>

      <div className="mt-3 flex gap-4 text-sm text-zinc-300">
        <span>📏 {ride.distance_km} km</span>
        <span>⏱️ {ride.duration_min} min</span>
      </div>

      <div className="mt-3 space-y-2">
        <StartNavigationButton
          route={ride.route_geojson}
          label={ride.name}
          rideId={ride.id}
        />
        <ExportButtons route={ride.route_geojson} name={ride.name} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {mode === "feed" && (
          <>
            <button
              onClick={toggleLike}
              disabled={!currentUserId}
              title={currentUserId ? "" : "Sign in to like"}
              className={`rounded-lg border px-2.5 py-1 transition disabled:opacity-50 ${
                liked
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              ❤️ {likeCount}
            </button>
            <button
              onClick={toggleComments}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-zinc-300 transition hover:bg-zinc-800"
            >
              💬 {ride.comment_count ?? 0}
            </button>
            {currentUserId && (
              <button
                onClick={saveToMyRides}
                disabled={busy || saved}
                className="rounded-lg border border-zinc-700 px-2.5 py-1 text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {saved ? "✓ Saved" : "💾 Save to my rides"}
              </button>
            )}
          </>
        )}

        {mode === "mine" && (
          <>
            <button
              onClick={togglePublic}
              disabled={busy}
              className="rounded-lg border border-zinc-700 px-2.5 py-1 text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {ride.is_public ? "🌍 Public" : "🔒 Private"}
            </button>
            <button
              onClick={deleteRide}
              disabled={busy}
              className="rounded-lg border border-red-900/60 px-2.5 py-1 text-red-400 transition hover:bg-red-950/40 disabled:opacity-50"
            >
              🗑️ Delete
            </button>
          </>
        )}
      </div>

      {showComments && (
        <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
          {comments.length === 0 && (
            <p className="text-xs text-zinc-500">No comments yet.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium text-zinc-300">
                {c.author_name ?? "Rider"}
              </span>{" "}
              <span className="text-zinc-400">{c.content}</span>
            </div>
          ))}
          {currentUserId ? (
            <div className="flex gap-2 pt-1">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                placeholder="Add a comment…"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={addComment}
                disabled={busy || !newComment.trim()}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Post
              </button>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Sign in to comment.</p>
          )}
        </div>
      )}
    </div>
  );
}
