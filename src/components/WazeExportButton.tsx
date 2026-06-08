"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { wazeLegs } from "@/lib/exportLinks";
import type { RouteResult } from "@/lib/types";

export default function WazeExportButton({ route }: { route: RouteResult }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const legs = useMemo(() => wazeLegs(route), [route]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Une seule étape → lien direct comme Google Maps
  if (legs.length === 1) {
    return (
      <a
        href={legs[0].url}
        className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-zinc-700 px-1 py-2 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-800 sm:text-xs"
      >
        🚗 Waze
      </a>
    );
  }

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Exporter vers Waze"
          >
            <div
              className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:max-w-md sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Ouvrir dans Waze</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    Waze ne gère qu&apos;une destination à la fois. Choisis
                    l&apos;étape à lancer — enchaîne les suivantes une fois
                    arrivé.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>

              <ul className="space-y-2">
                {legs.map((leg) => (
                  <li key={leg.index}>
                    <a
                      href={leg.url}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3.5 text-left transition hover:border-brand/40 hover:bg-zinc-800"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-bold text-brand">
                        {leg.index}
                      </span>
                      <span className="min-w-0 text-sm leading-snug text-zinc-100">
                        <span className="block text-zinc-500">{leg.fromLabel}</span>
                        <span className="block font-medium">→ {leg.toLabel}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full min-w-0 items-center justify-center gap-1 rounded-lg border border-zinc-700 px-1 py-2 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-800 sm:text-xs"
      >
        🚗 Waze
        <span className="text-[10px] text-zinc-500">({legs.length})</span>
      </button>
      {modal}
    </>
  );
}
