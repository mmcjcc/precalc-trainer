/**
 * The rows' colours, by name. Hex lives here (a constants module, like PALETTE in shared/types.ts), never in a
 * component. Every one is dark enough to read on white (at least 4.5:1), and each has a name, because a colour is
 * never the only way to tell two rows apart: the rows are numbered and the plane's description names them.
 */
import { PALETTE } from '@/shared/types'

export type GraphColor = 'navy' | 'red' | 'green' | 'purple' | 'gold' | 'teal'

export const GRAPH_COLORS: Readonly<Record<GraphColor, { hex: string; name: string }>> = {
  navy: { hex: PALETTE.navy, name: 'navy' },
  red: { hex: PALETTE.coral700, name: 'red' },
  green: { hex: PALETTE.success, name: 'green' },
  purple: { hex: '#6D28D9', name: 'purple' },
  gold: { hex: PALETTE.goldText, name: 'gold' },
  teal: { hex: '#0F766E', name: 'teal' },
}

/** New rows take the colours in this order, then round again. */
export const COLOR_ORDER: readonly GraphColor[] = ['navy', 'red', 'green', 'purple', 'gold', 'teal']

export function isGraphColor(v: unknown): v is GraphColor {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(GRAPH_COLORS, v)
}

/** The next colour after the ones in use: the first one not used yet, else round again. */
export function nextColor(used: readonly GraphColor[]): GraphColor {
  const free = COLOR_ORDER.find((c) => !used.includes(c))
  return free ?? COLOR_ORDER[used.length % COLOR_ORDER.length]!
}
