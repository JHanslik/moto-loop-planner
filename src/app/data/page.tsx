"use client";

import { useState } from "react";
import RouteForm from "@/components/RouteForm";
import OpenDataPanel from "@/components/OpenDataPanel";
import type { GenerateRequest, GenerateResponse, OpenDataReport } from "@/lib/types";

const SOURCES = [
  { name: "OpenStreetMap", detail: "Overpass + Nominatim — POIs & géocodage", license: "ODbL" },
  { name: "OSRM", detail: "Routage sur le réseau routier réel", license: "BSD / OSM" },
  { name: "Photon + BAN", detail: "Autocomplétion d'adresses", license: "ODbL / Licence Ouverte" },
];

export default function DataExplorerPage() {
  const [report, setReport] = useState<OpenDataReport | null>(null);
  const [summary, setSummary] = useState<{ distanceKm: number; score: number } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (req: GenerateRequest) => {
    setLoading(true);
    setError(null);
    setReport(null);
    setSummary(null);
    try {
      const res = await fetch("/api/generate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recherche échouée.");
      const { route, openData } = data as GenerateResponse;
      setReport(openData);
      setSummary({ distanceKm: route.distanceKm, score: route.score });
    } catch (e: any) {
      setError(e.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Explorateur open data</h1>
        <p className="mt-2 max-w-prose text-sm text-zinc-400">
          Lancez une recherche : l&apos;app interroge en direct des jeux de{" "}
          <span className="text-zinc-200">données ouvertes</span> pour construire
          une boucle, et cette page vous montre exactement{" "}
          <span className="text-zinc-200">ce qui a été récupéré et d&apos;où</span>.
          Aucune base privée, sources et licences affichées.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <div
              key={s.name}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs"
            >
              <span className="font-semibold text-zinc-200">{s.name}</span>{" "}
              <span className="text-zinc-500">· {s.detail}</span>{" "}
              <span className="text-zinc-600">({s.license})</span>
            </div>
          ))}
        </div>
      </header>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">
          Vérifier les données pour un point de départ
        </h2>
        <RouteForm onGenerate={run} loading={loading} />
      </div>

      {loading && (
        <p className="mt-6 text-sm text-zinc-500">
          Interrogation des sources open data…
        </p>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {report && (
        <div className="mt-6 space-y-4">
          {summary && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
              <span className="text-zinc-400">Boucle construite à partir de ces données :</span>
              <span className="font-semibold text-zinc-100">
                {summary.distanceKm} km
              </span>
              <span className="rounded-lg bg-brand/10 px-2 py-0.5 font-bold text-brand">
                Fun score {summary.score}
              </span>
              <a href="/planner" className="ml-auto text-xs text-brand hover:underline">
                Tracer cette boucle sur la carte →
              </a>
            </div>
          )}
          <OpenDataPanel report={report} />
        </div>
      )}
    </div>
  );
}
