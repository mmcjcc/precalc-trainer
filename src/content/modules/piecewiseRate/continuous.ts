/**
 * pw.continuous: find k so two pieces meet. k is a constant term or a coefficient, on one side only.
 * Traps: the boundary's x-value in the k piece, the opposite sign, and the other boundary.
 */
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import { evaluatePiecewise } from '@/engine'
import { rat, ratAdd, ratDiv, ratEquals, ratMul, ratNeg, ratSub, ratToString, type Rational } from '@/notation'
import { buildMore } from './build'
import { gradeK } from './grade'
import { ZERO, linearFormula, piece, showMinus, sketchOf, storedPiece, type Expr } from './model'
import { PW_RULE_IDS } from './rules'

const VERSION = 1
const TRIES = 64

const TRAPS = ['pw_k_wrong_piece', 'pw_k_sign', 'pw_k_other_boundary'] as const
type KTrap = (typeof TRAPS)[number]

const SLOPE_N = [-3, -2, -1, 1, 2, 3] as const

/** Coefficient of x: "2", "", "-", "-2", "(1/2)", "-(1/2)". */
function slopeCoeff(kText: string): string {
  if (kText === '1') return ''
  if (kText === '-1') return '-'
  if (/^-?\d+$/.test(kText)) return kText
  if (kText.startsWith('-')) return `-(${kText.slice(1)})`
  return `(${kText})`
}

/** Put k into a formula. "kx" is replaced before "k". A half slope is "(1/2)x" or "-(1/2)x". */
export function substituteK(formula: string, kText: string): string {
  let out = formula.replaceAll('kx', `${slopeCoeff(kText)}x`)
  if (/^\d+$/.test(kText)) return out.replaceAll('k', kText)
  if (/^-\d+$/.test(kText)) return out.replaceAll('+ k', `- ${kText.slice(1)}`).replaceAll('k', `(${kText})`)
  return out.replaceAll('k', `(${kText})`)
}

interface Side {
  /** y = num(x) + k * coef(x). coef is 0 when this side has no k. */
  num: (x: Rational) => Rational
  coef: (x: Rational) => Rational
  formulaK: string
  expr: (k: Rational) => Expr
}

function fixedLinear(m: Rational, b: Rational): Side {
  return {
    num: (x) => ratAdd(ratMul(m, x), b),
    coef: () => ZERO,
    formulaK: linearFormula(m, b),
    expr: () => ({ kind: 'linear', m, b }),
  }
}

function fixedSquare(): Side {
  return {
    num: (x) => ratMul(x, x),
    coef: () => ZERO,
    formulaK: 'x^2',
    expr: () => ({ kind: 'square' }),
  }
}

function kAsConstant(m: Rational): Side {
  return {
    num: (x) => ratMul(m, x),
    coef: () => rat(1),
    formulaK: ratEquals(m, ZERO) ? 'k' : `${linearFormula(m, ZERO)} + k`.replace(' + 0', ''),
    expr: (k) => ({ kind: 'linear', m, b: k }),
  }
}

function kAsSlope(b: Rational): Side {
  const tail = ratEquals(b, ZERO) ? '' : b.n < 0 ? ` - ${ratToString(ratNeg(b))}` : ` + ${ratToString(b)}`
  return {
    num: () => b,
    coef: (x) => x,
    formulaK: `kx${tail}`,
    expr: (k) => ({ kind: 'linear', m: k, b }),
  }
}

function solve(left: Side, right: Side, x: Rational): Rational | null {
  const denom = ratSub(left.coef(x), right.coef(x))
  if (ratEquals(denom, ZERO)) return null
  return ratDiv(ratSub(right.num(x), left.num(x)), denom)
}

/** num + coef*k = target. */
function solveSide(side: Side, x: Rational, target: Rational): Rational | null {
  const coef = side.coef(x)
  if (ratEquals(coef, ZERO)) return null
  return ratDiv(ratSub(target, side.num(x)), coef)
}

function nice(k: Rational): boolean {
  return k.n !== 0 && k.d >= 1 && k.d <= 4
}

function at(side: Side, k: Rational, x: Rational): Rational {
  return ratAdd(side.num(x), ratMul(side.coef(x), k))
}

interface Draft {
  left: Side
  right: Side
  kSide: 'left' | 'right'
  k: Rational
  c: number
  other: number
  rightEnd: number | null
  slips: { id: KTrap; text: string }[]
}

function tryDraft(rng: Rng): Draft | null {
  const c = rng.intExcept(-4, 4, [0])
  const aLo = -6
  const aHi = c - 1
  if (aLo > aHi) return null
  const other = rng.intExcept(aLo, aHi, [0])
  const rightEnd = rng.chance(0.7) ? rng.int(c + 1, 6) : null
  const kOnRight = rng.chance(0.5)
  const how = rng.chance(0.5) ? 'b' : 'm'
  const square = rng.chance(0.5)
  const mFixed = rat(rng.pick(SLOPE_N))
  const mK = rat(rng.pick(SLOPE_N))
  const bFree = rat(rng.int(-3, 3))

  let fixed: Side
  let withK: Side
  if (square) {
    fixed = fixedSquare()
    withK = how === 'b' ? kAsConstant(mK) : kAsSlope(bFree)
  } else if (how === 'b') {
    // Fixed intercept is chosen so the pieces meet at a k we pick.
    const kPick = rat(rng.pick([-3, -2, -1, 1, 2, 3]))
    // y_fixed(c) = mK*c + kPick, and y_fixed = mFixed*c + b1 ⇒ b1 = kPick + (mK - mFixed)*c
    const b1 = ratAdd(kPick, ratMul(ratSub(mK, mFixed), rat(c)))
    fixed = fixedLinear(mFixed, b1)
    withK = kAsConstant(mK)
    if (ratEquals(mFixed, mK)) return null
  } else {
    const kUse = rng.chance(0.3) ? rat(rng.pick([-3, -1, 1, 3]), 2) : rat(rng.intExcept(-3, 3, [0]))
    const b1 = ratSub(ratAdd(ratMul(kUse, rat(c)), bFree), ratMul(mFixed, rat(c)))
    fixed = fixedLinear(mFixed, b1)
    withK = kAsSlope(bFree)
  }

  const left = kOnRight ? fixed : withK
  const right = kOnRight ? withK : fixed
  const k = solve(left, right, rat(c))
  if (!k || !nice(k)) return null

  const y = at(left, k, rat(c))
  if (!ratEquals(y, at(right, k, rat(c)))) return null
  // Wrong piece: the k side at c equals the number c, not the other side's height.
  if (ratEquals(y, rat(c))) return null
  const kSide = kOnRight ? right : left
  const kWrong = solveSide(kSide, rat(c), rat(c))
  if (!kWrong || ratEquals(kWrong, k) || !nice(kWrong)) return null
  const kOther = solve(left, right, rat(other))
  if (!kOther || ratEquals(kOther, k) || !nice(kOther)) return null
  const kSign = ratNeg(k)
  if (ratEquals(kSign, k) || !nice(kSign)) return null
  // The other-boundary k must not also meet the pieces at c.
  if (ratEquals(at(left, kOther, rat(c)), at(right, kOther, rat(c)))) return null
  if (ratEquals(at(left, kSign, rat(c)), at(right, kSign, rat(c)))) return null
  if (!ratEquals(at(kSide, kWrong, rat(c)), rat(c))) return null

  // Engine agrees after substitution.
  const ln = substituteK(left.formulaK, ratToString(k))
  const rn = substituteK(right.formulaK, ratToString(k))
  const leftEv = evaluatePiecewise([{ formula: ln, interval: { lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false } }], c)
  const rightEv = evaluatePiecewise([{ formula: rn, interval: { lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false } }], c)
  if (!leftEv || !leftEv.defined || !rightEv || !rightEv.defined || !ratEquals(leftEv.value, rightEv.value)) return null

  return {
    left,
    right,
    kSide: kOnRight ? 'right' : 'left',
    k,
    c,
    other,
    rightEnd,
    slips: [
      { id: 'pw_k_wrong_piece', text: ratToString(kWrong) },
      { id: 'pw_k_sign', text: ratToString(kSign) },
      { id: 'pw_k_other_boundary', text: ratToString(kOther) },
    ],
  }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  const trap = TRAPS[(seed >>> 0) % TRAPS.length]!
  for (let n = 0; n < TRIES; n++) {
    const draft = tryDraft(rng)
    if (!draft) continue
    if (!draft.slips.some((s) => s.id === trap)) continue
    const kText = ratToString(draft.k)
    const distinct = new Set(draft.slips.map((s) => s.text))
    if (distinct.size !== draft.slips.length || distinct.has(kText)) continue
    if (gradeK(kText, draft.slips, kText).verdict !== 'correct') continue
    if (gradeK(kText, draft.slips, draft.slips.find((s) => s.id === trap)!.text).verdict !== 'mistake') continue

    const cRat = rat(draft.c)
    const leftExpr = draft.left.expr(draft.k)
    const rightExpr = draft.right.expr(draft.k)
    // A finite right piece is open at c ("c < x < ..."). A ray is "x > c" or "x >= c":
    // even seeds let the ray own c, odd seeds leave c with the left piece. The outer left
    // end stays open on a ray so the graph still has a hollow dot.
    const rightHi = draft.rightEnd === null ? 'inf' : draft.rightEnd
    const ray = rightHi === 'inf'
    const rightOwns = ray && (seed >>> 0) % 2 === 0
    const leftPiece = piece(leftExpr, draft.other, draft.c, !ray, !rightOwns)
    const rightPiece = piece(rightExpr, draft.c, rightHi, rightOwns, false)
    const pieces = [leftPiece, rightPiece]
    const dots = sketchOf(pieces).dots ?? []
    if (!dots.some((d) => d.closed) || !dots.some((d) => !d.closed)) continue

    const yText = showMinus(ratToString(at(draft.left, draft.k, cRat)))
    const reveal = [
      `The pieces meet at x = ${showMinus(String(draft.c))}.`,
      `There the left piece equals ${yText} and the right piece equals ${yText}, so k = ${showMinus(kText)}.`,
    ]
    const prompt = 'Find the value of k that makes f continuous.'
    const stored = pieces.map(storedPiece)
    return buildMore({
      templateId: 'pw.continuous',
      version: VERSION,
      seed,
      knobs,
      title: 'Make f continuous',
      instructions: prompt,
      statementText: 'Find k so that f is continuous.',
      answer: {
        question: 'continuous',
        prompt,
        pieces: stored,
        leftFormula: draft.left.formulaK,
        rightFormula: draft.right.formulaK,
        kSide: draft.kSide,
        boundary: String(draft.c),
        other: String(draft.other),
        kText,
        parts: [
          {
            key: 'k',
            label: 'k',
            placeholder: 'integer or fraction',
            nudge: 'The two pieces have to reach the same height where they meet.',
            ruleCard: PW_RULE_IDS.continuous,
            reveal,
            answerText: kText,
          },
        ],
        traps: draft.slips.map((s) => ({ id: s.id, text: s.text, witness: '' })),
        sketch: sketchOf(pieces),
        nudge: 'The two pieces have to reach the same height where they meet.',
        ruleCard: PW_RULE_IDS.continuous,
        ruleCards: [PW_RULE_IDS.continuous],
        reveal,
        trap,
      },
    })
  }
  throw new Error(`pw.continuous/${trap}: no function for seed ${seed}`)
}

export const continuousTemplate: TemplateDef = {
  id: 'pw.continuous',
  title: 'Make a piecewise function continuous',
  description: 'Two pieces, with k in one of them. Find the exact k that makes f continuous where the pieces meet.',
  version: VERSION,
  knobs: [],
  generate,
}
