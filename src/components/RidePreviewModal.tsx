"use client";

import dynamic from "next/dynamic";
import { useEffect, type ReactNode } from "react";
import RouteStats from "@/components/RouteStats";
import ExportButtons from "@/components/ExportButtons";
import StartNavigationButton from "@/components/StartNavigationButton";
import type { Ride } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-zinc-500">
      Carte…
    </div>
  ),
});

export default function RidePreviewModal({
  ride,
  onClose,
  footer,
}: {
  ride: Ride;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const route = ride.route_geojson;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-zinc-950"
      role="dialog"
      aria-modal="true"
      aria-label={`Carte — ${ride.name}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{ride.name}</h2>
          <p className="truncate text-xs text-zinc-500">
            {ride.start_name ?? route.startName}
            {ride.author_name ? ` · par ${ride.author_name}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700"
        >
          Fermer
        </button>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_340px]">
        <div className="relative min-h-[40vh] lg:min-h-0">
          <MapView
            geometry={route.geometry}
            waypoints={route.waypoints}
            start={route.start}
            animate={false}
          />
        </div>

        <aside className="overflow-y-auto border-t border-zinc-800 p-4 lg:border-l lg:border-t-0">
          <RouteStats route={route} />
          <div className="mt-4 space-y-2">
            <StartNavigationButton
              route={route}
              label={ride.name}
              rideId={ride.id}
            />
            <ExportButtons route={route} name={ride.name} />
          </div>
          {footer && <div className="mt-4 border-t border-zinc-800 pt-4">{footer}</div>}
        </aside>
      </div>
    </div>
  );
}
