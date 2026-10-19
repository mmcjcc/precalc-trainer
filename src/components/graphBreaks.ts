/**
 * Split a plot window at vertical asymptotes so a polyline cannot jump from one branch to the other.
 * Each span is closed at the cut; the two spans are separate paths and do not connect.
 */
export function splitDomain(lo: number, hi: number, breaks?: readonly number[]): [number, number][] {
  const cuts = (breaks ?? [])
    .filter((x) => Number.isFinite(x) && x > lo && x < hi)
    .sort((a, b) => a - b)
    .filter((x, i, arr) => i === 0 || x !== arr[i - 1])
  const spans: [number, number][] = []
  let left = lo
  for (const cut of cuts) {
    spans.push([left, cut])
    left = cut
  }
  spans.push([left, hi])
  return spans
}

/**
 * Keep the spans where the curve has a value at one or more of n + 1 evenly spaced points. Left of a
 * log's asymptote it has none, and function-plot throws on a polyline with nothing to draw, which loses
 * the whole graph.
 */
export function spansWithValues(spans: readonly [number, number][], valueAt: (x: number) => number, n: number): [number, number][] {
  return spans.filter(([a, b]) => {
    for (let i = 0; i <= n; i++) if (Number.isFinite(valueAt(a + ((b - a) * i) / n))) return true
    return false
  })
}
