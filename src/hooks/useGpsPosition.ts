"use client";

import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/types";

export function useGpsPosition(enabled = true) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) {
      if (enabled && !navigator.geolocation) {
        setError("GPS non disponible sur cet appareil.");
      }
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      setError(null);
      setPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    };

    const onError = () => {
      setError("Impossible d'accéder au GPS. Autorisez la localisation.");
    };

    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 15000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return { position, error };
}
