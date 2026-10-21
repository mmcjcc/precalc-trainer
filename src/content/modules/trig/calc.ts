/**
 * Calculator steps for the trig problems: the angle mode first (MODE on the TI-84, Document Settings on the
 * TI-Nspire), then the keys, then a decimal check of her exact answer. The panel stays behind a button until she
 * asks for it or finishes, because these steps give the answer away.
 */
import type { CalcPanels, CalcStep } from '@/shared/types'

export type Unit = 'deg' | 'rad'

const WORD: Record<Unit, string> = { deg: 'DEGREE', rad: 'RADIAN' }
const NSPIRE_WORD: Record<Unit, string> = { deg: 'Degree', rad: 'Radian' }

/** A number as typed on the calculator: (−) for a negative, π from 2nd ^ (TI-84) or the π key (Nspire). */
export function tiNumber(text: string): string {
  return text.replace(/^-/, '(−)').replace(/π/g, 'π').replace(/\//g, '÷')
}

function nspireNumber(text: string): string {
  return text.replace(/-/g, '−').replace(/\//g, '÷')
}

export function tiMode(unit: Unit): CalcStep {
  return {
    title: `Set the angle mode to ${WORD[unit]}`,
    keys: `MODE → ▼ to the RADIAN DEGREE row → ${unit === 'deg' ? '►' : '◄'} to ${WORD[unit]} → ENTER → 2nd MODE (QUIT)`,
    why: 'The highlighted word on that row is the mode every SIN, COS and TAN uses.',
    caution: 'In the wrong mode the calculator gives a wrong decimal and no warning.',
  }
}

export function nspireMode(unit: Unit): CalcStep {
  return {
    title: `Set the angle mode to ${NSPIRE_WORD[unit]}`,
    keys: `doc → 7:Settings → 2:Document Settings → tab to Angle → ${NSPIRE_WORD[unit]} → enter`,
    why: 'The Angle setting is what sin, cos and tan use on every page of the document.',
    caution: 'In the wrong mode the calculator gives a wrong decimal and no warning.',
  }
}

const CHECK_TI: CalcStep = {
  title: 'Check your exact answer',
  keys: 'Type your answer (√ is 2nd x², π is 2nd ^) → ENTER',
  why: 'The two decimals match when your exact answer is right.',
}

const CHECK_NSPIRE: CalcStep = {
  title: 'Check your exact answer',
  keys: 'Type your answer (√ is ctrl x², π is the π key) → ctrl enter',
  why: 'ctrl enter gives a decimal. The two decimals match when your exact answer is right.',
}

function fixed(v: number, places = 6): string {
  return Number(v.toFixed(places)).toString().replace(/^-/, '−')
}

/** Converting an angle: in the target mode, type the angle with its own unit mark. */
export function conversionCalc(givenText: string, from: Unit, value: number, exact: boolean): CalcPanels {
  const to: Unit = from === 'deg' ? 'rad' : 'deg'
  const shown = `It shows about ${fixed(value)}.`
  const ti: CalcStep[] = [
    tiMode(to),
    from === 'deg'
      ? { title: 'Type the angle in degrees', keys: `${tiNumber(givenText)} → 2nd APPS (ANGLE) → 1:° → ENTER`, why: `In RADIAN mode the degree mark turns degrees into radians. ${shown}` }
      : { title: 'Type the angle in radians', keys: `( ${tiNumber(givenText)} ) → 2nd APPS (ANGLE) → 3:r → ENTER`, why: `In DEGREE mode the r mark turns radians into degrees. ${shown}` },
    ...(exact ? [CHECK_TI] : []),
  ]
  const nspire: CalcStep[] = [
    nspireMode(to),
    from === 'deg'
      ? { title: 'Type the angle in degrees', keys: `${nspireNumber(givenText)}° → ctrl enter`, why: `The ° symbol is in the catalog (ctrl ⌸). ${shown}` }
      : { title: 'Type the angle in radians', keys: `( ${nspireNumber(givenText)} )ʳ → ctrl enter`, why: `The ʳ symbol is in the catalog (ctrl ⌸). ${shown}` },
    ...(exact ? [CHECK_NSPIRE] : []),
  ]
  return { ti84: ti, nspire }
}

/** Coterminal angles end in the same place: their sines and cosines match. */
export function sameEndCalc(givenText: string, unit: Unit, what: 'coterminal' | 'reference'): CalcPanels {
  const fn = what === 'coterminal' ? 'COS' : 'SIN'
  const why =
    what === 'coterminal'
      ? 'Coterminal angles have the same cosine and the same sine: do it with SIN too.'
      : 'The angle and its reference angle have sines of the same size; only the sign can differ. COS works the same way.'
  return {
    ti84: [
      tiMode(unit),
      { title: 'Work out the given angle', keys: `${fn}( ${tiNumber(givenText)} ) → ENTER`, why: 'π is 2nd ^, and (−) makes a negative.' },
      { title: 'Compare with your answer', keys: `${fn}( your answer ) → ENTER`, why },
    ],
    nspire: [
      nspireMode(unit),
      { title: 'Work out the given angle', keys: `${fn.toLowerCase()}(${nspireNumber(givenText)}) → ctrl enter`, why: 'ctrl enter gives a decimal.' },
      { title: 'Compare with your answer', keys: `${fn.toLowerCase()}(your answer) → ctrl enter`, why },
    ],
  }
}

const TI_FN: Record<string, string> = { sin: 'SIN', cos: 'COS', tan: 'TAN', csc: 'SIN', sec: 'COS', cot: 'TAN' }

/** A special-angle value: the function on the calculator (one over it for csc, sec, cot), then the check. */
export function valueCalc(fn: string, angleText: string, unit: Unit, value: number | null): CalcPanels {
  const reciprocal = fn === 'csc' || fn === 'sec' || fn === 'cot'
  const ti = `${reciprocal ? '1 ÷ ' : ''}${TI_FN[fn]}( ${tiNumber(angleText)} ) → ENTER`
  const ns = `${reciprocal ? '1/' : ''}${TI_FN[fn]!.toLowerCase()}(${nspireNumber(angleText)}) → ctrl enter`
  const why = value === null ? 'There is no number to show here.' : `It shows about ${fixed(value)}.`
  const caution =
    value === null
      ? 'Where the value does not exist the calculator shows an error, or a huge number from rounding π.'
      : reciprocal
        ? `There is no ${fn.toUpperCase()} key: ${fn} is one over ${TI_FN[fn]!.toLowerCase()}.`
        : undefined
  return {
    ti84: [tiMode(unit), { title: `Find ${fn} on the calculator`, keys: ti, why, ...(caution ? { caution } : {}) }, ...(value === null ? [] : [CHECK_TI])],
    nspire: [nspireMode(unit), { title: `Find ${fn} on the calculator`, keys: ns, why, ...(caution ? { caution } : {}) }, ...(value === null ? [] : [CHECK_NSPIRE])],
  }
}

/** A point on the terminal side: r, then one ratio as a decimal to compare with her exact answer. */
export function pointCalc(x: number, y: number, r: number): CalcPanels {
  const tx = (n: number) => (n < 0 ? `(−)${-n}` : String(n))
  const nx = (n: number) => (n < 0 ? `(−${-n})` : String(n))
  return {
    ti84: [
      { title: 'Find r', keys: `2nd x² (√) ${tx(x)} x² + ${tx(y)} x² ) → ENTER`, why: `It shows about ${fixed(r)}. A whole number means r is that number; otherwise r is a square root.`, caution: 'Type (−) for a negative coordinate, and square it inside the root.' },
      { title: 'Check a ratio', keys: `${tx(y)} ÷ 2nd (−) (ANS) → ENTER`, why: 'ANS is the r you just found, so this is y/r = sin θ as a decimal. Type your exact sin θ and compare.' },
      CHECK_TI,
    ],
    nspire: [
      { title: 'Find r', keys: `√(${nx(x)}² + ${nx(y)}²) → ctrl enter`, why: `It shows about ${fixed(r)}.` },
      { title: 'Check a ratio', keys: `${nx(y)}/ans → ctrl enter`, why: 'ans is the r you just found, so this is y/r = sin θ as a decimal. Type your exact sin θ and compare.' },
      CHECK_NSPIRE,
    ],
  }
}

/** Arc length or sector area: plain arithmetic, so the mode does not matter. */
export function arcCalc(expressionTi: string, expressionNspire: string, value: number, what: 'arc' | 'area'): CalcPanels {
  const title = what === 'arc' ? 'Work out the arc length' : 'Work out the area'
  const caution = 'No SIN or COS here, so the angle mode does not matter. θ has to be in radians.'
  return {
    ti84: [{ title, keys: `${expressionTi} → ENTER`, why: `π is 2nd ^. It shows about ${fixed(value)}.`, caution }, CHECK_TI],
    nspire: [{ title, keys: `${expressionNspire} → ctrl enter`, why: `It shows about ${fixed(value)}.`, caution }, CHECK_NSPIRE],
  }
}
