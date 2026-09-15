import { assertNoFractionalPow, toNspire } from '../../notation/calcString'
import { betweenOf, convertExpr, fmtEndpoint, fmtNum, keyedNum, linearCrossings, list, OP_GLYPH, predicateFor, probeValues, readingOf, relationText, singleAtom, storedValues, windowLimit } from './format'
import type { CalcInstance, CalcStep } from './types'

const NEG_KEY =
  'Type negative numbers with the (−) key, not the subtraction key: at the start of a line − means “last answer minus”.'

/**
 * Store-and-test in Scratchpad Calculate: ctrl var (→) stores a number in x, the typed condition
 * answers true or false. `first` is tested with its own note; `rest` are the edge probes.
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
  const logic = pred && /\b(and|or)\b/.test(pred) ? ' Type the words and / or letter by letter.' : ''
  const steps: CalcStep[] = [
    {
      title: 'Store a test value',
      keys: `Scratchpad Calculate: type ${keyedNum('nspire', first)}, press ctrl var (→), type x, press enter — the screen shows ${fmtNum(first)}→x.`,
      why: opts.firstWhy,
      caution: first < 0 ? NEG_KEY : undefined,
    },
    {
      title: opts.testTitle,
      keys: pred
        ? `Type ${pred} and press enter. < > = are on the keypad; ctrl = opens the palette with ≤ ≥ (or type <= and >=).${logic}`
        : 'Type the condition from your set-builder answer (≤ ≥ from the ctrl = palette, the words and / or typed out) and press enter.',
      why: opts.testWhy,
      caution: pred && /(^|[\s(])-/.test(pred) ? NEG_KEY : undefined,
    },
  ]
  if (rest.length > 0) {
    steps.push({
      title: 'Test every probe',
      keys: `Repeat for x = ${list(rest)}: type the value, ctrl var (→), x, enter; then ▲ to highlight your condition, enter to copy it down, enter again.`,
      why: opts.restWhy,
      caution: rest.some((v) => v < 0) ? NEG_KEY : undefined,
    })
  }
  return steps
}

export function nspireSteps(inst: CalcInstance): CalcStep[] {
  const expr = toNspire(inst.expr, inst.independent ?? 'x')
  assertNoFractionalPow(expr)
  const k = inst.checkValue ?? 2
  const rename =
    inst.independent && inst.independent !== 'x'
      ? `The calculator only graphs x — treat ${inst.independent} as x.`
      : undefined

  const scratch: CalcStep = {
    title: 'Work in Scratchpad',
    keys: 'Press the Scratchpad key to open. Press it again to toggle Calculate ↔ Graph. Stay in Scratchpad so f1 is visible to both views.',
    why: 'Scratchpad Graph and Scratchpad Calculate share variables. A document Calculator page does not share with Scratchpad.',
    caution: rename,
  }

  if (inst.family === 'number-line') {
    const pred = predicateFor('nspire', relationText(inst), inst.independent ?? 'x')
    const probes = probeValues(inst.boundary)
    const [first = 0, ...rest] = probes
    return [
      {
        title: 'Open Scratchpad Calculate',
        keys: 'Press the Scratchpad key. If it opens on Graph, press it again to switch to Calculate.',
        why: 'You are testing numbers, not drawing: Calculate is enough.',
      },
      ...storeAndTest({
        pred,
        first,
        firstWhy: '→ stores the number in x, so the next line is checked at exactly that x.',
        rest,
        testTitle: 'Test the set’s condition',
        testWhy: 'The answer is true or false. 1/true means that x is in the set — compare with your open/closed dots.',
        restWhy:
          'Each endpoint is tested one below, on it, and one above. On an endpoint, true means a closed dot (it belongs to the set) and false means an open dot; the values beside it show which side is shaded.',
      }),
    ]
  }

  if (inst.family === 'even-odd') {
    return [
      scratch,
      {
        title: 'Enter f',
        keys: `f1(x) = ${expr}`,
      },
      {
        title: 'f(−x) and −f(x)',
        keys: 'f2(x) = f1(−x). f3(x) = −f1(x).',
        why: 'If f2 lies on f1, even. If f2 lies on f3, odd.',
      },
      {
        title: 'Numeric check',
        keys: `Scratchpad Calculate: f1(${k}), f1(${-k}), −f1(${k}).`,
      },
    ]
  }

  if (inst.family === 'inequality') {
    const indep = inst.independent ?? 'x'
    const single = singleAtom(inst)
    const compoundPred = single ? null : predicateFor('nspire', relationText(inst), indep)
    if (compoundPred) {
      const between = betweenOf(inst)
      const steps: CalcStep[] = [scratch]
      let crossings: number[] | null = null
      if (between) {
        const lo = convertExpr('nspire', between.lower, indep)
        const hi = convertExpr('nspire', between.upper, indep)
        crossings = linearCrossings(between.middle, [between.lower, between.upper], indep)
        steps.push(
          {
            title: 'Graph the middle and both bounds',
            keys: `Scratchpad Graph → f1(x) = ${convertExpr('nspire', between.middle, indep)}, f2(x) = ${lo}, f3(x) = ${hi}`,
            why: `The inequality is true between the lines: for the x-values where f1 is above f2 = ${lo} and below f3 = ${hi}. Touching f2 ${between.lowerIncluded ? 'counts (≥)' : 'does not count (>)'}; touching f3 ${between.upperIncluded ? 'counts (≤)' : 'does not count (<)'}.`,
            caution: 'On Nspire, x(y+2) is a function call: type the * between a number or letter and a parenthesis.',
          },
          {
            title: 'Window',
            keys: 'menu → Window/Zoom → Zoom – Standard (already square). If you typed a window or split with ctrl+T: menu → Window/Zoom → Zoom – Square.',
            why: 'f1 crosses each horizontal line once; those two crossings are the endpoints of your interval.',
          },
        )
      }
      const probes = probeValues(crossings ?? inst.boundary ?? [k])
      steps.push(
        ...storeAndTest({
          pred: compoundPred,
          first: k,
          firstWhy: `Start with your check value x = ${fmtNum(k)}. → stores it in x, so the next line is checked at exactly that x.`,
          rest: probes,
          testTitle: 'Test the whole inequality',
          testWhy: `true means x = ${fmtNum(k)} makes every part true, so it belongs in your answer; false means it does not. The and / or reads exactly like your set-builder form.`,
          restWhy: between
            ? 'true appears only between the lines. At an endpoint itself, true means that endpoint is included (closed dot, ≤) and false means it is left out (open dot, <).'
            : 'At an endpoint itself, true means it is included (closed dot) and false means it is left out (open dot); the neighbours show which side is shaded.',
        }),
      )
      return steps
    }

    const boundary = single ? convertExpr('nspire', `(${single.lhs})-(${single.rhs})`, indep) : expr
    const probes = inst.checkValue != null ? probeValues([inst.checkValue]).map(fmtNum) : []
    const steps: CalcStep[] = [
      scratch,
      {
        title: single ? 'Graph left side minus right side' : 'Graph the boundary',
        keys: `Scratchpad Graph → enter f1(x) = ${boundary}`,
        why: single ? `The inequality is true exactly where f1 ${readingOf(single.op).long}.` : undefined,
        caution: 'On Nspire, x(y+2) is a function call: type the * between a number or letter and a parenthesis.',
      },
    ]
    if (single) {
      steps.push({
        title: 'Shade the solution set',
        keys: `ctrl+G, then menu → Graph Entry/Edit → Relation. Type ${convertExpr('nspire', single.lhs, indep)} ${OP_GLYPH[single.op]} ${convertExpr('nspire', single.rhs, indep)} and press enter.`,
        why: 'The shaded vertical strip is every x that makes the inequality true: the same set as your interval.',
        caution: single.op.length === 2 ? 'For ≤ or ≥ press ctrl and = to open the comparison palette.' : undefined,
      })
    }
    steps.push(
      {
        title: 'Window',
        keys: 'menu → Window/Zoom → Zoom – Standard (already square). If you typed a window or split with ctrl+T: menu → Window/Zoom → Zoom – Square.',
      },
      {
        title: 'Numeric check',
        keys: probes.length
          ? `Scratchpad Calculate: type ${probes.map((v) => `f1(${v})`).join(', then ')}, pressing enter after each.`
          : 'Scratchpad Calculate: type f1( a test x ) and press enter.',
        why: single
          ? `Getting ${readingOf(single.op).short} means the original inequality is TRUE at that x.`
          : 'Non-CAS will not solve the inequality symbolically.',
        caution: probes.some((v) => v.startsWith('-')) ? 'Type negative inputs with the (−) key, not the subtraction key.' : undefined,
      },
    )
    return steps
  }

  const inverse = inst.inverseExpr ? toNspire(inst.inverseExpr, 'x') : null
  if (inverse) assertNoFractionalPow(inverse)

  const enter: CalcStep = {
    title: 'Enter f1',
    keys: `Scratchpad Graph: f1(x) = ${expr}`,
    caution: expr.includes('root(')
      ? 'Use the nth-root template (ctrl+^ , index 3) or typed root(u,3). Never use the ^ key with the exponent 1/3 — negatives become Non-real and the left half of the graph vanishes.'
      : undefined,
  }

  const wideNs = windowLimit(inst, 6)
  const window: CalcStep = {
    title: 'Window',
    keys:
      wideNs === null
        ? 'menu → Window/Zoom → Zoom – Standard (already equal-scale). After a manual window or ctrl+T split: menu → Window/Zoom → Zoom – Square.'
        : `menu → Window/Zoom → Window Settings: XMin = -${wideNs}, XMax = ${wideNs}, YMin = -${wideNs}, YMax = ${wideNs}, OK. Then menu → Window/Zoom → Zoom – Square.`,
    why:
      wideNs === null
        ? undefined
        : `Zoom – Standard only shows y from about −6.7 to 6.7, and this problem uses ${list(storedValues(inst).filter((v) => Math.abs(v) > 6))}.`,
  }

  const mirror: CalcStep = {
    title: 'y = x',
    keys: 'f4(x) = x. Style it dotted if you like (menu → Attributes).',
  }

  const invGraph: CalcStep = inverse
    ? {
        title: 'Enter the inverse as f2',
        keys: `f2(x) = ${inverse}`,
        why: 'There is no DrawInv on Nspire. Type the inverse (or use Relation x = f1(y) from Graph Entry/Edit → Relation).',
      }
    : {
        title: 'Inverse as a relation',
        keys: 'menu → Graph Entry/Edit → Relation → x = f1(y). This draws the reflected relation, including extra branches when it fails the vertical line test.',
        why: 'Relation graphing is on every CX II (OS 5+). There is no DrawInv.',
      }

  const asymptotes: CalcStep[] =
    inst.asymptotes && (inst.family === 'inverse-rational' || inst.family === 'inverse-mobius')
      ? (() => {
          const v = fmtEndpoint(inst.asymptotes.vertical)
          const h = fmtEndpoint(inst.asymptotes.horizontal)
          return [
            {
              title: 'Asymptotes swap',
              keys: `f1 has asymptotes x = ${v} and y = ${h}; its inverse has x = ${h} and y = ${v}. Optional: f5(x) = ${h} and f6(x) = ${v} draw the two horizontal asymptotes.`,
              why: `Swapping x and y turns f’s vertical asymptote x = ${v} into the inverse’s horizontal asymptote y = ${v}, and f’s horizontal y = ${h} into the inverse’s vertical x = ${h}. The grapher breaks each curve at its vertical asymptote automatically, so no fake connecting line appears.`,
            },
          ]
        })()
      : []

  const roundTrip: CalcStep = inverse
    ? {
        title: 'Numeric round-trip (non-CAS)',
        keys: `Scratchpad Calculate: f1(f2(${k})) and f2(f1(${k})). Both should return ${k}.`,
        why: 'Non-CAS cannot simplify f1(f2(x)) symbolically — it needs a number. The grapher CAN plot f3(x)=f1(f2(x)) because it evaluates numerically.',
      }
    : {
        title: 'Plug-in check',
        keys: `Scratchpad Calculate: type f1(${k}) and press enter.${inst.checkOutput != null ? ` It returns ${inst.checkOutput}.` : ''}`,
        why: 'Mirrors the app’s “check it” habit with the stored integer.',
        caution: k < 0 ? 'Type negative inputs with the (−) key, not the subtraction key.' : undefined,
      }

  if (inst.family === 'plus-minus-sqrt') {
    const branch = inverse ?? (inst.pmInner ? toNspire(`sqrt(${inst.pmInner})`, 'x') : null)
    if (branch) assertNoFractionalPow(branch)
    return [
      scratch,
      enter,
      {
        title: 'Both branches at once',
        keys: 'Graph Entry/Edit → Relation → x = f1(y) draws both ± branches.',
        why: branch
          ? `To compare with your algebraic ±√ answer, also type f2(x) = ${branch} and f3(x) = −f2(x).`
          : 'Only type f3(x)=−f2(x) if you want to compare your algebraic ±√ answer side by side.',
      },
      window,
      mirror,
      {
        title: 'Plug-in check',
        keys: `Scratchpad Calculate: type f1(${k}) and press enter.${inst.checkOutput != null ? ` It returns ${inst.checkOutput}.` : ''}`,
        why: 'The relation x = f1(y) passes through the swapped point: if f1 sends k to f1(k), the reflected graph sends f1(k) back to k on one of its two branches.',
        caution: k < 0 ? 'Type negative inputs with the (−) key, not the subtraction key.' : undefined,
      },
    ]
  }

  if (inst.family === 'not-one-to-one') {
    return [
      scratch,
      enter,
      window,
      mirror,
      invGraph,
      {
        title: 'Horizontal line test',
        keys: 'ctrl+G, enter f9(x)=2, Enter. Hover the new horizontal line until the 4-way arrow appears, click-and-hold (or ctrl+click), ▲/▼ to slide it, esc to drop. If any height crosses f1 twice, f1 is not one-to-one.',
        why: 'There is no DRAW → Horizontal. Use a high slot (f9) so it does not collide with f2/f3.',
      },
      {
        title: 'Two inputs, one output',
        keys:
          inst.twin != null
            ? `Scratchpad Calculate: type f1(${k}) and press enter, then f1(${inst.twin}) and enter.${inst.checkOutput != null ? ` Both return ${inst.checkOutput}.` : ' Both return the same number.'}`
            : `Scratchpad Calculate: type f1(${k}) and press enter, then try the input on the other side of the vertex.`,
        why: 'Two different inputs landing on the same output is exactly what "not one-to-one" means: no inverse function could send that output back to both.',
        caution: k < 0 || (inst.twin != null && inst.twin < 0) ? 'Type negative inputs with the (−) key, not the subtraction key.' : undefined,
      },
    ]
  }

  return [scratch, enter, window, mirror, invGraph, ...asymptotes, roundTrip]
}
