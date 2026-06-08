import type { RouteResult } from "./types";

const KEY = "mlp-nav-route";

export function storeNavRoute(route: RouteResult, label?: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    KEY,
    JSON.stringify({ route, label: label ?? route.startName })
  );
}

export function readNavRoute(): { route: RouteResult; label: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { route: RouteResult; label?: string };
    if (!parsed?.route?.start) return null;
    return {
      route: parsed.route,
      label: parsed.label ?? parsed.route.startName,
    };
  } catch {
    return null;
  }
}

export function clearNavRoute() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
