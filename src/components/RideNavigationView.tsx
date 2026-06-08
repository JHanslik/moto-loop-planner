"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import NavigationPanel from "@/components/NavigationPanel";
import { useGroupRealtime } from "@/hooks/useGroupRealtime";
import { useRouteNavigation } from "@/hooks/useRouteNavigation";
import { clearNavRoute } from "@/lib/navStorage";
import type { MemberLocation } from "@/lib/groups";
import type { RouteResult } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-zinc-500">
      Carte…
    </div>
  ),
});

interface RideNavigationViewProps {
  route: RouteResult;
  title: string;
  backHref: string;
  backLabel?: string;
  onExit?: () => void;
  /** Optional group ride: share position with members */
  groupId?: string;
  userId?: string;
  displayName?: string;
  sharing?: boolean;
  onSharingChange?: (sharing: boolean) => void;
  headerExtra?: ReactNode;
}

export default function RideNavigationView({
  route,
  title,
  backHref,
  backLabel = "Quitter",
  onExit,
  groupId,
  userId,
  displayName = "Rider",
  sharing = false,
  onSharingChange,
  headerExtra,
}: RideNavigationViewProps) {
  const router = useRouter();
  const {
    selfPos,
    gpsError,
    nav,
    navLoading,
    navError,
    rerouted,
    recalculate,
    stepIndex,
    currentStep,
    distToStep,
    remainingM,
    offRoute,
    displayGeometry,
  } = useRouteNavigation(route);

  const groupRealtime = useGroupRealtime(
    groupId ?? null,
    userId ?? null,
    displayName,
    sharing
  );

  const members: MemberLocation[] = groupId
    ? groupRealtime.locations.filter((m) => m.userId !== userId)
    : [];

  // Keep screen awake during navigation (useful on mobile)
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator) {
          lock = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* ignored */
      }
    };
    void request();
    return () => {
      void lock?.release();
    };
  }, []);

  const exit = () => {
    clearNavRoute();
    onExit?.();
    router.push(backHref);
  };

  const remainingS = nav?.steps.length
    ? nav.steps.slice(stepIndex).reduce((s, st) => s + st.durationS, 0)
    : null;

  return (
    <div className="relative h-[calc(100vh-3.5rem)] overflow-hidden">
      <MapView
        geometry={displayGeometry}
        waypoints={route.waypoints}
        start={route.start}
        animate={false}
        members={members}
        selfPosition={selfPos}
        followSelf
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] max-w-full space-y-2 p-3">
        <div className="pointer-events-auto flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={exit}
              className="shrink-0 rounded-lg bg-zinc-950/90 px-3 py-2 text-sm text-zinc-300 backdrop-blur hover:text-white"
            >
              ✕ {backLabel}
            </button>
            <span className="min-w-0 truncate text-sm font-medium text-zinc-300">
              {title}
            </span>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {headerExtra}
            {groupId && onSharingChange && (
              <>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    groupRealtime.connected
                      ? "bg-green-500/20 text-green-400"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {groupRealtime.connected
                    ? `${groupRealtime.online.length} en ligne`
                    : "…"}
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-zinc-950/90 px-2.5 py-2 text-xs backdrop-blur sm:text-sm">
                  <input
                    type="checkbox"
                    checked={sharing}
                    onChange={(e) => onSharingChange(e.target.checked)}
                    className="accent-brand"
                  />
                  Partager GPS
                </label>
              </>
            )}
          </div>
        </div>

        {(gpsError || navError) && (
          <div className="pointer-events-auto rounded-lg border border-red-900/60 bg-red-950/80 px-3 py-2 text-sm text-red-300">
            {gpsError ?? navError}
          </div>
        )}

        <div className="pointer-events-auto w-full max-w-md">
          {navLoading && !nav ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 text-sm text-zinc-500">
              Calcul de l&apos;itinéraire…
            </div>
          ) : (
            <NavigationPanel
              step={currentStep}
              stepIndex={stepIndex}
              totalSteps={nav?.steps.length ?? 0}
              distanceToStepM={distToStep}
              remainingM={remainingM}
              remainingS={remainingS}
              rerouted={rerouted}
              offRoute={offRoute}
              onRecalculate={recalculate}
              recalculating={navLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}

