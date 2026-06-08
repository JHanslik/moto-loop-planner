"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import type { MemberLocation, PresenceMeta } from "@/lib/groups";

const BROADCAST_INTERVAL_MS = 2000;

export function useGroupRealtime(
  groupId: string | null,
  userId: string | null,
  displayName: string,
  sharing: boolean
) {
  const [online, setOnline] = useState<PresenceMeta[]>([]);
  const [locations, setLocations] = useState<Map<string, MemberLocation>>(
    new Map()
  );
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const mergeLocation = useCallback((loc: MemberLocation) => {
    setLocations((prev) => {
      const next = new Map(prev);
      next.set(loc.userId, loc);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!supabase || !groupId || !userId) return;

    const channel = supabase.channel(`group:${groupId}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const users: PresenceMeta[] = [];
        for (const presences of Object.values(state)) {
          for (const p of presences) {
            users.push(p);
          }
        }
        setOnline(users);
      })
      .on("broadcast", { event: "location" }, ({ payload }) => {
        const loc = payload as MemberLocation;
        if (loc?.userId) mergeLocation(loc);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          await channel.track({
            user_id: userId,
            name: displayName,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      setConnected(false);
      void channel.untrack();
      void supabase?.removeChannel(channel);
      channelRef.current = null;
    };
  }, [groupId, userId, displayName, mergeLocation]);

  useEffect(() => {
    if (!sharing || !userId || !connected) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) return;

    const send = (pos: GeolocationPosition) => {
      const loc: MemberLocation = {
        userId,
        name: displayName,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading ?? undefined,
        speed: pos.coords.speed ?? undefined,
        at: Date.now(),
      };
      mergeLocation(loc);
      channelRef.current?.send({
        type: "broadcast",
        event: "location",
        payload: loc,
      });
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      send,
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(send, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 500,
      });
    }, BROADCAST_INTERVAL_MS);

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      clearInterval(interval);
    };
  }, [sharing, userId, displayName, connected, mergeLocation]);

  return {
    online,
    locations: Array.from(locations.values()),
    connected,
  };
}
