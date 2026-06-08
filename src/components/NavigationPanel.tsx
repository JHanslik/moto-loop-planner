"use client";

import type { NavStep } from "@/lib/navigation";
import { formatEta } from "@/lib/navigation";

export default function NavigationPanel({
  step,
  stepIndex,
  totalSteps,
  distanceToStepM,
  remainingM,
  remainingS,
  rerouted,
  offRoute,
  onRecalculate,
  recalculating,
}: {
  step: NavStep | null;
  stepIndex: number;
  totalSteps: number;
  distanceToStepM: number | null;
  remainingM?: number | null;
  remainingS?: number | null;
  rerouted?: boolean;
  offRoute?: boolean;
  onRecalculate?: () => void;
  recalculating?: boolean;
}) {
  if (!step) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 text-sm text-zinc-400">
        En attente du GPS…
      </div>
    );
  }

  const distLabel =
    distanceToStepM != null
      ? distanceToStepM >= 1000
        ? `${(distanceToStepM / 1000).toFixed(1)} km`
        : `${Math.round(distanceToStepM)} m`
      : null;

  return (
    <div className="rounded-xl border border-brand/30 bg-zinc-900/95 p-4 shadow-lg shadow-brand/10 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-brand">
          Navigation · {stepIndex + 1}/{totalSteps}
        </span>
        {rerouted && (
          <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] text-brand">
            Depuis votre position
          </span>
        )}
        {offRoute && (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
            Hors itinéraire
          </span>
        )}
      </div>

      <p className="mt-1 text-lg font-semibold leading-snug break-words">
        {step.instruction}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
        {distLabel && <span>dans {distLabel}</span>}
        {remainingM != null && (
          <span>{(remainingM / 1000).toFixed(1)} km restants</span>
        )}
        {remainingS != null && remainingS > 0 && (
          <span>~{formatEta(remainingS)}</span>
        )}
      </div>

      {(offRoute || onRecalculate) && onRecalculate && (
        <button
          type="button"
          onClick={onRecalculate}
          disabled={recalculating}
          className="mt-3 w-full rounded-lg border border-zinc-600 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 sm:w-auto sm:px-4"
        >
          {recalculating ? "Recalcul…" : "↻ Recalculer depuis ma position"}
        </button>
      )}
    </div>
  );
}
