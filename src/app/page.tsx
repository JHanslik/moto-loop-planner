import Link from "next/link";

const features = [
  {
    emoji: "🧭",
    title: "Real loop generation",
    body: "Pick a start, a duration and a riding style. We spray candidate loops, route them on real OpenStreetMap roads and keep the best.",
  },
  {
    emoji: "🤖",
    title: "Fun-score algorithm",
    body: "Each loop is scored on twistiness, motorway avoidance, distance fit and (optionally) elevation — tuned per style.",
  },
  {
    emoji: "🗺️",
    title: "Open data, no API keys",
    body: "OSRM + OpenStreetMap for routing and tiles. The planner runs with zero configuration.",
  },
  {
    emoji: "📲",
    title: "Export to GPS",
    body: "One click to Google Maps, Waze, or a downloadable GPX file for your moto GPS.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4">
      <section className="flex flex-col items-center py-20 text-center">
        <span className="mb-4 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
          Open Data · Routing · Cartography
        </span>
        <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight sm:text-6xl">
          Better rides start as a{" "}
          <span className="text-brand">loop</span>, not a destination.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-400">
          Moto Loop Planner generates optimized motorcycle loops from your
          doorstep — twisty, scenic or chill — then exports them straight to your
          GPS. Save your favorites and share them with the community.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/planner"
            className="rounded-lg bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-dark"
          >
            Generate a route
          </Link>
          <Link
            href="/community"
            className="rounded-lg border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-900"
          >
            Browse community rides
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
          >
            <div className="text-3xl">{f.emoji}</div>
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-zinc-400">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
