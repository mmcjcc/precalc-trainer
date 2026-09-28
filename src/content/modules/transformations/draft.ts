/**
 * Seeded transformation specs. Same seed → same spec. A draft is rejected when it would hide a
 * reflection (y-axis on x^2 or |x|, both axes on an odd parent) or, for a point question, when
 * every key point has two mistakes that land on the same answer.
 */
import { makeRng, type Rng } from '@/content/rng'
import {
  describeAsInputs,
  describeTransform,
  gradeDescription,
  gradeMappedPoint,
  hasUnfactoredForm,
  makeTransform,
  mappedPointMistakes,
  mapPoint,
  PARENTS,
  type ExactPoint,
  type ParentName,
  type StatementForm,
  type TransformSpec,
} from '@/engine'
import { ratToString } from '@/notation'

export type TransformQuestion = 'describe' | 'point' | 'equation'

const ALL: readonly ParentName[] = ['square', 'cube', 'sqrt', 'cbrt', 'abs', 'reciprocal']
const NOT_EVEN: readonly ParentName[] = ['sqrt', 'cube', 'cbrt', 'reciprocal']
const EVEN = new Set<ParentName>(['square', 'abs'])
const ODD = new Set<ParentName>(['cube', 'cbrt', 'reciprocal'])

const TRAPS: Record<TransformQuestion, readonly string[]> = {
  describe: ['shift-right', 'shift-left', 'unfactored', 'h-compress', 'h-stretch', 'reflect-x', 'reflect-y', 'v-stretch', 'v-compress'],
  point: [
    'shift-right',
    'shift-left',
    'unfactored',
    'h-compress',
    'h-stretch',
    'reflect-x',
    'reflect-y',
    'v-stretch',
    'v-compress',
    'v-order',
    'h-order',
    'factors',
  ],
  equation: ['shift-right', 'shift-left', 'unfactored', 'h-compress', 'h-stretch', 'reflect-x', 'reflect-y', 'v-stretch', 'v-compress', 'v-order'],
}

type Mag = number | string

export interface TransformDraft {
  spec: TransformSpec
  form: StatementForm
  trap: string
  /** A key point of f whose mistake candidates do not shadow each other. Point questions only. */
  point?: ExactPoint
}

function negMag(mag: Mag): Mag {
  if (typeof mag === 'number') return -mag
  return mag.startsWith('-') ? mag.slice(1) : `-${mag}`
}

function score(p: ExactPoint): number {
  let s = 0
  if (p.x.n !== 0) s += 4
  if (p.y.n !== 0) s += 4
  s -= Math.abs(p.x.n) / p.x.d
  return s
}

/** First key point whose candidates are unambiguous and include the trap's mistake, if it has one. */
function pickPoint(spec: TransformSpec, form: StatementForm, trap: string): ExactPoint | null {
  const pts = [...PARENTS[spec.parent].keyPoints].sort((a, b) => score(b) - score(a))
  for (const p of pts) {
    if ((trap === 'v-order' || trap === 'v-stretch' || trap === 'v-compress') && p.y.n === 0) continue
    const ms = mappedPointMistakes(spec, p, { form })
    if (!ms || ms.some((c) => c.shadows.length > 0)) continue
    const kinds = new Set(ms.map((c) => c.kind))
    if (trap === 'v-order' && !kinds.has('v_order')) continue
    if (trap === 'h-order' && !kinds.has('h_order')) continue
    if (trap === 'unfactored' && !kinds.has('unfactored_shift')) continue
    if (trap === 'factors' && !kinds.has('factors_swapped')) continue
    if ((trap === 'reflect-x' || trap === 'reflect-y') && !kinds.has('reflection_wrong_axis') && !kinds.has('missing_reflection')) continue
    if ((trap === 'h-compress' || trap === 'h-stretch') && !kinds.has('h_factor_inverted')) continue
    if ((trap === 'v-stretch' || trap === 'v-compress') && !kinds.has('v_factor_inverted')) continue
    if ((trap === 'shift-right' || trap === 'shift-left') && !kinds.has('h_shift_reversed')) continue
    const image = mapPoint(spec, p)
    const text = `(${ratToString(image.x)}, ${ratToString(image.y)})`
    if (gradeMappedPoint(spec, p, text, { form }).verdict !== 'correct') continue
    return p
  }
  return null
}

function attempt(rng: Rng, question: TransformQuestion, trap: string): TransformDraft | null {
  const equation = question === 'equation'
  // An equation compares functions. On an odd parent the two reflections draw the same graph, and on
  // an even parent a y-axis reflection is invisible, so those traps use the square root.
  const parent: ParentName =
    equation && (trap === 'reflect-x' || trap === 'reflect-y') ? 'sqrt' : trap === 'reflect-y' ? rng.pick(NOT_EVEN) : rng.pick(ALL)

  let a: Mag = 1
  let b: Mag = 1
  let h = 0
  let k = 0
  let aNeg = false
  let bNeg = false

  switch (trap) {
    case 'shift-right':
      h = rng.int(1, 4)
      if (rng.chance(0.55)) k = rng.intExcept(-3, 3, [0])
      if (rng.chance(0.3)) aNeg = true
      break
    case 'shift-left':
      h = -rng.int(1, 4)
      if (rng.chance(0.55)) k = rng.intExcept(-3, 3, [0])
      if (rng.chance(0.3)) aNeg = true
      break
    case 'unfactored':
      b = rng.pick([2, 3])
      h = rng.int(1, 4)
      if (rng.chance(0.45)) k = rng.intExcept(-3, 3, [0])
      if (!EVEN.has(parent) && rng.chance(0.2)) bNeg = true
      break
    case 'h-compress':
      b = rng.pick([2, 3])
      break
    case 'h-stretch':
      b = rng.pick(['1/2', '1/3'])
      break
    case 'reflect-x':
      aNeg = true
      // |a| = 1 makes "flip x" the same point as swapping a and b, so every point is shadowed.
      if (question === 'point') a = rng.pick([2, 3])
      else {
        if (rng.chance(0.4)) h = rng.intExcept(-3, 3, [0])
        if (rng.chance(0.35)) k = rng.intExcept(-3, 3, [0])
      }
      break
    case 'reflect-y':
      bNeg = true
      if (question === 'point') a = rng.pick([2, 3])
      else if (rng.chance(0.4)) h = rng.intExcept(-3, 3, [0])
      break
    case 'v-stretch':
      a = rng.pick([2, 3])
      if (rng.chance(0.5)) k = rng.intExcept(-3, 3, [0])
      break
    case 'v-compress':
      a = rng.pick(['1/2', '1/3'])
      if (rng.chance(0.5)) k = rng.intExcept(-3, 3, [0])
      break
    case 'v-order':
      a = rng.pick([2, 3])
      aNeg = true
      k = rng.intExcept(-3, 3, [0])
      if (rng.chance(0.35)) h = rng.intExcept(-3, 3, [0])
      break
    case 'h-order':
      b = rng.pick([2, 3])
      h = rng.int(1, 4)
      break
    case 'factors':
      a = rng.pick([2, 3])
      b = a === 2 ? 3 : 2
      break
    default:
      return null
  }

  if (bNeg && EVEN.has(parent)) return null
  if (aNeg && bNeg && ODD.has(parent)) return null

  let spec: TransformSpec
  try {
    spec = makeTransform(parent, { a: aNeg ? negMag(a) : a, b: bNeg ? negMag(b) : b, h, k })
  } catch {
    return null
  }
  if (EVEN.has(spec.parent) && spec.b.n < 0) return null
  if (ODD.has(spec.parent) && spec.a.n < 0 && spec.b.n < 0) return null

  const form: StatementForm = question !== 'equation' && trap === 'unfactored' ? 'unfactored' : 'factored'
  if (trap === 'unfactored' && !hasUnfactoredForm(spec)) return null

  let steps
  try {
    steps = describeTransform(spec, { form })
  } catch {
    return null
  }
  if (steps.length === 0) return null
  if (gradeDescription(spec, describeAsInputs(spec), { form }).verdict !== 'correct') return null

  if (question !== 'point') return { spec, form, trap }
  const point = pickPoint(spec, form, trap)
  if (!point) return null
  return { spec, form, trap, point }
}

/** A core-supported spec for this seed. Throws if sixty draws all fail: that is a template bug. */
export function draftTransform(seed: number, question: TransformQuestion): TransformDraft {
  const rng = makeRng(seed >>> 0)
  const traps = TRAPS[question]
  const trap = traps[(seed >>> 0) % traps.length]!
  for (let n = 0; n < 60; n++) {
    const draft = attempt(rng, question, trap)
    if (draft) return draft
  }
  throw new Error(`transformations ${question}/${trap}: no core-supported spec for seed ${seed}`)
}
