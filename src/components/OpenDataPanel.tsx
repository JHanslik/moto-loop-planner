"use client";

import { useMemo, useState } from "react";
import type { OpenDataReport } from "@/lib/types";

const CATEGORY_EMOJI: Record<string, string> = {
  Patrimoine: "🏰",
  "Point de vue / curiosité": "🌄",
  "Nature remarquable": "⛰️",
  "Village historique": "🏛️",
  "Détente / nature": "🌿",
  "Village / hameau": "🏘️",
  Autre: "📍",
};

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold text-zinc-100">{value}</div>
      {sub && <div className="text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function SectionTitle({
  step,
  title,
  hint,
}: {
  step: number;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand/15 text-[11px] font-bold text-brand">
        {step}
      </span>
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  );
}

export default function OpenDataPanel({ report }: { report: OpenDataReport }) {
  const [showQuery, setShowQuery] = useState(false);
  const [showAllPois, setShowAllPois] = useState(false);

  // Used POIs first, then by interest (heritage/viewpoints before villages).
  const sortedPois = useMemo(() => {
    return [...report.pois.records].sort((a, b) => {
      if (a.usedInRoute !== b.usedInRoute) return a.usedInRoute ? -1 : 1;
      if (a.interest !== b.interest) return b.interest - a.interest;
      return a.name.localeCompare(b.name);
    });
  }, [report.pois.records]);

  const visiblePois = showAllPois ? sortedPois : sortedPois.slice(0, 12);
  const maxCat = Math.max(1, ...report.pois.byCategory.map((c) => c.count));

  // Winner's position within the candidate score range (winner = max, so ~100%).
  const { scoreMin, scoreMax, winnerScore } = report.selection;
  const winnerPos =
    scoreMax > scoreMin
      ? ((winnerScore - scoreMin) / (scoreMax - scoreMin)) * 100
      : 100;

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `open-data-${report.query.resolvedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-100">
            🛰️ Données open data
          </h2>
          <p className="mt-1 max-w-prose text-xs text-zinc-400">
            Tout ce qui suit a été récupéré en direct depuis des sources
            publiques pour <span className="text-zinc-200">cette recherche</span>{" "}
            — aucune base privée, aucune donnée inventée.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadJson}
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-brand/50 hover:text-white"
        >
          ⬇ Dossier JSON
        </button>
      </div>

      {/* Sources strip */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {report.sources.map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noreferrer noopener"
            className="group rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 transition hover:border-brand/40"
          >
            <div className="text-xs font-semibold text-zinc-200 group-hover:text-brand">
              {s.name}
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">{s.role}</div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">
              {s.license}
            </div>
          </a>
        ))}
      </div>

      {/* 1. Geocoding */}
      <div className="space-y-2">
        <SectionTitle step={1} title="Géocodage du départ" hint={report.geocoding.provider} />
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
          <code className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
            {report.geocoding.input}
          </code>
          <span className="text-zinc-600">→</span>
          <span className="text-zinc-200">{report.geocoding.result}</span>
          <span className="text-zinc-600">→</span>
          <code className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-brand">
            {report.geocoding.lat.toFixed(5)}, {report.geocoding.lng.toFixed(5)}
          </code>
        </div>
      </div>

      {/* 2. POIs (Overpass) */}
      <div className="space-y-3">
        <SectionTitle
          step={2}
          title="Points d'intérêt (Overpass / OSM)"
          hint={`rayon ${report.pois.searchRadiusKm} km`}
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="POIs trouvés" value={report.pois.totalFound} />
          <StatTile
            label="Sur le tracé"
            value={report.pois.usedInRoute}
            sub="traversés par la boucle"
          />
          <StatTile label="Catégories" value={report.pois.byCategory.length} />
          <StatTile
            label="Rayon scanné"
            value={`${report.pois.searchRadiusKm} km`}
          />
        </div>

        {/* Category breakdown bars */}
        {report.pois.byCategory.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            {report.pois.byCategory.map((c) => (
              <div key={c.category} className="flex items-center gap-2 text-xs">
                <span className="w-44 shrink-0 text-zinc-300">
                  {CATEGORY_EMOJI[c.category] ?? "📍"} {c.category}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-brand/70"
                    style={{ width: `${(c.count / maxCat) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right tabular-nums text-zinc-400">
                  {c.count}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* POI table */}
        {sortedPois.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Nom</th>
                  <th className="px-3 py-2 font-medium">Catégorie</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">
                    Coordonnées
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Tracé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {visiblePois.map((p, i) => (
                  <tr
                    key={`${p.name}-${i}`}
                    className={p.usedInRoute ? "bg-brand/[0.06]" : ""}
                  >
                    <td className="px-3 py-1.5 text-zinc-200">{p.name}</td>
                    <td className="px-3 py-1.5 text-zinc-400">
                      {p.interest === 3 ? "⭐ " : ""}
                      {CATEGORY_EMOJI[p.category] ?? "📍"} {p.category}
                    </td>
                    <td className="hidden px-3 py-1.5 font-mono text-[11px] text-zinc-500 sm:table-cell">
                      {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {p.usedInRoute ? (
                        <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                          ✓ passé
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedPois.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAllPois((v) => !v)}
                className="w-full border-t border-zinc-800 bg-zinc-900/60 py-2 text-xs text-zinc-400 transition hover:text-white"
              >
                {showAllPois
                  ? "Réduire"
                  : `Voir les ${sortedPois.length} POIs`}
              </button>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-500">
            Aucun POI nommé dans ce rayon — la boucle a utilisé des points
            géométriques de repli.
          </p>
        )}

        {/* Raw Overpass query */}
        <div>
          <button
            type="button"
            onClick={() => setShowQuery((v) => !v)}
            className="text-xs text-zinc-400 transition hover:text-brand"
          >
            {showQuery ? "▾" : "▸"} Requête Overpass QL exécutée
          </button>
          {showQuery && (
            <pre className="mt-2 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-300">
              {report.pois.overpassQuery}
            </pre>
          )}
        </div>
      </div>

      {/* 3. Routing (OSRM) */}
      <div className="space-y-3">
        <SectionTitle
          step={3}
          title="Itinéraire (OSRM)"
          hint={`${report.routing.candidatesTried} candidats testés`}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Distance" value={`${report.routing.distanceKm} km`} />
          <StatTile label="Durée" value={`${report.routing.durationMin} min`} />
          <StatTile
            label="Points GPS"
            value={report.routing.geometryPoints}
            sub="géométrie tracée"
          />
          <StatTile
            label="Petites routes"
            value={`${report.routing.smallRoadsPct}%`}
            sub={`${report.routing.mainRoadsPct}% axes · ${report.routing.highwayPct}% voie rapide`}
          />
        </div>
      </div>

      {/* 4. How the loop is chosen */}
      <div className="space-y-3">
        <SectionTitle
          step={4}
          title="Comment la boucle est choisie"
          hint={`meilleure sur ${report.selection.candidatesRouted}`}
        />
        <ol className="space-y-1.5">
          {report.selection.steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-xs text-zinc-300">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] font-bold text-zinc-400">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        {/* Where the winner sits in the candidate field */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span>
              {report.selection.candidatesRouted} boucles routées · fun score
            </span>
            <span className="tabular-nums">
              {report.selection.scoreMin} → {report.selection.scoreMax}
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-zinc-800">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-zinc-700 to-brand"
              style={{ width: `${winnerPos}%` }}
            />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-950 bg-brand shadow"
              style={{ left: `${winnerPos}%` }}
              title={`Boucle retenue : ${report.selection.winnerScore}/100`}
            />
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            La boucle retenue est celle au{" "}
            <span className="text-brand">fun score le plus élevé</span> (
            {report.selection.winnerScore}/100). À score égal, c&apos;est la plus
            riche en points d&apos;intérêt qui gagne.
          </p>
        </div>
      </div>

      {/* 5. Fun score breakdown */}
      <div className="space-y-3">
        <SectionTitle
          step={5}
          title="Détail du fun score"
          hint={`style ${report.scoreExplanation.style}`}
        />

        <div className="flex items-center gap-3 rounded-lg border border-brand/30 bg-brand/[0.06] p-3">
          <div className="text-3xl font-black tabular-nums text-brand">
            {report.scoreExplanation.finalScore}
          </div>
          <div className="text-xs text-zinc-400">
            <div className="font-semibold text-zinc-200">Fun score / 100</div>
            Fun score = Σ (composante × poids){" "}
            {report.scoreExplanation.malusApplied
              ? "× malus axes rapides"
              : "— aucun malus"}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Composante</th>
                <th className="px-3 py-2 font-medium">Valeur</th>
                <th className="px-3 py-2 text-right font-medium">Poids</th>
                <th className="px-3 py-2 text-right font-medium">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {report.scoreExplanation.terms.map((t) => (
                <tr key={t.key}>
                  <td className="px-3 py-2 text-zinc-200">{t.label}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-brand/70"
                          style={{ width: `${Math.round(t.value * 100)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-zinc-400">
                        {Math.round(t.value * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    ×{t.weight.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-zinc-200">
                    +{t.contribution.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-zinc-800 bg-zinc-900/40 text-zinc-300">
              <tr>
                <td className="px-3 py-2" colSpan={3}>
                  Score de base
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {report.scoreExplanation.baseScore.toFixed(1)}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-zinc-400" colSpan={3}>
                  Malus axes rapides (
                  {Math.round(report.scoreExplanation.fastRoadsFraction * 100)}%
                  rapides)
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                  {report.scoreExplanation.malusApplied
                    ? `×${report.scoreExplanation.malusFactor.toFixed(2)}`
                    : "aucun"}
                </td>
              </tr>
              <tr className="text-brand">
                <td className="px-3 py-2 font-bold" colSpan={3}>
                  Fun score final
                </td>
                <td className="px-3 py-2 text-right text-base font-bold tabular-nums">
                  {report.scoreExplanation.finalScore}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] text-zinc-500">
          Le poids des <span className="text-zinc-300">petites routes</span> est
          volontairement élevé : sur le profil OSRM « le plus rapide », c&apos;est
          le seul levier pour fuir les nationales et privilégier les routes
          tranquilles.
        </p>
      </div>

      <p className="border-t border-zinc-800 pt-3 text-[11px] text-zinc-600">
        Généré le{" "}
        {new Date(report.generatedAt).toLocaleString("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
        })}{" "}
        · Données © les contributeurs OpenStreetMap, sous licence ODbL.
      </p>
    </div>
  );
}
