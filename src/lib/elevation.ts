/**
 * Optional elevation enrichment via the free Open-Elevation API.
 * This public endpoint can be slow or down, so it is OFF by default and every
 * failure path returns `undefined` — the scorer then simply ignores elevation.
 */
export async function elevationGain(
  coords: [number, number][]
): Promise<number | undefined> {
  if (coords.length < 2) return undefined;
  try {
    // Sample at most ~50 points to keep the request small.
    const step = Math.max(1, Math.floor(coords.length / 50));
    const locations = coords
      .filter((_, i) => i % step === 0)
      .map((c) => ({ latitude: c[1], longitude: c[0] }));

    const res = await fetch("https://api.open-elevation.com/api/v1/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations }),
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return undefined;

    const data = await res.json();
    const els: number[] = (data.results ?? []).map((r: any) => r.elevation);
    let gain = 0;
    for (let i = 1; i < els.length; i++) {
      const d = els[i] - els[i - 1];
      if (d > 0) gain += d;
    }
    return Math.round(gain);
  } catch {
    return undefined;
  }
}
