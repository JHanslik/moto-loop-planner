"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

const links = [
  { href: "/planner", label: "Planner" },
  { href: "/community", label: "Community" },
  { href: "/rides", label: "My Rides" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, signOut, loading } = useAuth();

  return (
    <header className="sticky top-0 z-[1000] border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="text-xl">🏍️</span>
          <span>
            Moto<span className="text-brand">Loop</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 transition ${
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3 text-sm">
          {!isSupabaseConfigured ? (
            <span className="hidden text-xs text-zinc-500 sm:inline">
              Planner-only mode
            </span>
          ) : loading ? null : user ? (
            <>
              <span className="hidden max-w-[160px] truncate text-zinc-400 sm:inline">
                {user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-dark"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
