"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces, type Place } from "@/lib/geocode";
import { STYLES, type GenerateRequest, type RideStyle } from "@/lib/types";

const DURATIONS = [
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
  { label: "4h", value: 240 },
];

const COORD_RE = /^-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/;

export default function RouteForm({
  onGenerate,
  loading,
}: {
  onGenerate: (req: GenerateRequest) => void;
  loading: boolean;
}) {
  const [start, setStart] = useState("");
  const [selected, setSelected] = useState<Place | null>(null);
  const [duration, setDuration] = useState(120);
  const [customDuration, setCustomDuration] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [style, setStyle] = useState<RideStyle>("SPORT");
  const [useElevation, setUseElevation] = useState(false);

  // --- autocomplete state ---
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggesting, setSuggesting] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNextFetch = useRef(false);

  // Debounced Photon lookup whenever the query changes.
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const q = start.trim();
    if (q.length < 3 || COORD_RE.test(q)) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSuggesting(true);
      try {
        const places = await searchPlaces(q, ctrl.signal);
        setSuggestions(places);
        setOpen(places.length > 0);
        setActiveIndex(-1);
      } catch {
        /* aborted or network error — ignore */
      } finally {
        setSuggesting(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [start]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const pickPlace = (p: Place) => {
    skipNextFetch.current = true; // setting `start` below shouldn't trigger a fetch
    setSelected(p);
    setStart(p.label);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault(); // select instead of submitting the form
      pickPlace(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    const durationMin = useCustom ? parseInt(customDuration, 10) : duration;
    if (!start.trim() || !durationMin || isNaN(durationMin)) return;

    const req: GenerateRequest =
      selected && selected.label === start.trim()
        ? {
            start: `${selected.lat},${selected.lng}`,
            startName: selected.label,
            durationMin,
            style,
            useElevation,
          }
        : { start: start.trim(), durationMin, style, useElevation };

    onGenerate(req);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-300">
          Start point
        </label>
        <div ref={boxRef} className="relative">
          <input
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setSelected(null); // editing reverts to free-text geocoding
            }}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onKeyDown={onInputKeyDown}
            placeholder="City, address… or 45.188,5.724"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 pr-9 text-sm outline-none placeholder:text-zinc-600 focus:border-brand"
          />
          {selected ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand">
              📍
            </span>
          ) : suggesting ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-pulse text-zinc-500">
              …
            </span>
          ) : null}

          {open && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
            >
              {suggestions.map((p, i) => (
                <li
                  key={`${p.lat},${p.lng}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus, fire before blur
                    pickPlace(p);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    i === activeIndex
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-300"
                  }`}
                >
                  <span className="mr-1.5 text-zinc-500">📍</span>
                  {p.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Start typing for suggestions, or paste <code>lat,lng</code>.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-300">
          Duration
        </label>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => {
                setUseCustom(false);
                setDuration(d.value);
              }}
              className={`rounded-lg border px-4 py-2 text-sm transition ${
                !useCustom && duration === d.value
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {d.label}
            </button>
          ))}
          <div
            className={`flex items-center rounded-lg border px-2 transition ${
              useCustom ? "border-brand" : "border-zinc-700"
            }`}
          >
            <input
              value={customDuration}
              onChange={(e) => {
                setCustomDuration(e.target.value);
                setUseCustom(true);
              }}
              onFocus={() => setUseCustom(true)}
              type="number"
              min={30}
              max={600}
              placeholder="custom"
              className="w-20 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-zinc-600"
            />
            <span className="pr-1 text-xs text-zinc-500">min</span>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-300">
          Riding style
        </label>
        <div className="grid grid-cols-3 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              className={`rounded-lg border p-3 text-center transition ${
                style === s.id
                  ? "border-brand bg-brand/10"
                  : "border-zinc-700 hover:border-zinc-500"
              }`}
            >
              <div className="text-2xl">{s.emoji}</div>
              <div className="mt-1 text-sm font-medium">{s.label}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-zinc-500">
                {s.blurb}
              </div>
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
        <input
          type="checkbox"
          checked={useElevation}
          onChange={(e) => setUseElevation(e.target.checked)}
          className="h-4 w-4 accent-brand"
        />
        Factor in elevation (slower — uses Open-Elevation)
      </label>

      <button
        type="submit"
        disabled={loading || !start.trim()}
        className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Generating loop…" : "Generate Route"}
      </button>
    </form>
  );
}
