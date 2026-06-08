"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

const links = [
  {
    href: "/planner",
    label: "Planner",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M9 20l-5.447-2.724A2 2 0 013 15.382V6.618a2 2 0 011.553-1.948L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A2 2 0 0021 17.382V8.618a2 2 0 00-1.553-1.948L15 4m0 13V4" />
      </svg>
    ),
  },
  {
    href: "/community",
    label: "Community",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: "/rides",
    label: "My Rides",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    href: "/groups",
    label: "Groups",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    prefixMatch: true,
  },
];

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <div className="relative h-5 w-5" aria-hidden>
      <span
        className={`absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out ${
          open ? "top-[9px] rotate-45" : "top-0.5"
        }`}
      />
      <span
        className={`absolute left-0 top-[9px] block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out ${
          open ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
        }`}
      />
      <span
        className={`absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out ${
          open ? "top-[9px] -rotate-45" : "top-[17px]"
        }`}
      />
    </div>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
  mobile,
  index = 0,
  menuOpen,
  onClick,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  mobile?: boolean;
  index?: number;
  menuOpen?: boolean;
  onClick?: () => void;
}) {
  if (mobile) {
    return (
      <Link
        href={href}
        onClick={onClick}
        style={{ animationDelay: menuOpen ? `${80 + index * 55}ms` : "0ms" }}
        className={`nav-mobile-item flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
          menuOpen ? "nav-mobile-item-visible" : ""
        } ${
          active
            ? "bg-brand/15 text-white ring-1 ring-brand/30"
            : "text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            active ? "bg-brand/20 text-brand" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {icon}
        </span>
        <span className="font-medium">{label}</span>
        {active && (
          <span className="ml-auto h-2 w-2 rounded-full bg-brand shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
        )}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group relative rounded-lg px-3 py-2 text-sm transition-colors ${
        active ? "text-white" : "text-zinc-400 hover:text-white"
      }`}
    >
      <span className="relative z-10">{label}</span>
      <span
        className={`absolute inset-0 rounded-lg bg-zinc-800/80 transition-all duration-200 ${
          active ? "scale-100 opacity-100" : "scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100"
        }`}
      />
      <span
        className={`absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-brand transition-all duration-300 ${
          active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0 group-hover:scale-x-75 group-hover:opacity-60"
        }`}
      />
    </Link>
  );
}

function AuthSection({
  mobile,
  menuOpen,
  onNavigate,
}: {
  mobile?: boolean;
  menuOpen?: boolean;
  onNavigate?: () => void;
}) {
  const { user, signOut, loading } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <span
        className={`text-xs text-zinc-500 ${mobile ? "px-4 py-2" : "hidden sm:inline"}`}
      >
        Planner-only mode
      </span>
    );
  }

  if (loading) {
    return mobile ? (
      <div className="border-t border-zinc-800/80 px-4 py-4">
        <div className="h-10 animate-pulse rounded-xl bg-zinc-800/60" />
      </div>
    ) : null;
  }

  if (user) {
    return (
      <div
        style={{ animationDelay: menuOpen ? "280ms" : "0ms" }}
        className={
          mobile
            ? `nav-mobile-item border-t border-zinc-800/80 px-4 py-4 ${
                menuOpen ? "nav-mobile-item-visible" : ""
              }`
            : "flex items-center gap-3"
        }
      >
        {mobile && (
          <p className="mb-2 truncate text-xs text-zinc-500">{user.email}</p>
        )}
        <div className={mobile ? "flex flex-col gap-2" : "flex items-center gap-3"}>
          {!mobile && (
            <span className="hidden max-w-[160px] truncate text-zinc-400 sm:inline">
              {user.email}
            </span>
          )}
          <button
            onClick={() => {
              void signOut();
              onNavigate?.();
            }}
            className={`rounded-xl border border-zinc-700 text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white ${
              mobile ? "w-full px-4 py-2.5 text-sm font-medium" : "px-3 py-1.5 text-sm"
            }`}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ animationDelay: menuOpen ? "280ms" : "0ms" }}
      className={mobile ? `nav-mobile-item px-4 pb-4 ${menuOpen ? "nav-mobile-item-visible" : ""}` : undefined}
    >
      <Link
        href="/auth"
        onClick={onNavigate}
        className={`block rounded-xl bg-brand font-medium text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark ${
          mobile ? "px-4 py-3 text-center text-sm" : "px-3 py-1.5 text-sm"
        }`}
      >
        Sign in
      </Link>
    </div>
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
    <header className="sticky top-0 z-[1000] border-b border-zinc-800/80 bg-zinc-950/90 shadow-sm shadow-black/20 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link
          href="/"
          className="group flex items-center gap-2 font-bold tracking-tight transition-opacity hover:opacity-90"
          onClick={close}
        >
          <span className="text-xl transition-transform duration-300 group-hover:scale-110">
            🏍️
          </span>
          <span>
            Moto<span className="text-brand">Loop</span>
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              label={l.label}
              icon={l.icon}
              active={
                "prefixMatch" in l && l.prefixMatch
                  ? pathname.startsWith(l.href)
                  : pathname === l.href
              }
            />
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-3 text-sm md:flex">
          <AuthSection />
        </div>

        <button
          type="button"
          className={`ml-auto inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors md:hidden ${
            open
              ? "bg-zinc-800 text-white"
              : "text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
          }`}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <HamburgerIcon open={open} />
        </button>
      </nav>

      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={close}
        className={`fixed inset-0 top-14 z-[998] bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Mobile panel */}
      <div
        id="mobile-nav"
        className={`absolute left-0 right-0 top-full z-[999] overflow-hidden border-t border-zinc-800/80 bg-zinc-950/95 shadow-2xl shadow-black/40 backdrop-blur-xl transition-[max-height,opacity,transform] duration-300 ease-out md:hidden ${
          open
            ? "max-h-[min(85vh,520px)] translate-y-0 opacity-100"
            : "pointer-events-none max-h-0 -translate-y-1 opacity-0"
        }`}
      >
        <div className="mx-auto max-w-7xl space-y-1 px-3 py-3">
          {links.map((l, i) => (
            <NavLink
              key={l.href}
              href={l.href}
              label={l.label}
              icon={l.icon}
              active={
                "prefixMatch" in l && l.prefixMatch
                  ? pathname.startsWith(l.href)
                  : pathname === l.href
              }
              mobile
              index={i}
              menuOpen={open}
              onClick={close}
            />
          ))}
        </div>
        <AuthSection mobile menuOpen={open} onNavigate={close} />
      </div>
    </header>
  );
}
