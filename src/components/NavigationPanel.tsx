"use client";

import type { NavStep } from "@/lib/navigation";

export default function NavigationPanel({
  step,
  stepIndex,
  totalSteps,
  distanceToStepM,
}: {
  step: NavStep | null;
  stepIndex: number;
  totalSteps: number;
  distanceToStepM: number | null;
}) {
  if (!step) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 text-sm text-zinc-400">
        En attente du GPS…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand/30 bg-zinc-900/95 p-4 shadow-lg shadow-brand/10 backdrop-blur">
      <div className="mb-1 text-xs uppercase tracking-wide text-brand">
        Navigation · étape {stepIndex + 1}/{totalSteps}
      </div>
      <p className="text-lg font-semibold leading-snug">{step.instruction}</p>
      {distanceToStepM != null && (
        <p className="mt-2 text-sm text-zinc-400">
          dans {(distanceToStepM / 1000).toFixed(1)} km
        </p>
      )}
    </div>
  );
}
