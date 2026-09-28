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
