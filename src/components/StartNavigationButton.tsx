"use client";

import Link from "next/link";
import { storeNavRoute } from "@/lib/navStorage";
import type { RouteResult } from "@/lib/types";

export default function StartNavigationButton({
  route,
  label,
  rideId,
  className,
}: {
  route: RouteResult;
  label?: string;
  rideId?: string;
  className?: string;
}) {
  const href = rideId ? `/navigate?ride=${rideId}` : "/navigate";

  return (
    <Link
      href={href}
      onClick={() => storeNavRoute(route, label)}
      className={
        className ??
        "flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2 text-xs font-semibold text-white transition hover:bg-brand-dark sm:text-sm"
      }
    >
      🧭 {label ?? "Naviguer"}
    </Link>
  );
}
