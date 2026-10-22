/**
 * Calculator steps for an optimization problem: the final equation in Y=, a WINDOW that shows its top (or bottom)
 * over this problem's domain, 2nd TRACE 4:maximum (3:minimum for a smallest value), and the vertex formula's
 * arithmetic with this problem's a and b. TI-Nspire steps as well. Only what applies to this problem: the (−) key only
 * where a number is negative, the minimum tool only for a smallest value. The panel stays behind its button until she
 * asks for it or finishes, because these steps give the answer away.
 */
import { convertExpr } from '@/content/calc/format'
import { qNeg, type Q, type Quadratic } from '@/engine/optim'
import type { CalcPanels, CalcStep } from '@/shared/types'
import { quadText } from './text'

const num = (v: Q) => v.n / v.d

/** A round number at or beyond v, away from zero: 31250 → 35000, 2645 → 3000, −64 → −70. */
export function niceBound(v: number): number {
  if (v === 0) return 0
  const a = Math.abs(v)
  const p = 10 ** Math.floor(Math.log10(a))
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10]
  const k = steps.find((s) => s * p >= a * (1 + 1e-9))!
  return Math.sign(v) * Number((k * p).toPrecision(6))
}

/** A number as typed on the TI-84: (−) for a negative, a fraction in parentheses. */
function tiNum(v: Q): string {
  const neg = v.n < 0
  const n = Math.abs(v.n)
  const body = v.d === 1 ? String(n) : `( ${n} ÷ ${v.d} )`
  return neg ? (v.d === 1 ? `(−)${body}` : `(−)${body}`) : body
}

function nsNum(v: Q): string {
  const n = Math.abs(v.n)
  const body = v.d === 1 ? String(n) : `(${n}/${v.d})`
  return v.n < 0 ? `−${body}` : body
}

export interface OptCalcInput {
  /** The final equation's quadratic in x. */
  final: Quadratic
  goal: 'max' | 'min'
  /** The x-window: where x makes sense in this problem. */
  xWindow: readonly [number, number]
  /** The vertex's height, and the heights at the window's ends (for the y-window). */
  value: Q
  ends: readonly [number, number]
  /** "the area", "the revenue": what Y is. */
  quantityWords: string
  /** "the x", "the price": what X is. */
  inputWords: string
}

export function optCalc(o: OptCalcInput): CalcPanels {
  // The worksheet's order (500x − 2x²) where it starts with a plus sign; the standard order otherwise.
  const expr = quadText(o.final, 'x').text
  const ti = convertExpr('ti84', expr)
  const ns = convertExpr('nspire', expr)
  const lo = Math.min(num(o.value), ...o.ends, 0)
  const hi = Math.max(num(o.value), ...o.ends, 0)
  // Whole numbers for the window: the calculator takes any, and a long decimal only gets in the way.
  const x0 = Math.floor(o.xWindow[0])
  const x1 = Math.ceil(o.xWindow[1] - 1e-9)
  const yMin = lo < 0 ? niceBound(lo * 1.15) : 0
  const yMax = hi > 0 ? niceBound(hi * 1.15) : niceBound(Math.abs(lo) * 0.5)
  const tool = o.goal === 'max' ? 'maximum' : 'minimum'
  const where = o.goal === 'max' ? 'top' : 'bottom'
  const negativeLead = expr.startsWith('-')
  const big = Math.max(Math.abs(x0), Math.abs(x1), Math.abs(yMin), Math.abs(yMax)) > 10
  const minusB = qNeg(o.final.b)
  const tiWindow = (v: number) => (v < 0 ? `(−)${Math.abs(v)}` : String(v))
  const ti84: CalcStep[] = [
    {
      title: 'Enter the final equation',
      keys: `Y= → Y1 = ${ti}`,
      ...(negativeLead ? { caution: 'Start with the (−) key at the bottom, not the subtraction key.' } : {}),
    },
    {
      title: `Set a window that shows the ${where}`,
      keys: `WINDOW: Xmin = ${tiWindow(x0)}, Xmax = ${tiWindow(x1)}, Ymin = ${tiWindow(yMin)}, Ymax = ${tiWindow(yMax)}. Then GRAPH.`,
      why: big ? 'ZStandard shows only −10 to 10, far too small for this problem.' : 'This window holds the whole curve for this problem.',
    },
    {
      title: `Find the ${tool}`,
      keys: `2nd TRACE (CALC) → ${o.goal === 'max' ? '4:maximum' : '3:minimum'}. Move the cursor left of the ${where} and press ENTER, then right of it and press ENTER, then ENTER once more.`,
      why: `X is ${o.inputWords} that gives the ${o.goal === 'max' ? 'largest' : 'smallest'} value, and Y is ${o.quantityWords} there.`,
      caution: 'The calculator searches, so X can come out a hair off the exact value. The vertex formula gives it exactly.',
    },
    {
      title: 'Or work out the vertex formula',
      keys: `${tiNum(minusB)} ÷ ( 2 × ${tiNum(o.final.a)} ) → ENTER`,
      why: `−b/(2a) with a = ${nsNum(o.final.a)} and b = ${nsNum(o.final.b)}.`,
      caution: 'Keep 2a in parentheses: without them the calculator divides by 2 and then multiplies by a.',
    },
  ]
  const nspire: CalcStep[] = [
    {
      title: 'Graph the final equation',
      keys: `ctrl G → f1(x) = ${ns} → enter`,
    },
    {
      title: `Set a window that shows the ${where}`,
      keys: `menu → Window/Zoom → Window Settings: XMin = ${x0}, XMax = ${x1}, YMin = ${yMin}, YMax = ${yMax}, OK.`,
      why: big ? 'The standard window stops at ±10, far too small for this problem.' : 'This window holds the whole curve for this problem.',
    },
    {
      title: `Find the ${tool}`,
      keys: `menu → Analyze Graph → ${o.goal === 'max' ? 'Maximum' : 'Minimum'}. Click to the left of the ${where} for the lower bound, then to the right of it for the upper bound.`,
      why: `The point is labelled with its coordinates: ${o.inputWords} first, then ${o.quantityWords}.`,
    },
    {
      title: 'Or work out the vertex formula',
      keys: `${nsNum(minusB)} ÷ (2 × ${nsNum(o.final.a)}) → enter`,
      why: `−b/(2a) with a = ${nsNum(o.final.a)} and b = ${nsNum(o.final.b)}.`,
    },
  ]
  return { ti84, nspire }
}
