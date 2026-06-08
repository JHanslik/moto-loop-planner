"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

const links = [
  { href: "/planner", label: "Planner" },
  { href: "/community", label: "Community" },
  { href: "/rides", label: "My Rides" },
];

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block rounded-md px-3 py-2 transition md:inline-block md:py-1.5 ${
        active
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function AuthSection({
  mobile,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const { user, signOut, loading } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <span
        className={`text-xs text-zinc-500 ${mobile ? "px-3 py-2" : "hidden sm:inline"}`}
      >
        Planner-only mode
      </span>
    );
  }

  if (loading) return null;

  if (user) {
    return (
      <div
        className={
          mobile
            ? "flex flex-col gap-2 border-t border-zinc-800 px-3 py-3"
            : "flex items-center gap-3"
        }
      >
        <span
          className={
            mobile
              ? "truncate text-sm text-zinc-400"
              : "hidden max-w-[160px] truncate text-zinc-400 sm:inline"
          }
        >
          {user.email}
        </span>
        <button
          onClick={() => {
            void signOut();
            onNavigate?.();
          }}
          className={`rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 ${
            mobile ? "w-full px-3 py-2.5 text-sm" : "px-3 py-1.5"
          }`}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/auth"
      onClick={onNavigate}
      className={`rounded-md bg-brand font-medium text-white hover:bg-brand-dark ${
        mobile
          ? "mx-3 mb-3 block px-3 py-2.5 text-center text-sm"
          : "px-3 py-1.5"
      }`}
    >
      Sign in
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  useEffect(() => {
    close();
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-[1000] border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight"
          onClick={close}
        >
          <span className="text-xl">🏍️</span>
          <span>
            Moto<span className="text-brand">Loop</span>
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 text-sm md:flex">
          {links.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              label={l.label}
              active={pathname === l.href}
            />
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-3 text-sm md:flex">
          <AuthSection />
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          {open ? (
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile panel */}
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-14 z-[999] bg-black/50 md:hidden"
            aria-label="Close menu"
            onClick={close}
          />
          <div
            id="mobile-nav"
            className="relative z-[1000] border-t border-zinc-800 bg-zinc-950 md:hidden"
          >
            <div className="mx-auto max-w-7xl space-y-1 px-2 py-3 text-sm">
              {links.map((l) => (
                <NavLink
                  key={l.href}
                  href={l.href}
                  label={l.label}
                  active={pathname === l.href}
                  onClick={close}
                />
              ))}
            </div>
            <AuthSection mobile onNavigate={close} />
          </div>
        </>
      )}
    </header>
  );
}
