import type { RouteResult } from "./types";

export interface RideGroup {
  id: string;
  name: string;
  invite_code: string;
  leader_id: string;
  ride_id: string | null;
  route_geojson: RouteResult | null;
  is_active: boolean;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: "leader" | "member";
  sharing_location: boolean;
  joined_at: string;
  profiles?: { name: string | null; email: string | null } | null;
}

export interface MemberLocation {
  userId: string;
  name: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  at: number;
}

export interface PresenceMeta {
  user_id: string;
  name: string;
  online_at: string;
}

const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return code;
}

const MEMBER_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#eab308",
];

export function memberColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i) * (i + 1)) % MEMBER_COLORS.length;
  }
  return MEMBER_COLORS[hash];
}
