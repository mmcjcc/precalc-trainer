/**
 * The transformations of g(x) = a·f(b(x − h)) + k in words, and the grader for her list of steps.
 *
 * Steps come in the standard order of application: reflect over the y-axis (b < 0), horizontal stretch or
 * compression by 1/|b| (compression when |b| > 1), horizontal shift by h, reflect over the x-axis (a < 0),
 * vertical stretch or compression by |a|, vertical shift by k. Doing them in this order turns f into g.
 *
 * Grading is by SET, order-free: each of her steps is matched to the slot it acts on (horizontal shift,
 * vertical scale, …) and compared with g's step for that slot. Her order is not checked, because textbooks
 * and teachers list these steps in different orders; the amounts are graded as the standard order needs
 * them (the horizontal shift is h, the shift of the factored form, because it is applied after the
 * horizontal scaling). `describeTransform` returns the standard order for the reveal.
 *
 * Reflections: the formula is what is being read. For the odd parents (x^3, cbrt, 1/x) a reflection over
 * the wrong axis happens to draw the same graph, but it is still the wrong reading of the formula and is
 * named (the witness says so). For the even parents (x^2, abs) a reflection over the y-axis does not change
 * the graph at all, so it is optional: listing it is correct, leaving it out is not a mistake.
 */
import type { Rational } from '@/shared/types'
import { rat, ratAbs, ratCompare, ratDiv, ratNeg } from '@/notation/rational'
import { hasUnfactoredForm, insideText, PARENTS, parentFormula, specProblem, unfactoredConstant } from './spec'
import { isMinusOne, isOne, pretty, rp, shiftWords, toRational, xMinus } from './text'
import type {
  DescribedStep,
  DescriptionGrade,
  StatementForm,
  StepCheck,
  StepInput,
  StepSlot,
  TransformMistakeKind,
  TransformSpec,
  TransformStep,
} from './types'

export const SLOT_ORDER: readonly StepSlot[] = ['reflect_y', 'h_scale', 'h_shift', 'reflect_x', 'v_scale', 'v_shift']

/** "shift right 3", "compress horizontally by a factor of 1/2", "reflect over the x-axis" (display text). */
export function stepSentence(step: TransformStep): string {
  switch (step.kind) {
    case 'reflect':
      return `reflect over the ${step.axis}-axis`
    case 'shift':
      return `shift ${step.direction} ${rp(step.amount)}`
    case 'scale':
      return `${step.word} ${step.axis}ly by a factor of ${rp(step.factor)}`
  }
}

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

/** "a, b and c". */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function shiftStep(slot: 'h_shift' | 'v_shift', v: Rational): TransformStep {
  const direction = slot === 'h_shift' ? (v.n > 0 ? 'right' : 'left') : v.n > 0 ? 'up' : 'down'
  return { kind: 'shift', direction, amount: ratAbs(v) }
}

function scaleStep(slot: 'h_scale' | 'v_scale', m: Rational): TransformStep {
  const word = ratCompare(m, rat(1)) > 0 ? 'stretch' : 'compress'
  return { kind: 'scale', axis: slot === 'h_scale' ? 'horizontal' : 'vertical', word, factor: m }
}

function stepForSlot(slot: StepSlot, value: Rational | null): TransformStep {
  switch (slot) {
    case 'reflect_x':
      return { kind: 'reflect', axis: 'x' }
    case 'reflect_y':
      return { kind: 'reflect', axis: 'y' }
    case 'h_shift':
    case 'v_shift':
      return shiftStep(slot, value!)
    case 'h_scale':
    case 'v_scale':
      return scaleStep(slot, value!)
  }
}

interface Target {
  slot: StepSlot
  /** Signed shift, or the scale multiplier; null for reflections. */
  value: Rational | null
  described: DescribedStep
  /** An even parent's reflection over the y-axis: it does not change the graph. */
  optional: boolean
}

function reasonFor(spec: TransformSpec, slot: StepSlot, form: StatementForm): string {
  const { a, b, h, k } = spec
  switch (slot) {
    case 'reflect_y':
      return 'the minus sign on x inside f'
    case 'h_scale': {
      const B = ratAbs(b)
      const out = ratCompare(B, rat(1)) > 0 ? `divided by ${rp(B)}` : `multiplied by ${rp(ratDiv(rat(1), B))}`
      return `x is multiplied by ${rp(B)} inside f, so x-values are ${out}`
    }
    case 'h_shift': {
      if (form === 'unfactored' && hasUnfactoredForm(spec)) {
        return `${pretty(insideText(spec, 'unfactored'))} = ${pretty(insideText(spec, 'factored'))} inside f`
      }
      const own = `${pretty(xMinus(h))} inside f`
      return isOne(b) ? own : `${own}, once ${rp(b)} is factored out: ${pretty(insideText(spec, 'factored'))}`
    }
    case 'reflect_x':
      return 'the minus sign in front of f'
    case 'v_scale': {
      const A = ratAbs(a)
      return `f is multiplied by ${rp(A)}, so y-values are multiplied by ${rp(A)}`
    }
    case 'v_shift':
      return k.n > 0 ? `${rp(k)} is added after f` : `${rp(ratAbs(k))} is subtracted after f`
  }
}

function targets(spec: TransformSpec, form: StatementForm): Target[] {
  const { a, b, h, k } = spec
  const values: [StepSlot, Rational | null][] = []
  if (b.n < 0) values.push(['reflect_y', null])
  if (!isOne(ratAbs(b))) values.push(['h_scale', ratDiv(rat(1), ratAbs(b))])
  if (h.n !== 0) values.push(['h_shift', h])
  if (a.n < 0) values.push(['reflect_x', null])
  if (!isOne(ratAbs(a))) values.push(['v_scale', ratAbs(a)])
  if (k.n !== 0) values.push(['v_shift', k])
  const even = PARENTS[spec.parent].symmetry === 'even'
  return values.map(([slot, value]) => {
    const step = stepForSlot(slot, value)
    return {
      slot,
      value,
      described: { slot, step, sentence: stepSentence(step), reason: reasonFor(spec, slot, form) },
      optional: slot === 'reflect_y' && even,
    }
  })
}

/**
 * The transformations from f to g in the standard order (the brief's describe(spec)). `form` only changes
 * the reason given for the horizontal shift ("2x − 6 = 2(x − 3) inside f"). Throws RangeError for an
 * invalid spec.
 */
export function describeTransform(spec: TransformSpec, options: { form?: StatementForm } = {}): DescribedStep[] {
  const problem = specProblem(spec)
  if (problem) throw new RangeError(problem)
  return targets(spec, options.form ?? 'factored').map((t) => t.described)
}

// ---------------------------------------------------------------------------
// Reading her steps
// ---------------------------------------------------------------------------

interface Norm {
  slot: StepSlot
  value: Rational | null
  step: TransformStep
  used: boolean
}

function normalizeStep(s: StepInput): Norm | string {
  if (!s || typeof s !== 'object') return 'Pick a transformation for this step.'
  if (s.kind === 'reflect') {
    if (s.axis !== 'x' && s.axis !== 'y') return 'Pick the axis of the reflection: the x-axis or the y-axis.'
    return { slot: s.axis === 'x' ? 'reflect_x' : 'reflect_y', value: null, step: { kind: 'reflect', axis: s.axis }, used: false }
  }
  if (s.kind === 'shift') {
    const dirs = ['left', 'right', 'up', 'down']
    if (!dirs.includes(s.direction)) return 'Pick the direction of the shift: left, right, up or down.'
    const amount = toRational(s.amount)
    if (!amount) return `Could not read the shift amount "${String(s.amount)}". Type a number like 3, 1/2 or 2.5.`
    if (amount.n === 0) return 'A shift by 0 does nothing. Leave that step out.'
    const positive = s.direction === 'right' || s.direction === 'up'
    const signed = positive ? amount : ratNeg(amount)
    const slot = s.direction === 'left' || s.direction === 'right' ? 'h_shift' : 'v_shift'
    return { slot, value: signed, step: shiftStep(slot, signed), used: false }
  }
  if (s.kind === 'scale') {
    if (s.axis !== 'horizontal' && s.axis !== 'vertical') return 'Pick horizontal or vertical for the stretch or compression.'
    if (s.word !== 'stretch' && s.word !== 'compress') return 'Pick stretch or compress.'
    const c = toRational(s.factor)
    if (!c) return `Could not read the factor "${String(s.factor)}". Type a number like 2 or 1/2.`
    if (c.n <= 0) return 'A stretch or compression factor is a positive number. A minus sign is a reflection: add it as its own step.'
    if (isOne(c)) return 'A factor of 1 changes nothing. Leave that step out.'
    // The word decides stretch or compress; the number is the factor or its reciprocal, whichever fits.
    const big = ratCompare(c, rat(1)) > 0
    const m = (s.word === 'stretch') === big ? c : ratDiv(rat(1), c)
    const slot = s.axis === 'horizontal' ? 'h_scale' : 'v_scale'
    return { slot, value: m, step: scaleStep(slot, m), used: false }
  }
  return 'Pick a transformation for this step.'
}

function same(a: Rational | null, b: Rational | null): boolean {
  if (a === null || b === null) return a === b
  return ratCompare(a, b) === 0
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const SLOT_NOUN: Record<StepSlot, string> = {
  reflect_y: 'reflection over the y-axis',
  h_scale: 'horizontal stretch or compression',
  h_shift: 'horizontal shift',
  reflect_x: 'reflection over the x-axis',
  v_scale: 'vertical stretch or compression',
  v_shift: 'vertical shift',
}

interface Ctx {
  spec: TransformSpec
  form: StatementForm
  /** The inside of f as the problem wrote it, display text. */
  inside: string
  formula: string
}

function oddNote(ctx: Ctx, expectedAxis: 'x' | 'y'): string {
  const sym = PARENTS[ctx.spec.parent].symmetry
  if (sym === 'odd') {
    return ` (For f(x) = ${ctx.formula}, f(−x) = −f(x), so the two reflections happen to draw the same graph, but the formula says the ${expectedAxis}-axis.)`
  }
  if (sym === 'even' && expectedAxis === 'y') {
    return ` (For f(x) = ${ctx.formula} the reflection over the y-axis does not even change the graph; the one over the x-axis flips it upside down.)`
  }
  return ''
}

function wrongAxisMessage(ctx: Ctx, expected: 'x' | 'y'): string {
  const body =
    expected === 'x'
      ? 'The minus sign is in front of f, so it changes the sign of the outputs: reflect over the x-axis. A minus sign on x inside f, as in f(−x), is what reflects over the y-axis.'
      : `The minus sign is on x inside f (${ctx.inside}), so it changes the sign of the inputs: reflect over the y-axis. A minus sign in front of f, as in −f(x), is what reflects over the x-axis.`
  return body + oddNote(ctx, expected)
}

function missingMessage(ctx: Ctx, t: Target, both: boolean): { kind: TransformMistakeKind; message: string } {
  if (t.slot === 'reflect_x' || t.slot === 'reflect_y') {
    const body =
      t.slot === 'reflect_x'
        ? `Missing: reflect over the x-axis. The minus sign in front of f (a = ${rp(ctx.spec.a)}) changes the sign of every output.`
        : `Missing: reflect over the y-axis. The minus sign on x inside f (${ctx.inside}) changes the sign of every input.`
    const note =
      both && PARENTS[ctx.spec.parent].symmetry === 'odd'
        ? ` (For f(x) = ${ctx.formula} the two reflections together give back the same shape, but the formula has both.)`
        : ''
    return { kind: 'missing_reflection', message: body + note }
  }
  return { kind: 'missing_step', message: `Missing: ${t.described.sentence}. ${cap(t.described.reason)}.` }
}

function extraMessage(ctx: Ctx, s: Norm, target: Target | undefined): string {
  const said = cap(stepSentence(s.step))
  if (target) return `You listed two ${SLOT_NOUN[s.slot]}s; g has one: ${target.described.sentence}.`
  const { a, b } = ctx.spec
  switch (s.slot) {
    case 'h_shift':
      return `${said} is not part of g: nothing is added to or subtracted from x inside f.`
    case 'v_shift':
      return `${said} is not part of g: nothing is added after f.`
    case 'h_scale':
      return isMinusOne(b)
        ? `${said} is not part of g: x is only multiplied by −1 inside f, which is a reflection, not a stretch.`
        : `${said} is not part of g: x is not multiplied by a number inside f.`
    case 'v_scale':
      return isMinusOne(a)
        ? `${said} is not part of g: f is only multiplied by −1, which is a reflection, not a stretch.`
        : `${said} is not part of g: f is not multiplied by a number.`
    case 'reflect_x':
      return `${said} is not part of g: there is no minus sign in front of f.`
    case 'reflect_y':
      return `${said} is not part of g: there is no minus sign on x inside f.`
  }
}

/** Her step is in g's slot but has another value: a named mistake when one fits, else a plain sentence. */
function valueMessage(ctx: Ctx, t: Target, s: Norm): { kind?: TransformMistakeKind; message: string } {
  const { spec, form } = ctx
  const target = t.described.sentence
  const hers = stepSentence(s.step)
  const v = s.value!
  const want = t.value!
  switch (t.slot) {
    case 'h_shift': {
      const reversed = ratCompare(v, ratNeg(want)) === 0
      const c = unfactoredConstant(spec)
      const unfactored = hasUnfactoredForm(spec) && ratCompare(v, c) === 0
      const factored = pretty(insideText(spec, 'factored'))
      const unf = pretty(insideText(spec, 'unfactored'))
      const reversedMsg = {
        kind: 'h_shift_reversed' as const,
        message: `The inside of f, ${ctx.inside}, is 0 at x = ${rp(want)}: the point of f at x = 0 moves to x = ${rp(want)}. So g shifts ${shiftWords(want, 'h')}, not ${shiftWords(v, 'h')}.`,
      }
      const unfactoredMsg = {
        kind: 'unfactored_shift' as const,
        message:
          form === 'unfactored'
            ? `Factor ${rp(spec.b)} out of the inside first: ${unf} = ${factored}. The shift is what is subtracted from x after factoring, so g shifts ${shiftWords(want, 'h')}, not ${shiftWords(v, 'h')}.`
            : `In ${factored} the ${rp(spec.b)} multiplies (${pretty(xMinus(want))}) as a whole, so g shifts ${shiftWords(want, 'h')}. ${cap(shiftWords(v, 'h'))} comes from the multiplied-out inside ${unf}, whose constant is not the shift.`,
      }
      const order = form === 'unfactored' ? [unfactored && unfactoredMsg, reversed && reversedMsg] : [reversed && reversedMsg, unfactored && unfactoredMsg]
      const hit = order.find((m) => m)
      if (hit) return hit
      const hint = isOne(spec.b) ? `The inside ${ctx.inside} is 0 at x = ${rp(want)}.` : `Factor ${rp(spec.b)} out of the inside: ${factored}.`
      return { message: `g shifts ${shiftWords(want, 'h')}, not ${shiftWords(v, 'h')}. ${hint}` }
    }
    case 'v_shift': {
      if (ratCompare(v, ratNeg(want)) === 0) {
        const verb = want.n > 0 ? `adds ${rp(want)} to` : `subtracts ${rp(ratAbs(want))} from`
        const sign = want.n > 0 ? `+ ${rp(want)}` : `− ${rp(ratAbs(want))}`
        return {
          kind: 'v_shift_reversed',
          message: `The ${sign} after f ${verb} every output, so g shifts ${shiftWords(want, 'v')}, not ${shiftWords(v, 'v')}.`,
        }
      }
      return { message: `g shifts ${shiftWords(want, 'v')}, not ${shiftWords(v, 'v')}: ${t.described.reason}.` }
    }
    case 'h_scale': {
      const B = ratAbs(spec.b)
      if (ratCompare(v, B) === 0) {
        const neg = spec.b.n < 0 ? ' (the minus sign is the reflection)' : ''
        return {
          kind: 'h_factor_inverted',
          message: `Inside f, x is multiplied by ${rp(B)}${neg}. f(${B.d === 1 ? rp(B) : `(${rp(B)})`}x) at x = 1 is f(${rp(B)}): every x-value is divided by ${rp(B)}, so ${target}, not ${hers}.`,
        }
      }
      return { message: `g's horizontal factor is ${rp(want)} (${target}), not ${rp(v)}: ${t.described.reason}.` }
    }
    case 'v_scale': {
      const A = ratAbs(spec.a)
      if (ratCompare(v, ratDiv(rat(1), A)) === 0) {
        const neg = spec.a.n < 0 ? ' (the minus sign is the reflection)' : ''
        return {
          kind: 'v_factor_inverted',
          message: `f is multiplied by ${rp(A)}${neg}, so every y-value is multiplied by ${rp(A)}: ${target}, not ${hers}.`,
        }
      }
      return { message: `g's vertical factor is ${rp(want)} (${target}), not ${rp(v)}: ${t.described.reason}.` }
    }
    default:
      return { message: `${cap(target)}.` }
  }
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

/**
 * Grade her list of steps as a set (see the file comment). Every step of g gets one check (correct, wrong,
 * missing) and every step of hers that g does not have gets an 'extra' check; each non-correct check names
 * its mistake when one fits. `form` says how the problem wrote the inside of f (the unfactored-shift trap).
 */
export function gradeDescription(
  spec: TransformSpec,
  chosen: readonly StepInput[],
  options: { form?: StatementForm } = {},
): DescriptionGrade {
  const problem = specProblem(spec)
  if (problem) return { verdict: 'unsupported', message: `This transformation is not valid: ${problem}.` }
  const form = options.form ?? 'factored'
  const hers: Norm[] = []
  for (let i = 0; i < chosen.length; i++) {
    const n = normalizeStep(chosen[i]!)
    if (typeof n === 'string') return { verdict: 'invalid', message: n, index: i }
    hers.push(n)
  }
  const T = targets(spec, form)
  const ctx: Ctx = { spec, form, inside: pretty(insideText(spec, form)), formula: pretty(parentFormula(spec.parent)) }
  const bySlot = (slot: StepSlot) => T.find((t) => t.slot === slot)
  const mineIn = (slot: StepSlot) => hers.filter((s) => s.slot === slot && !s.used)

  // A reflection on the wrong axis is one mistake, not a missing step plus an extra one.
  let swap: { expected: Target; chosen: Norm } | null = null
  const tX = bySlot('reflect_x')
  const tY = bySlot('reflect_y')
  const hX = mineIn('reflect_x')
  const hY = mineIn('reflect_y')
  if (tX && !tY && hY.length && !hX.length) swap = { expected: tX, chosen: hY[0]! }
  else if (tY && !tX && hX.length && !hY.length) swap = { expected: tY, chosen: hX[0]! }
  if (swap) swap.chosen.used = true
  const bothReflections = !!tX && !!tY

  const checks: StepCheck[] = []
  let optionalOmitted: Target | null = null
  for (const slot of SLOT_ORDER) {
    const t = bySlot(slot)
    if (t) {
      if (swap && swap.expected === t) {
        checks.push({
          slot,
          status: 'wrong',
          expected: t.described,
          chosen: swap.chosen.step,
          mistake: 'reflection_wrong_axis',
          message: wrongAxisMessage(ctx, slot === 'reflect_x' ? 'x' : 'y'),
        })
      } else {
        const mine = mineIn(slot)
        const exact = mine.find((s) => same(s.value, t.value))
        if (exact) {
          exact.used = true
          checks.push({ slot, status: 'correct', expected: t.described, chosen: exact.step, message: `${cap(t.described.sentence)}: ${t.described.reason}.` })
        } else if (mine.length) {
          const s = mine[0]!
          s.used = true
          const m = valueMessage(ctx, t, s)
          const check: StepCheck = { slot, status: 'wrong', expected: t.described, chosen: s.step, message: m.message }
          if (m.kind) check.mistake = m.kind
          checks.push(check)
        } else if (t.optional) {
          optionalOmitted = t
        } else {
          const m = missingMessage(ctx, t, bothReflections)
          checks.push({ slot, status: 'missing', expected: t.described, mistake: m.kind, message: m.message })
        }
      }
    }
    for (const s of mineIn(slot)) {
      s.used = true
      checks.push({ slot, status: 'extra', chosen: s.step, mistake: 'extra_step', message: extraMessage(ctx, s, t) })
    }
  }

  const bad = checks.filter((c) => c.status !== 'correct')
  if (!bad.length) {
    const list = T.map((t) => t.described.sentence)
    const note = optionalOmitted
      ? ` (The formula also reflects over the y-axis, but for f(x) = ${ctx.formula} that does not change the graph: f(−x) = f(x).)`
      : ''
    const body = list.length ? `${joinList(list)}.` : 'g is f itself: no transformations.'
    return { verdict: 'correct', message: `Correct: ${body}${note}`, checks }
  }
  const named = bad.find((c) => c.mistake)
  if (named) return { verdict: 'mistake', mistake: named.mistake!, witness: named.message, checks }
  return { verdict: 'wrong', message: bad[0]!.message, checks }
}

/** g's steps as `StepInput`s (for tests and for a "show me" reveal that fills the UI). */
export function describeAsInputs(spec: TransformSpec): StepInput[] {
  return describeTransform(spec).map((d) => d.step as StepInput)
}
