"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  activeStepIndex,
  distanceM,
  distanceToPolylineM,
  isReroutedFromPosition,
  navPointsForRoute,
  OFF_ROUTE_THRESHOLD_M,
  remainingDistanceM,
  type NavRoute,
} from "@/lib/navigation";
import type { LatLng, RouteResult } from "@/lib/types";
import { useGpsPosition } from "./useGpsPosition";

export function useRouteNavigation(route: RouteResult | null) {
  const { position: selfPos, error: gpsError } = useGpsPosition(!!route);
  const [nav, setNav] = useState<NavRoute | null>(null);
  const [navLoading, setNavLoading] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);
  const [rerouted, setRerouted] = useState(false);
  const initialDone = useRef(false);

  const loadNav = useCallback(
    async (fromPos?: LatLng | null) => {
      if (!route) return;
      setNavLoading(true);
      setNavError(null);
      const points = navPointsForRoute(route, fromPos);
      try {
        const res = await fetch("/api/navigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Navigation impossible.");
        setNav(data as NavRoute);
        setRerouted(
          !!fromPos && isReroutedFromPosition(route, fromPos)
        );
      } catch (e: unknown) {
        setNavError(
          e instanceof Error ? e.message : "Erreur de navigation."
        );
      } finally {
        setNavLoading(false);
      }
    },
    [route]
  );

  // First calculation once GPS is available (reroute if far from start)
  useEffect(() => {
    if (!route || !selfPos || initialDone.current) return;
    initialDone.current = true;
    void loadNav(selfPos);
  }, [route, selfPos, loadNav]);

  const recalculate = useCallback(() => {
    if (selfPos) void loadNav(selfPos);
    else void loadNav(null);
  }, [selfPos, loadNav]);

  const stepIndex =
    nav?.steps.length && selfPos
      ? activeStepIndex(nav.steps, selfPos)
      : 0;

  const currentStep = nav?.steps[stepIndex] ?? null;
  const distToStep =
    selfPos && currentStep
      ? distanceM(selfPos, currentStep.location)
      : null;

  const remainingM = nav?.steps.length
    ? remainingDistanceM(nav.steps, stepIndex)
    : null;

  const offRoute =
    selfPos && nav?.geometry.length
      ? distanceToPolylineM(selfPos, nav.geometry) > OFF_ROUTE_THRESHOLD_M
      : false;

  const displayGeometry = nav?.geometry ?? route?.geometry ?? [];

  return {
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
  };
}
