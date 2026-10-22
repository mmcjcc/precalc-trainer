/**
 * Calculator steps for Unit 5 (graphs of the trig functions, inverse functions): RADIAN mode first (DEGREE only when a
 * problem asks for degrees), then the keys. Where π is ("2nd ^") is said only when the keys use π. The panel stays
 * behind its button until she asks for it or finishes, because these steps give the answer away.
 */
import { exactNum, exactText, isZero, waveInnerShift, type TrigExact, type Wave } from '@/engine/trig'
import type { CalcPanels, CalcStep } from '@/shared/types'
import { nspireMode, tiMode } from './calc'

const fixed = (v: number, places = 4) => Number(v.toFixed(places)).toString().replace(/^-/, '−')

/** An exact number on the TI-84: "(−) 2nd ^ (π) ÷ 2", "3 ÷ 2", "2". */
function tiExact(v: TrigExact): string {
  const n = Math.abs(v.c.n)
  const d = v.c.d
  const pi = v.pi === 1 ? 'π' : ''
  const top = pi ? `${n === 1 ? '' : `${n} `}${pi}` : String(n)
  return `${v.c.n < 0 ? '(−) ' : ''}${top}${d === 1 ? '' : ` ÷ ${d}`}`
}

function nsExact(v: TrigExact): string {
  return exactText(v).replace(/-/g, '−')
}

const usesPi = (s: string) => s.includes('π')
const piNoteTi = (s: string) => (usesPi(s) ? ' π is 2nd ^.' : '')
const piNoteNs = (s: string) => (usesPi(s) ? ' π is the π key.' : '')

const KEY: Record<string, string> = { sin: 'SIN', cos: 'COS', tan: 'TAN', csc: 'SIN', sec: 'COS', cot: 'TAN' }
const RECIPROCAL = new Set(['csc', 'sec', 'cot'])

/** The wave's right side in TI-84 keys: "3 SIN( 2 X,T,θ,n − π ÷ 2 ) + 1"; sec as "÷ COS(". */
export function tiWaveKeys(w: Wave, variable = 'X,T,θ,n'): string {
  const a = Math.abs(w.A.n / w.A.d)
  const aText = w.A.d === 1 ? String(Math.abs(w.A.n)) : `(${Math.abs(w.A.n)} ÷ ${w.A.d})`
  const sign = w.A.n < 0 ? '(−) ' : ''
  const B = w.B
  const bx = `${B.c.n === 1 && B.pi === 0 ? '' : B.pi === 1 ? `${B.c.n === 1 ? '' : `${B.c.n} `}π ` : `${B.c.n} `}${variable}${B.c.d === 1 ? '' : ` ÷ ${B.c.d}`}`
  const inner = waveInnerShift(w)
  const inside = isZero(inner) ? bx : `${bx} ${exactNum(inner) > 0 ? '−' : '+'} ${tiExact(exactNum(inner) > 0 ? inner : { ...inner, c: { n: -inner.c.n, d: inner.c.d } })}`
  const key = KEY[w.fn]!
  const core = RECIPROCAL.has(w.fn) ? `${sign}${a === 1 ? '1' : aText} ÷ ${key}( ${inside} )` : `${sign}${a === 1 ? '' : `${aText} `}${key}( ${inside} )`
  const d = w.D.n / w.D.d
  const dText = d === 0 ? '' : ` ${d > 0 ? '+' : '−'} ${w.D.d === 1 ? Math.abs(w.D.n) : `${Math.abs(w.D.n)} ÷ ${w.D.d}`}`
  // cot on the TI-84 is 1 ÷ TAN( ): exact enough away from its zeros.
  return `${core}${dText}`
}

/** The same for the TI-Nspire: "3·sin(2x − π/2) + 1", sec as "1/cos(". */
export function nsWaveKeys(w: Wave): string {
  const inner = waveInnerShift(w)
  const B = w.B
  const bx = `${B.c.n === 1 && B.pi === 0 ? '' : B.pi === 1 ? `${B.c.n === 1 ? '' : B.c.n}π·` : `${B.c.n}·`}x${B.c.d === 1 ? '' : `/${B.c.d}`}`
  const inside = isZero(inner) ? bx : `${bx} ${exactNum(inner) > 0 ? '−' : '+'} ${nsExact(exactNum(inner) > 0 ? inner : { ...inner, c: { n: -inner.c.n, d: inner.c.d } })}`
  const a = `${w.A.n < 0 ? '−' : ''}${Math.abs(w.A.n)}${w.A.d === 1 ? '' : `/${w.A.d}`}`
  const fn = w.fn === 'csc' ? 'sin' : w.fn === 'sec' ? 'cos' : w.fn === 'cot' ? 'tan' : w.fn
  const core = RECIPROCAL.has(w.fn) ? `${a}/${fn}(${inside})` : `${a}·${fn}(${inside})`
  const d = w.D.n / w.D.d
  return `${core}${d === 0 ? '' : ` ${d > 0 ? '+' : '−'} ${Math.abs(w.D.n)}${w.D.d === 1 ? '' : `/${w.D.d}`}`}`
}

/** The steps for a wave: RADIAN mode, Y1, a window that holds two periods, then what to look at. */
export function waveCalc(w: Wave, o: { window: [number, number]; yWindow?: [number, number]; find: 'features' | 'equation' | 'match' | 'asymptotes' }): CalcPanels {
  const ti = tiWaveKeys(w)
  const ns = nsWaveKeys(w)
  const a = Math.abs(w.A.n / w.A.d)
  const d = w.D.n / w.D.d
  const [ylo, yhi] = o.yWindow ?? [Math.floor(d - a - 1), Math.ceil(d + a + 1)]
  const win = `Xmin = ${fixed(o.window[0], 2)}, Xmax = ${fixed(o.window[1], 2)}, Ymin = ${fixed(ylo, 2)}, Ymax = ${fixed(yhi, 2)}`
  const reciprocal = RECIPROCAL.has(w.fn) ? ` There is no ${w.fn.toUpperCase()} key: ${w.fn} is one over ${w.fn === 'csc' ? 'sin' : w.fn === 'sec' ? 'cos' : 'tan'}.` : ''
  const look: Record<typeof o.find, CalcStep> = {
    features: { title: 'Find a highest point', keys: '2nd TRACE (CALC) → 4:maximum → left bound, right bound, guess → ENTER', why: 'Its y is the midline plus the amplitude; the next highest point is one period to the right.' },
    equation: { title: 'Check your equation', keys: 'Y= → Y2 = your equation → GRAPH', why: 'Your equation is right when its graph lies exactly on top of Y1 everywhere.' },
    match: { title: 'Compare with the four graphs', keys: 'GRAPH → TRACE', why: 'The calculator’s graph is the equation’s; find the card that looks the same.' },
    asymptotes: { title: 'Look at the asymptotes', keys: 'GRAPH → TRACE to where the curve shoots up or down', why: 'The vertical asymptotes are where the trace has no value or jumps from one end of the screen to the other.' },
  }
  return {
    ti84: [tiMode('rad'), { title: 'Enter the function', keys: `Y= → Y1 = ${ti} → ENTER`, why: `X,T,θ,n types x.${piNoteTi(ti)}${reciprocal}` }, { title: 'Set the window', keys: `WINDOW → ${win} → GRAPH`, why: 'Two periods fit on the screen.' }, look[o.find]],
    nspire: [nspireMode('rad'), { title: 'Enter the function', keys: `menu → Graph → f1(x) = ${ns} → enter`, why: `${piNoteNs(ns).trim()}${reciprocal}`.trim() || 'f1 is the function.' }, { title: 'Set the window', keys: `menu → Window/Zoom → Window Settings → ${win}`, why: 'Two periods fit on the screen.' }],
  }
}

/** A model: RADIAN mode, Y1 = the model, the window over two periods, a value, then intersect for the time. */
export function modelCalc(o: { tiModel: string; nsModel: string; period: number; ylo: number; yhi: number; at: number; height: number; unitWord: string }): CalcPanels {
  const win = `Xmin = 0, Xmax = ${fixed(2 * o.period, 2)}, Ymin = ${fixed(o.ylo, 2)}, Ymax = ${fixed(o.yhi, 2)}`
  return {
    ti84: [
      tiMode('rad'),
      { title: 'Enter the model', keys: `Y= → Y1 = ${o.tiModel} → ENTER`, why: `X,T,θ,n types t.${piNoteTi(o.tiModel)}` },
      { title: 'Set the window', keys: `WINDOW → ${win} → GRAPH`, why: 'Two periods of the model fit on the screen.' },
      { title: 'A value', keys: `2nd TRACE (CALC) → 1:value → X = ${fixed(o.at, 4)} → ENTER`, why: 'The Y the screen shows is the model’s value at that time. Round it the way the part asks.' },
      { title: 'The first time it reaches a height', keys: `Y= → Y2 = ${fixed(o.height, 4)} → 2nd TRACE (CALC) → 5:intersect → ENTER, ENTER, then move the guess near the first crossing → ENTER`, why: `The X of the first crossing after zero is the first time, in ${o.unitWord}.`, caution: 'In DEGREE mode the graph is almost flat and the numbers come out wrong, with no warning.' },
    ],
    nspire: [
      nspireMode('rad'),
      { title: 'Enter the model', keys: `menu → Graph → f1(x) = ${o.nsModel} → enter`, why: `x stands for t here.${piNoteNs(o.nsModel)}` },
      { title: 'Set the window', keys: `menu → Window/Zoom → Window Settings → ${win}`, why: 'Two periods of the model fit on the screen.' },
      { title: 'The first time it reaches a height', keys: `f2(x) = ${fixed(o.height, 4)} → menu → Analyze Graph → Intersection → the first crossing`, why: `The x of the first crossing after zero is the first time, in ${o.unitWord}.` },
    ],
  }
}

/** An inverse function's value: the mode of the unit asked, 2nd SIN for sin⁻¹, then the check of an exact answer. */
export function inverseCalc(o: { fn: 'asin' | 'acos' | 'atan'; tiInput: string; nsInput: string; unit: 'deg' | 'rad'; value: number | null; exact: boolean }): CalcPanels {
  const key = o.fn === 'asin' ? 'SIN' : o.fn === 'acos' ? 'COS' : 'TAN'
  const name = o.fn === 'asin' ? 'sin' : o.fn === 'acos' ? 'cos' : 'tan'
  const why =
    o.value === null
      ? 'The calculator shows ERR:DOMAIN: there is no angle for that input.'
      : `It shows about ${fixed(o.value)}${o.unit === 'deg' ? ' degrees' : ' radians'}.${o.exact ? ' Type your exact answer and compare.' : ' Round it the way the problem asks.'}`
  const check: CalcStep[] = o.exact && o.value !== null ? [{ title: 'Check your exact answer', keys: `Type your answer → ENTER`, why: `The two decimals match when your exact answer is right.${o.unit === 'rad' ? ' π is 2nd ^.' : ''}` }] : []
  return {
    ti84: [tiMode(o.unit), { title: `Undo ${name} with ${name}⁻¹`, keys: `2nd ${key} (${key}⁻¹) ${o.tiInput} ) → ENTER`, why, caution: `${key} on its own gives the ${name} of a number, and 1 ÷ ${key} is its reciprocal: 2nd ${key} gives the angle.` }, ...check],
    nspire: [nspireMode(o.unit), { title: `Undo ${name} with ${name}⁻¹`, keys: `${name}⁻¹(${o.nsInput}) → ctrl enter`, why: `${name}⁻¹ is ctrl ${name}. ${why}` }],
  }
}

/** A composition: RADIAN mode, the outer function of the inner inverse, then the check of the exact answer. */
export function composeCalc(o: { ti: string; ns: string; value: number | null; exact: boolean }): CalcPanels {
  const why = o.value === null ? 'The calculator shows ERR:DOMAIN: the inside has no value.' : `It shows about ${fixed(o.value)}.${o.exact ? ' Type your exact answer and compare.' : ''}`
  const check: CalcStep[] = o.exact && o.value !== null ? [{ title: 'Check your exact answer', keys: 'Type your answer → ENTER', why: `The two decimals match when your exact answer is right.${usesPi(o.ti) ? ' π is 2nd ^.' : ''}` }] : []
  return {
    ti84: [tiMode('rad'), { title: 'Work it out from the inside', keys: `${o.ti} → ENTER`, why: `The inverse key is 2nd SIN, 2nd COS or 2nd TAN.${piNoteTi(o.ti)} ${why}`.trim() }, ...check],
    nspire: [nspireMode('rad'), { title: 'Work it out from the inside', keys: `${o.ns} → ctrl enter`, why: `sin⁻¹, cos⁻¹ and tan⁻¹ are ctrl sin, ctrl cos and ctrl tan.${piNoteNs(o.ns)} ${why}` }],
  }
}
