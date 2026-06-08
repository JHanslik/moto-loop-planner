"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { wazeLegs } from "@/lib/exportLinks";
import type { RouteResult } from "@/lib/types";

export default function WazeExportButton({ route }: { route: RouteResult }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const legs = useMemo(() => wazeLegs(route), [route]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={panelRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center justify-center gap-1 rounded-lg border border-zinc-700 px-1 py-2 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-800 sm:text-xs"
        aria-expanded={open}
      >
        🚗 Waze
        {legs.length > 1 && (
          <span className="text-[10px] text-zinc-500">({legs.length})</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-xl sm:left-auto sm:right-0 sm:min-w-[260px]">
          <p className="mb-2 px-1 text-[10px] leading-snug text-zinc-500">
            Waze ne gère qu&apos;une destination par lien. Ouvrez chaque étape
            de la boucle :
          </p>
          <ul className="space-y-1">
            {legs.map((leg) => (
              <li key={leg.index}>
                <a
                  href={leg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
                >
                  <span className="font-medium text-brand">{leg.index}.</span>{" "}
                  <span className="break-words">
                    {leg.fromLabel} → {leg.toLabel}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
