import { assertNoFractionalPow, toTi84 } from '../../notation/calcString'
import { betweenOf, convertExpr, fmtEndpoint, fmtNum, keyedNum, linearCrossings, list, predicateFor, probeValues, readingOf, relationText, relSymbols, singleAtom, storedValues, windowLimit } from './format'
import type { CalcInstance, CalcStep } from './types'

const NEG_KEY =
  'Type negative numbers with the (−) key at the bottom, not the subtraction key: at the start of a line − means “last answer minus”, and inside a test it gives ERR:SYNTAX.'

/** How to key the comparison and logic symbols that actually appear in `pred`. */
function testMenuHint(pred: string): string {
  const syms = relSymbols(pred)
  const parts: string[] = []
  if (syms.length > 0) parts.push(`For ${syms.join(' ')} press 2nd MATH (TEST) and pick the symbol`)
  if (/\b(and|or)\b/.test(pred)) parts.push('for and / or press 2nd MATH, then ► to LOGIC')
  return parts.length > 0 ? `${parts.join('; ')}.` : ''
}

/**
 * Store-and-test on the home screen: STO→ puts a number in X, the typed condition answers 1 or 0.
 * `first` is tested with its own note; `rest` are the edge probes.
 */
function storeAndTest(opts: {
  pred: string | null
  first: number
  firstWhy: string
  rest: readonly number[]
  testTitle: string
  testWhy: string
  restWhy: string
}): CalcStep[] {
  const { pred, first, rest } = opts
  const steps: CalcStep[] = [
    {
      title: 'Store a test value',
      keys: `2nd MODE (QUIT) to the home screen. ${keyedNum('ti84', first)} STO→ X,T,θ,n ENTER — the screen shows ${fmtNum(first)}→X.`,
      why: opts.firstWhy,
      caution: first < 0 ? NEG_KEY : undefined,
    },
    {
      title: opts.testTitle,
      keys: pred
        ? `Type ${pred} and press ENTER. ${testMenuHint(pred)}`.trim()
        : 'Type the condition from your set-builder answer (comparisons from 2nd MATH TEST, and / or from its LOGIC tab) and press ENTER.',
      why: opts.testWhy,
      caution: pred && pred.includes('(-)') ? NEG_KEY : undefined,
    },
  ]
  if (rest.length > 0) {
    steps.push({
      title: 'Test every probe',
      keys: `Repeat for x = ${list(rest)}: type the value, STO→ X,T,θ,n, ENTER; then 2nd ENTER (ENTRY) twice brings the test back — press ENTER.`,
      why: opts.restWhy,
      caution: rest.some((v) => v < 0) ? NEG_KEY : undefined,
    })
  }
  return steps
}

export function ti84Steps(inst: CalcInstance): CalcStep[] {
  const expr = toTi84(inst.expr, inst.independent ?? 'x')
  assertNoFractionalPow(expr)
  const k = inst.checkValue ?? 2
  const indepNote =
    inst.independent && inst.independent !== 'x'
      ? `The calculator only graphs X — treat ${inst.independent} as X.`
      : undefined

  if (inst.family === 'number-line') {
    const pred = predicateFor('ti84', relationText(inst), inst.independent ?? 'x')
    const probes = probeValues(inst.boundary)
    const [first = 0, ...rest] = probes
    return storeAndTest({
      pred,
      first,
      firstWhy: 'STO→ stores the number in X, so the next line is checked at exactly that x.',
      rest,
      testTitle: 'Test the set’s condition',
      testWhy:
        'The calculator answers 1 (true) or 0 (false). 1/true means that x is in the set — compare with your open/closed dots.',
      restWhy:
        'Each endpoint is tested one below, on it, and one above. On an endpoint, 1 means a closed dot (it belongs to the set) and 0 means an open dot; the values beside it show which side is shaded.',
    })
  }

  if (inst.family === 'even-odd') {
    return [
      {
        title: 'Enter f',
        keys: `Y= → Y1 = ${expr}`,
        caution: indepNote,
      },
      {
        title: 'f(−x) and −f(x)',
        keys: 'Y2 = Y1(−X)  (use the (−) key). Y3 = (−)Y1',
        why: 'If Y2 lies on Y1, even. If Y2 lies on Y3, odd. If neither, neither.',
      },
      {
        title: 'Square window + table',
        keys: `ZOOM → 5:ZSquare. 2nd WINDOW → Indpnt: Ask. 2nd GRAPH, type ${k} and ${-k}.`,
      },
    ]
  }

  if (inst.family === 'inequality') {
    const indep = inst.independent ?? 'x'
    const single = singleAtom(inst)
    const compoundPred = single ? null : predicateFor('ti84', relationText(inst), indep)
    if (compoundPred) {
      // Compound ("-2 < 2x+2 <= 0", "... or ..."): graph between the lines when there is one middle,
      // then store-and-test k and the values around each endpoint.
      const between = betweenOf(inst)
      const steps: CalcStep[] = []
      let crossings: number[] | null = null
      if (between) {
        const lo = convertExpr('ti84', between.lower, indep)
        const hi = convertExpr('ti84', between.upper, indep)
        crossings = linearCrossings(between.middle, [between.lower, between.upper], indep)
        steps.push(
          {
            title: 'Graph the middle and both bounds',
            keys: `Y= → Y1 = ${convertExpr('ti84', between.middle, indep)}, Y2 = ${lo}, Y3 = ${hi}`,
            why: `The inequality is true between the lines: for the x-values where Y1 is above Y2 = ${lo} and below Y3 = ${hi}. Touching Y2 ${between.lowerIncluded ? 'counts (≥)' : 'does not count (>)'}; touching Y3 ${between.upperIncluded ? 'counts (≤)' : 'does not count (<)'}.`,
            caution: indepNote,
          },
          {
            title: 'Friendly window',
            keys: 'ZOOM → 6:ZStandard, then ZOOM → 5:ZSquare',
            why: 'Y1 crosses each horizontal line once; those two crossings are the endpoints of your interval.',
          },
        )
      }
      const probes = probeValues(crossings ?? inst.boundary ?? [k])
      steps.push(
        ...storeAndTest({
          pred: compoundPred,
          first: k,
          firstWhy: `Start with your check value x = ${fmtNum(k)}. STO→ stores it in X, so the next line is checked at exactly that x.`,
          rest: probes,
          testTitle: 'Test the whole inequality',
          testWhy: `1 (true) means x = ${fmtNum(k)} makes every part true, so it belongs in your answer; 0 (false) means it does not. The and / or reads exactly like your set-builder form.`,
          restWhy: between
            ? '1 appears only between the lines. At an endpoint itself, 1 means that endpoint is included (closed dot, ≤) and 0 means it is left out (open dot, <).'
            : 'At an endpoint itself, 1 means it is included (closed dot) and 0 means it is left out (open dot); the neighbours show which side is shaded.',
        }),
      )
      return steps
    }

    const boundary = single ? convertExpr('ti84', `(${single.lhs})-(${single.rhs})`, indep) : expr
    const probes = inst.checkValue != null ? probeValues([inst.checkValue]).map(fmtNum) : []
    return [
      {
        title: single ? 'Graph left side minus right side' : 'Enter the related equation',
        keys: `Y= → Y1 = ${boundary}`,
        why: single
          ? `The inequality is true exactly where Y1 ${readingOf(single.op).long}. Where the graph crosses the x-axis is the boundary point.`
          : 'Graph the boundary; then read the inequality off the number line.',
        caution: indepNote,
      },
      {
        title: 'Friendly window',
        keys: 'ZOOM → 6:ZStandard, then ZOOM → 5:ZSquare',
        why: 'ZStandard is ±10 on a non-square pixel grid. ZSquare makes one x-unit look like one y-unit.',
      },
      {
        title: 'Table check (Ask)',
        keys: `2nd WINDOW (TBLSET) → Indpnt: Ask → 2nd GRAPH (TABLE). Type ${probes.length ? probes.join(', ') : 'exact x values'}.`,
        why: single
          ? `A row with ${readingOf(single.op).short} for Y1 means the original inequality is TRUE at that x.`
          : 'Same habit as the app: pick a number, see if the original inequality is true.',
        caution: probes.some((v) => v.startsWith('-')) ? 'Type negative x values with the (−) key, not the subtraction key.' : undefined,
      },
    ]
  }

  const inverse = inst.inverseExpr
    ? toTi84(inst.inverseExpr, 'x')
    : inst.pmInner
      ? toTi84(`sqrt(${inst.pmInner})`, 'x')
      : null
  if (inverse) assertNoFractionalPow(inverse)

  const enter: CalcStep = {
    title: 'Enter Y1',
    keys: `Y= → Y1 = ${expr}`,
    caution:
      expr.includes('³√(')
        ? 'Press ) to close ³√( before any trailing −1. MATH 4 pastes ³√( with an open paren — if you skip ) the CE auto-closes at the end of the line and graphs the constant-fold mistake.'
        : indepNote,
  }

  const wideTi = windowLimit(inst, 10)
  const window: CalcStep = {
    title: 'Square window',
    keys:
      windowLimit(inst, 4) === null
        ? 'ZOOM → 4:ZDecimal (already square; TRACE steps by 0.1)'
        : wideTi === null
          ? 'ZOOM → 6:ZStandard, then ZOOM → 5:ZSquare'
          : `WINDOW: Xmin = (−)${wideTi}, Xmax = ${wideTi}, Ymin = (−)${wideTi}, Ymax = ${wideTi}. Then ZOOM → 5:ZSquare.`,
    why:
      wideTi === null
        ? 'Equal pixel scaling makes y = x look like a true mirror.'
        : `ZStandard only shows −10 to 10, and this problem uses ${list(storedValues(inst).filter((v) => Math.abs(v) > 10))}. ZSquare then makes the mirror look like a mirror.`,
  }

  const yEqualsX: CalcStep = {
    title: 'Draw y = x',
    keys: 'Y2 = X. ◄ until the colour/line box left of Y2 is highlighted, ENTER. ► to the line-style field, pick Dotted-Thin, ▼ to OK, ENTER. Optionally set colour to Gray.',
    why: 'On the CE, ENTER on the icon opens a Color/Line spinner — it is not the old monochrome “cycle styles” key.',
  }

  const drawInv: CalcStep[] =
    inst.family === 'not-one-to-one' || inst.family.startsWith('inverse') || inst.family === 'function'
      ? [
          {
            title: 'DrawInv (from HOME, after the window)',
            keys: '2nd MODE (QUIT) to home. 2nd PRGM → 8:DrawInv. VARS → Y-VARS → 1:Function → 1:Y1 (or ALPHA TRACE 1). Optional: , then a colour. ENTER.',
            why: 'DrawInv must be issued from the home screen, and Y1 must be pasted — typing the letters Y 1 fails. Any later ZOOM / window / Y= change erases the drawing.',
            caution: 'If you change the window afterwards, the inverse disappears — repeat DrawInv. 2nd PRGM → 1:ClrDraw to clear. DrawInv draws the reflected relation, including extra branches when it fails the vertical line test.',
          },
        ]
      : []

  const asymptotes: CalcStep[] =
    inst.asymptotes && (inst.family === 'inverse-rational' || inst.family === 'inverse-mobius')
      ? (() => {
          const v = fmtEndpoint(inst.asymptotes.vertical)
          const h = fmtEndpoint(inst.asymptotes.horizontal)
          return [
            {
              title: 'Asymptotes swap',
              keys: `f has asymptotes x = ${v} and y = ${h}; its inverse has x = ${h} and y = ${v}. 2nd ZOOM (FORMAT) → Detect Asymptotes: On → ENTER, then GRAPH.`,
              why: `Swapping x and y turns f’s vertical asymptote x = ${v} into the inverse’s horizontal asymptote y = ${v}, and f’s horizontal y = ${h} into the inverse’s vertical x = ${h}. Detect Asymptotes (OS 5.2+) stops the CE drawing a fake vertical connecting line at x = ${v}.`,
              caution: 'Set FORMAT before DrawInv: any FORMAT change redraws the graph and erases the DrawInv picture.',
            },
          ]
        })()
      : []

  const table: CalcStep = {
    title: 'Plug-in check',
    keys:
      inst.family === 'not-one-to-one' && inst.twin != null
        ? `2nd WINDOW (TBLSET) → Indpnt: Ask. 2nd GRAPH (TABLE). Type ${k}, then ${inst.twin}.${inst.checkOutput != null ? ` Both rows show Y1 = ${inst.checkOutput}.` : ' Both rows show the same Y1.'}`
        : `2nd WINDOW (TBLSET) → Indpnt: Ask. 2nd GRAPH (TABLE). Type ${k}.`,
    why:
      inst.family === 'not-one-to-one'
        ? 'Two inputs, one output: that repeated Y1 value is the proof that f is not one-to-one.'
        : 'Mirrors the app’s “check it” habit with the stored integer.',
  }

  if (inst.family === 'plus-minus-sqrt') {
    return [
      enter,
      ...(inverse
        ? [
            {
              title: 'Positive branch',
              keys: `Y2 = ${inverse}`,
              caution: 'Close the square-root parenthesis before doing anything else.',
            },
            {
              title: 'Negative branch',
              keys: 'Y3 = (−) ALPHA TRACE 2   →   Y3 = -Y2',
              caution: 'Use the (−) key at the bottom, not the subtraction key. Paste Y2 from VARS / ALPHA TRACE — do not type the letters.',
            },
          ]
        : []),
      window,
      yEqualsX,
      table,
    ]
  }

  if (inst.family === 'not-one-to-one') {
    return [
      enter,
      window,
      yEqualsX,
      ...drawInv,
      {
        title: 'Horizontal line test',
        keys: 'From GRAPH: 2nd PRGM → 3:Horizontal. ▲/▼ moves the line, ENTER stamps it, CLEAR exits. 2nd PRGM → 1:ClrDraw removes stamps.',
        why: 'If any stamped line hits the graph twice, it is not one-to-one.',
      },
      table,
    ]
  }

  return [enter, window, yEqualsX, ...asymptotes, ...drawInv, table]
}
