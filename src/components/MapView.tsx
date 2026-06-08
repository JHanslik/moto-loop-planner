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
import { memberColor } from "@/lib/groups";
import type { MemberLocation } from "@/lib/groups";
import type { LatLng, Waypoint } from "@/lib/types";

function makeIcon(label: string, color: string, size = 26) {
  return L.divIcon({
    className: "",
    html: `<div class="moto-marker" style="width:${size}px;height:${size}px;background:${color};border:2px solid #18181b;font-size:${size < 30 ? 11 : 12}px">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const startIcon = makeIcon("S", "#f97316");
const wpIcon = (i: number) => makeIcon(String(i + 1), "#3f3f46");
const selfIcon = makeIcon("●", "#f97316", 30);

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

/** Follow the rider position during live navigation. */
function FollowRider({ position }: { position: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.panTo([position.lat, position.lng], { animate: true });
    }
  }, [position, map]);
  return null;
}

interface MapViewProps {
  geometry: [number, number][];
  waypoints: Waypoint[];
  start: LatLng | null;
  animate?: boolean;
  members?: MemberLocation[];
  selfPosition?: LatLng | null;
  followSelf?: boolean;
}

export default function MapView({
  geometry,
  waypoints,
  start,
  animate = true,
  members = [],
  selfPosition = null,
  followSelf = false,
}: MapViewProps) {
  const positions = useMemo(
    () => geometry.map((c) => [c[1], c[0]] as [number, number]),
    [geometry]
  );

  const [shownCount, setShownCount] = useState(
    animate ? 0 : positions.length
  );

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

  const center: [number, number] = selfPosition
    ? [selfPosition.lat, selfPosition.lng]
    : start
      ? [start.lat, start.lng]
      : positions[0] ?? [46.6, 2.4];

  return (
    <MapContainer
      center={center}
      zoom={followSelf ? 14 : 11}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {shownCount > 1 && (
        <Polyline
          positions={positions.slice(0, shownCount)}
          pathOptions={{ color: "#f97316", weight: 5, opacity: 0.9 }}
        />
      )}

      {start && !selfPosition && (
        <Marker position={[start.lat, start.lng]} icon={startIcon}>
          <Popup>Start / Finish</Popup>
        </Marker>
      )}

      {waypoints.map((w, i) => (
        <Marker key={i} position={[w.lat, w.lng]} icon={wpIcon(i)}>
          <Popup>{w.name ? `${i + 1}. ${w.name}` : `Waypoint ${i + 1}`}</Popup>
        </Marker>
      ))}

      {members.map((m) => (
        <Marker
          key={m.userId}
          position={[m.lat, m.lng]}
          icon={makeIcon(
            m.name.charAt(0).toUpperCase(),
            memberColor(m.userId),
            28
          )}
        >
          <Popup>
            <strong>{m.name}</strong>
            {m.speed != null && m.speed > 0 && (
              <div className="text-xs">
                {(m.speed * 3.6).toFixed(0)} km/h
              </div>
            )}
          </Popup>
        </Marker>
      ))}

      {selfPosition && (
        <Marker
          position={[selfPosition.lat, selfPosition.lng]}
          icon={selfIcon}
        >
          <Popup>Vous</Popup>
        </Marker>
      )}

      {followSelf && selfPosition && <FollowRider position={selfPosition} />}
      {!followSelf && <FitBounds positions={positions} />}
    </MapContainer>
  );
}
