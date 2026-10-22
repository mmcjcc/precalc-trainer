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

/**
 * Arc length or sector area: plain arithmetic, so the mode does not matter. Where to find π only when the keys use it;
 * the check of an exact answer only when the answer is exact (a rounded one is the decimal itself).
 */
export function arcCalc(expressionTi: string, expressionNspire: string, value: number, what: 'arc' | 'area', exact: boolean): CalcPanels {
  const title = what === 'arc' ? 'Work out the arc length' : 'Work out the area'
  const caution = 'No SIN or COS here, so the angle mode does not matter. θ has to be in radians.'
  const shown = `It shows about ${fixed(value)}.`
  return {
    ti84: [{ title, keys: `${expressionTi} → ENTER`, why: expressionTi.includes('π') ? `π is 2nd ^. ${shown}` : shown, caution }, ...(exact ? [CHECK_TI] : [])],
    nspire: [{ title, keys: `${expressionNspire} → ctrl enter`, why: shown, caution }, ...(exact ? [CHECK_NSPIRE] : [])],
  }
}

// ---------------------------------------------------------------------------
// The second half: right triangles, one value and the quadrant, every angle in one turn
// ---------------------------------------------------------------------------

/** The check of an exact answer with no π in it: where √ is, and nothing about π. */
const CHECK_TI_ROOT: CalcStep = {
  title: 'Check your exact answer',
  keys: 'Type your answer (√ is 2nd x²) → ENTER',
  why: 'The two decimals match when your exact answer is right.',
}

const CHECK_NSPIRE_ROOT: CalcStep = {
  title: 'Check your exact answer',
  keys: 'Type your answer (√ is ctrl x²) → ctrl enter',
  why: 'ctrl enter gives a decimal. The two decimals match when your exact answer is right.',
}

/** An exact number c·√m (no π) as TI-84 keys: "5", "4 × 2nd x² (√) 3 )", "(−) 2nd x² (√) 3 ) ÷ 2". */
export function tiExactKeys(e: { c: { n: number; d: number }; root: number }): string {
  const num = Math.abs(e.c.n)
  let s = e.root === 1 ? String(num) : `${num === 1 ? '' : `${num} × `}2nd x² (√) ${e.root} )`
  if (e.c.d !== 1) s = `${s} ÷ ${e.c.d}`
  return `${e.c.n < 0 ? '(−) ' : ''}${s}`
}

/** The same number for the TI-Nspire: "4√(3)", "−√(3)/2". */
export function nspireExactKeys(e: { c: { n: number; d: number }; root: number }): string {
  const num = Math.abs(e.c.n)
  let s = e.root === 1 ? String(num) : `${num === 1 ? '' : num}√(${e.root})`
  if (e.c.d !== 1) s = `${s}/${e.c.d}`
  return `${e.c.n < 0 ? '−' : ''}${s}`
}

const TI_KEY: Record<'sin' | 'cos' | 'tan', string> = { sin: 'SIN', cos: 'COS', tan: 'TAN' }

/**
 * The six ratios from two sides: the third side with the Pythagorean theorem, one ratio as a decimal, then the check.
 * No SIN or COS, so no mode step.
 */
export function rtRatiosCalc(o: { a: number; b: number; hypGiven: boolean; third: number; ratio: { fn: string; topKeys: string; bottomKeys: string; topNs: string; bottomNs: string; value: number } }): CalcPanels {
  const { a, b } = o
  const tiThird = o.hypGiven ? `2nd x² (√) ${b} x² − ${a} x² ) → ENTER` : `2nd x² (√) ${a} x² + ${b} x² ) → ENTER`
  const nsThird = o.hypGiven ? `√(${b}² − ${a}²) → ctrl enter` : `√(${a}² + ${b}²) → ctrl enter`
  const thirdWhy = `It shows about ${fixed(o.third)}. A whole number is the side itself; otherwise the side is a square root, in simplest radical form.`
  const ratioWhy = `That is ${o.ratio.fn} θ as a decimal, about ${fixed(o.ratio.value)}. Type your exact ${o.ratio.fn} θ and compare.`
  return {
    ti84: [
      { title: 'Find the third side', keys: tiThird, why: thirdWhy, caution: 'Square each side inside the root, and subtract only when one side is the hypotenuse.' },
      { title: 'A ratio as a decimal', keys: `${o.ratio.topKeys} ÷ ${o.ratio.bottomKeys} → ENTER`, why: ratioWhy },
      CHECK_TI_ROOT,
    ],
    nspire: [
      { title: 'Find the third side', keys: nsThird, why: thirdWhy },
      { title: 'A ratio as a decimal', keys: `(${o.ratio.topNs})/(${o.ratio.bottomNs}) → ctrl enter`, why: ratioWhy },
      CHECK_NSPIRE_ROOT,
    ],
  }
}

/**
 * A special right triangle: in DEGREE mode, each side she is asked for as a decimal from the side she is given (a side
 * is the hypotenuse times the sine of the angle across from it), then the check of her exact answer.
 */
export function rtSpecialCalc(o: { givenKeys: string; givenNs: string; givenAngle: number; asked: { name: string; angle: number; value: number }[] }): CalcPanels {
  const ti = (angle: number) => (o.givenAngle === 90 ? `${o.givenKeys} × SIN( ${angle} ) → ENTER` : `${o.givenKeys} × SIN( ${angle} ) ÷ SIN( ${o.givenAngle} ) → ENTER`)
  const ns = (angle: number) => (o.givenAngle === 90 ? `${o.givenNs}·sin(${angle}) → ctrl enter` : `${o.givenNs}·sin(${angle})/sin(${o.givenAngle}) → ctrl enter`)
  const why = (value: number) => `A side is the hypotenuse times the sine of the angle across from it. It shows about ${fixed(value)}.`
  return {
    ti84: [tiMode('deg'), ...o.asked.map((s) => ({ title: `${s.name} as a decimal`, keys: ti(s.angle), why: why(s.value) })), CHECK_TI_ROOT],
    nspire: [nspireMode('deg'), ...o.asked.map((s) => ({ title: `${s.name} as a decimal`, keys: ns(s.angle), why: why(s.value) })), CHECK_NSPIRE_ROOT],
  }
}

/** A side from an angle and a side: DEGREE mode, then the known side times or divided by the ratio. */
export function rtSideCalc(o: { fn: 'sin' | 'cos' | 'tan'; angle: number; known: number; multiply: boolean; value: number }): CalcPanels {
  const op = o.multiply ? '×' : '÷'
  const why = `It shows about ${fixed(o.value)}. Round it the way the problem asks.`
  return {
    ti84: [tiMode('deg'), { title: 'Work out the side', keys: `${o.known} ${op} ${TI_KEY[o.fn]}( ${o.angle} ) → ENTER`, why }],
    nspire: [nspireMode('deg'), { title: 'Work out the side', keys: `${o.known}${o.multiply ? '·' : '/'}${o.fn}(${o.angle}) → ctrl enter`, why }],
  }
}

/** An angle from two sides: DEGREE mode, then the inverse of the ratio (2nd SIN for sin⁻¹). */
export function rtAngleCalc(o: { fn: 'sin' | 'cos' | 'tan'; top: number; bottom: number; value: number }): CalcPanels {
  const key = TI_KEY[o.fn]
  const word = o.fn === 'sin' ? 'sine' : o.fn === 'cos' ? 'cosine' : 'tangent'
  const why = `It shows about ${fixed(o.value)}, the angle in degrees. Round it to the nearest tenth.`
  return {
    ti84: [
      tiMode('deg'),
      { title: `Undo ${o.fn} with ${o.fn}⁻¹`, keys: `2nd ${key} (${key}⁻¹) ${o.top} ÷ ${o.bottom} ) → ENTER`, why, caution: `${key} on its own gives the ${word} of a number. 2nd ${key} gives the angle whose ${word} it is.` },
    ],
    nspire: [nspireMode('deg'), { title: `Undo ${o.fn} with ${o.fn}⁻¹`, keys: `${o.fn}⁻¹(${o.top}/${o.bottom}) → ctrl enter`, why: `${o.fn}⁻¹ is ctrl ${o.fn}. ${why}` }],
  }
}

/**
 * One value and the quadrant: the missing coordinate's size (or r) with the Pythagorean theorem, one value as a
 * decimal, then the check.
 */
export function ucGivenCalc(o: { missing: 'x' | 'y' | 'r'; r: number | null; known: number[]; size: number; ratio: { fn: string; topKeys: string; bottomKeys: string; topNs: string; bottomNs: string; value: number } }): CalcPanels {
  const [k1, k2] = o.known.map((v) => Math.abs(v)) as [number, number]
  const isR = o.missing === 'r'
  const tiFind = isR ? `2nd x² (√) ${k1} x² + ${k2} x² ) → ENTER` : `2nd x² (√) ${o.r} x² − ${k1} x² ) → ENTER`
  const nsFind = isR ? `√(${k1}² + ${k2}²) → ctrl enter` : `√(${o.r}² − ${k1}²) → ctrl enter`
  const findWhy = isR ? `It shows about ${fixed(o.size)}: r, the distance from the origin, never negative.` : `It shows about ${fixed(o.size)}: the size of ${o.missing}. The quadrant gives its sign.`
  const ratioWhy = `That is ${o.ratio.fn} θ as a decimal, about ${fixed(o.ratio.value)}. Type your exact answer and compare.`
  return {
    ti84: [
      { title: isR ? 'Find r' : `Find the size of ${o.missing}`, keys: tiFind, why: findWhy },
      { title: 'A value as a decimal', keys: `${o.ratio.topKeys} ÷ ${o.ratio.bottomKeys} → ENTER`, why: ratioWhy },
      CHECK_TI_ROOT,
    ],
    nspire: [
      { title: isR ? 'Find r' : `Find the size of ${o.missing}`, keys: nsFind, why: findWhy },
      { title: 'A value as a decimal', keys: `(${o.ratio.topNs})/(${o.ratio.bottomNs}) → ctrl enter`, why: ratioWhy },
      CHECK_NSPIRE_ROOT,
    ],
  }
}

/**
 * Every angle in one turn: the mode of the unit asked, the one angle the calculator's inverse gives (its size is the
 * reference angle), then each of her angles checked. Where π is only in radians, where her angles use it.
 */
export function ucSolveCalc(o: { fn: 'sin' | 'cos' | 'tan' | 'csc' | 'sec' | 'cot'; unit: Unit; valueKeys: string; valueNs: string; zero: boolean; principal: number; principalText: string }): CalcPanels {
  const base: 'sin' | 'cos' | 'tan' = o.fn === 'csc' ? 'sin' : o.fn === 'sec' ? 'cos' : o.fn === 'cot' ? (o.zero ? 'cos' : 'tan') : o.fn
  const reciprocal = o.fn === 'csc' || o.fn === 'sec' || (o.fn === 'cot' && !o.zero)
  const key = TI_KEY[base]
  const arg = reciprocal ? `1 ÷ ( ${o.valueKeys} )` : o.valueKeys
  const argNs = reciprocal ? `1/(${o.valueNs})` : o.valueNs
  const range: Record<'sin' | 'cos' | 'tan', Record<Unit, string>> = {
    sin: { deg: 'from −90° to 90°', rad: 'from −π/2 to π/2' },
    cos: { deg: 'from 0° to 180°', rad: 'from 0 to π' },
    tan: { deg: 'between −90° and 90°', rad: 'between −π/2 and π/2' },
  }
  const shows = `It shows about ${o.principalText}: the calculator gives one angle, ${range[base][o.unit]}. Its size is the reference angle; the sign of the value picks the quadrants.`
  const why = o.fn === 'cot' && o.zero ? 'cot θ = 0 exactly where cos θ = 0.' : reciprocal ? `${o.fn} θ is one over ${base} θ, so undo ${base} at one over the value.` : ''
  // cot as COS ÷ SIN: the TI-84 has no COT key, and 1 ÷ TAN( ) fails where tan does not exist.
  const checkKeys =
    o.fn === 'cot' ? 'COS( your angle ) ÷ SIN( your angle ) → ENTER' : reciprocal ? `1 ÷ ${key}( your angle ) → ENTER` : `${TI_KEY[o.fn as 'sin' | 'cos' | 'tan']}( your angle ) → ENTER`
  const checkNs = o.fn === 'cot' ? 'cos(your angle)/sin(your angle) → ctrl enter' : reciprocal ? `1/${base}(your angle) → ctrl enter` : `${o.fn}(your angle) → ctrl enter`
  const checkWhy = `${o.unit === 'rad' ? 'π is 2nd ^. ' : ''}Each angle in your list gives the value in the equation.`
  return {
    ti84: [tiMode(o.unit), { title: 'One angle from the calculator', keys: `2nd ${key} (${key}⁻¹) ${arg} ) → ENTER`, why: `${why ? `${why} ` : ''}${shows}` }, { title: 'Check each angle', keys: checkKeys, why: checkWhy }],
    nspire: [
      nspireMode(o.unit),
      { title: 'One angle from the calculator', keys: `${base}⁻¹(${argNs}) → ctrl enter`, why: `${why ? `${why} ` : ''}${shows}` },
      { title: 'Check each angle', keys: checkNs, why: `${o.unit === 'rad' ? 'π is the π key. ' : ''}Each angle in your list gives the value in the equation.` },
    ],
  }
}
