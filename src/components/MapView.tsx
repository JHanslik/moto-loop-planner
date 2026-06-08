"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { LatLng, Waypoint } from "@/lib/types";

function makeIcon(label: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div class="moto-marker" style="width:26px;height:26px;background:${color};border:2px solid #18181b">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

const startIcon = makeIcon("S", "#f97316");
const wpIcon = (i: number) => makeIcon(String(i + 1), "#3f3f46");

/** Fit the map to the route whenever it changes. */
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions as L.LatLngBoundsExpression, {
        padding: [40, 40],
      });
    }
  }, [positions, map]);
  return null;
}

interface MapViewProps {
  geometry: [number, number][]; // [lng, lat]
  waypoints: Waypoint[];
  start: LatLng | null;
  animate?: boolean;
}

export default function MapView({
  geometry,
  waypoints,
  start,
  animate = true,
}: MapViewProps) {
  // Leaflet wants [lat, lng]; our geometry is [lng, lat].
  const positions = useMemo(
    () => geometry.map((c) => [c[1], c[0]] as [number, number]),
    [geometry]
  );

  const [shownCount, setShownCount] = useState(
    animate ? 0 : positions.length
  );

  // Progressive "draw" animation of the polyline.
  useEffect(() => {
    if (!animate || positions.length === 0) {
      setShownCount(positions.length);
      return;
    }
    setShownCount(0);
    const step = Math.max(1, Math.floor(positions.length / 60));
    let i = 0;
    const id = setInterval(() => {
      i += step;
      setShownCount(Math.min(i, positions.length));
      if (i >= positions.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [positions, animate]);

  const center: [number, number] = start
    ? [start.lat, start.lng]
    : positions[0] ?? [46.6, 2.4]; // fallback: center of France

  return (
    <MapContainer
      center={center}
      zoom={11}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {shownCount > 1 && (
        <Polyline
          positions={positions.slice(0, shownCount)}
          pathOptions={{ color: "#f97316", weight: 5, opacity: 0.9 }}
        />
      )}

      {start && (
        <Marker position={[start.lat, start.lng]} icon={startIcon}>
          <Popup>Start / Finish</Popup>
        </Marker>
      )}

      {waypoints.map((w, i) => (
        <Marker key={i} position={[w.lat, w.lng]} icon={wpIcon(i)}>
          <Popup>{w.name ? `${i + 1}. ${w.name}` : `Waypoint ${i + 1}`}</Popup>
        </Marker>
      ))}

      <FitBounds positions={positions} />
    </MapContainer>
  );
}
