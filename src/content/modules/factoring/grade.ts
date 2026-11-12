/**
 * Grading a factoring problem part by part. Her product is read exactly by the engine (`checkFactored`,
 * `readProduct` in src/engine/polynomials/factor.ts): it must multiply out to the polynomial, be a product, and
 * be factored completely over the integers. A product that multiplies out to what one of this problem's slips
 * gives (`answer.slips`, built per seed) is named as that slip; a right product that is not finished is
 * "stopped early" (or, on the common-factor question and the pairs, "not the greatest"). Nothing compares text.
 */
import type { AnswerSpec, FactoringStageId } from '@/content/types'
import { checkFactored, readProduct, type FactoredCheck } from '@/engine'
import { polyDeg, polyEquals, polyPow, polyToText, type Poly } from '@/engine/functions/poly'
import { guard, readFormula, readPoly } from '@/engine/polynomials/common'
import type { ErrorPatternId } from '@/shared/types'

export type FactoringAnswer = Extract<AnswerSpec, { type: 'factoring' }>

/** Her boxes, as stored in `AttemptFinal.polyEntries`. */
export const FA_KEYS = {
  cube1: 'cube1',
  cube2: 'cube2',
  pair1: 'pair1',
  pair2: 'pair2',
  product: 'product',
  choice: 'choice',
} as const

/** The box a part opens on. */
export const FA_FIRST_KEY: Record<FactoringStageId, string> = {
  cubed: FA_KEYS.cube1,
  pairs: FA_KEYS.pair1,
  product: FA_KEYS.product,
}

export type FaGrade =
  | { verdict: 'correct'; message: string }
  /** A named slip: `witness` is a sentence about her answer, for this problem's numbers. */
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string }
  | { verdict: 'wrong'; message: string }
  /** Not an attempt: unreadable, or equal to what is asked but not in the form asked for. Never recorded. */
  | { verdict: 'invalid'; reason: 'unreadable' | 'not_in_form'; message: string }

export interface FaPart {
  key: string
  label?: string
  grade: FaGrade
}

export interface FaStageGrade {
  parts: FaPart[]
  /** The box to focus when the check was not an attempt. */
  focus: string | null
}

/** App syntax as display text: ASCII minus becomes −. */
export function faShow(text: string): string {
  return text.replace(/-/g, '−')
}

function polyOfText(text: string): Poly {
  const p = readPoly(text)
  if (!p) throw new Error(`factoring: ${text} is not a polynomial`)
  return p.poly
}

const shown = (p: Poly) => faShow(polyToText(p))

/** "+10x", "−10x", or "no middle term". */
function middleOf(p: Poly): string {
  const c = p[1]
  if (!c || c.n === 0) return 'no x term'
  const abs = Math.abs(c.n)
  const body = c.d === 1 ? `${abs === 1 ? '' : abs}x` : `(${abs}/${c.d})x`
  return `${c.n < 0 ? '−' : '+'}${body}`
}

const correct = (message: string): FaGrade => ({ verdict: 'correct', message })
const wrong = (message: string): FaGrade => ({ verdict: 'wrong', message })
const unreadable = (message: string): FaGrade => ({ verdict: 'invalid', reason: 'unreadable', message })
const notInForm = (message: string): FaGrade => ({ verdict: 'invalid', reason: 'not_in_form', message })
const mistake = (id: ErrorPatternId, witness: string): FaGrade => ({ verdict: 'mistake', mistake: id, witness })

const NOT_POLY = 'Every factor here is a polynomial in x with whole-number coefficients: no square roots, and no x in a denominator.'

/** The common factor taken out first, display text: "2", "x", "3x^2"; '' when there is none. */
export function gcfText(g: number, e: number): string {
  const xs = e === 0 ? '' : e === 1 ? 'x' : `x^${e}`
  if (g === 1) return xs
  return `${g}${xs}`
}

// ---------------------------------------------------------------------------
// Slips: which of this problem's slips her answer multiplies out to
// ---------------------------------------------------------------------------

function slipFor(answer: FactoringAnswer, stage: FactoringStageId, key: string, herPoly: Poly, right: Poly): ErrorPatternId | null {
  for (const slip of answer.slips) {
    if (slip.stage !== stage) continue
    const text = slip.entries[key]
    if (text === undefined) continue
    const p = guard(() => readProduct(text))
    if (!p || !p.ok) continue
    // A slip that multiplies out to the right answer is a right-but-unfinished product: graded by the engine's check.
    if (polyEquals(p.poly, right)) continue
    if (polyEquals(p.poly, herPoly)) return slip.id
  }
  return null
}

// ---------------------------------------------------------------------------
// Witnesses: one sentence (or two) about her answer, never the right answer
// ---------------------------------------------------------------------------

function productWitness(answer: FactoringAnswer, id: ErrorPatternId, her: Poly): string {
  const f = faShow(answer.f)
  const yours = `Your product multiplies out to ${shown(her)}, not ${f}.`
  const sh = answer.shape
  switch (id) {
    case 'fa_gcf_dropped_one': {
      const g = faShow(gcfText(sh.g, sh.e))
      return `One term of ${f} is the common factor ${g} itself (up to its sign), and dividing it by ${g} leaves 1, which stays inside the parentheses. ${yours}`
    }
    case 'fa_sum_of_squares': {
      const sum = faShow(sumOfSquaresText(answer))
      const why = her[1] && her[1].n !== 0 ? 'it has a middle term' : 'its last term comes out negative'
      return `${sum} is a sum of two squares. Your product multiplies out to ${shown(her)}: ${why}. No product with whole-number coefficients gives a sum of two squares.`
    }
    case 'fa_diff_as_square':
      return `The square of a binomial always has a middle term: yours multiplies out to ${shown(her)}, with ${middleOf(her)}. A difference of two squares has none, so its two binomials have opposite signs.`
    case 'fa_square_sign':
      return `Your square multiplies out to ${shown(her)}, with the middle term ${middleOf(her)}, but ${f} has ${middleOf(polyOfText(answer.f))}. The sign inside the square is the sign of the middle term.`
    case 'fa_cube_middle_sign':
      return `Same, opposite, always plus: the middle term of the trinomial takes the OPPOSITE sign to the binomial. Yours has the same sign. ${yours}`
    case 'fa_cube_middle_doubled':
      return `The middle term of the trinomial is the two cube roots multiplied once. Doubling it borrows the perfect-square pattern. ${yours}`
    case 'fa_cube_last_negative':
      return `Always plus: the last term of the trinomial is a square, so it is positive for a sum and for a difference of cubes. Yours is negative. ${yours}`
    case 'fa_cube_binomial_cubed':
      return `Cubing a binomial gives four terms, with two middle terms that a sum or difference of cubes does not have. ${yours}`
    case 'fa_cube_root_coefficient': {
      const c = sh.m ** 3
      return `Your binomial starts with ${c}x, the number in front as it stands, but (${c}x)^3 = ${c ** 3}x^3. Take the cube root of ${c} as well as of x^3. ${yours}`
    }
    case 'fa_tri_signs_swapped':
      return `Your two numbers give the right last term, but with their signs swapped: your product multiplies out to ${shown(her)}, with the middle term ${middleOf(her)} instead of ${middleOf(polyOfText(answer.f))}.`
    case 'fa_tri_wrong_pair':
      return `Your factors give the right first and last terms, but the middle term comes out ${middleOf(her)}: your product multiplies out to ${shown(her)}, not ${f}. That pair multiplies to the last term without adding up to the middle one.`
    default:
      return yours
  }
}

/** The sum of two squares the slip was made on: the polynomial itself, or the factor m^2x^2 + n^2 of m^4x^4 − n^4. */
function sumOfSquaresText(answer: FactoringAnswer): string {
  const sh = answer.shape
  if (sh.core === 'dos2') return polyToText(polyOfText(`${sh.m * sh.m}x^2 + ${sh.n * sh.n}`))
  return polyToText(polyOfText(sh.inner))
}

function wrapLeaf(text: string): string {
  return /^[a-z](\^\d+)?$/.test(text) ? text : `(${faShow(text)})`
}

function incompleteWitness(c: Extract<FactoredCheck, { status: 'incomplete' }>, greatest: boolean): { id: ErrorPatternId; witness: string } {
  const leaf = wrapLeaf(c.leaf.text)
  if (greatest && c.reason === 'common_factor') {
    return {
      id: 'fa_gcf_not_greatest',
      witness: `Your product is right, but every term of ${leaf} can still be divided by the same factor, so what you took out is not the greatest common factor.`,
    }
  }
  return {
    id: 'fa_stopped_early',
    witness:
      c.reason === 'common_factor'
        ? `Your product is right, but the terms of ${leaf} still share a common factor. Take it out too.`
        : `Your product is right, but ${leaf} still factors over the integers. Factor it too, and check every factor again.`,
  }
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

/** Two linear factors with whole-number coefficients, the right first and last terms, a different middle term. */
function wrongPairOf(answer: FactoringAnswer, her: Extract<ReturnType<typeof readProduct>, { ok: true }>): ErrorPatternId | null {
  if (answer.question !== 'trinomial') return null
  const total = her.leaves.reduce((s, l) => s + l.mult, 0)
  if (total !== 2 || !her.leaves.every((l) => polyDeg(l.poly) === 1 && l.poly.every((c) => c.d === 1))) return null
  const f = polyOfText(answer.f)
  const h = her.poly
  if (h.length !== 3 || !polyEquals([h[0]!, h[2]!], [f[0]!, f[2]!])) return null
  if (polyEquals(h, f)) return null
  return h[1]!.n === -f[1]!.n && h[1]!.d === f[1]!.d ? 'fa_tri_signs_swapped' : 'fa_tri_wrong_pair'
}

export function gradeProduct(answer: FactoringAnswer, entries: Record<string, string>): FaGrade {
  const text = entries[FA_KEYS.product] ?? ''
  const f = faShow(answer.f)
  const fPoly = polyOfText(answer.f)
  if (answer.question === 'squares') {
    const choice = entries[FA_KEYS.choice] ?? ''
    if (choice === 'prime') {
      if (answer.prime) return correct(`Correct: ${f} is a sum of two squares, so it does not factor over the integers.`)
      return wrong(`${f} does factor over the integers. Look again at the sign between its terms, and at whether it has a middle term.`)
    }
    if (!text.trim()) return unreadable('Type the factored form, or choose that it does not factor over the integers.')
  }
  if (!text.trim()) return unreadable('Type the factored form first.')

  if (answer.prime) {
    const r = readProduct(text)
    if (!r.ok) return 'error' in r ? unreadable(r.error.message) : notInForm(NOT_POLY)
    if (polyEquals(r.poly, fPoly)) return notInForm(`That is ${f} itself, written out, not a product. Type a product, or choose that it does not factor.`)
    const id = slipFor(answer, 'product', FA_KEYS.product, r.poly, fPoly)
    if (id) return mistake(id, productWitness(answer, id, r.poly))
    return wrong(`Multiply your answer back out: it gives ${shown(r.poly)}, but the polynomial is ${f}.`)
  }

  const c = checkFactored(answer.f, text)
  if (!c) return unreadable('This problem could not be checked. Try another one.')
  switch (c.status) {
    case 'unreadable':
      return unreadable(c.error.message)
    case 'not_polynomial':
      return notInForm(NOT_POLY)
    case 'not_product':
      return notInForm(`That is equal to ${f}, but it is the polynomial written out, not a product. Write it as factors multiplied together.`)
    case 'not_integer':
      return notInForm(`That is equal to ${f}, but ${wrapLeaf(c.leaf.text)} has a fraction in it. Over the integers every factor has whole-number coefficients: move the number in front into that factor.`)
    case 'incomplete': {
      const { id, witness } = incompleteWitness(c, answer.question === 'gcf')
      return mistake(id, witness)
    }
    case 'complete':
      return correct(`Correct: ${f} = ${faShow(answer.answerText)}.`)
    case 'not_equal': {
      const id = slipFor(answer, 'product', FA_KEYS.product, c.herPoly, fPoly) ?? wrongPairOf(answer, c.reading)
      if (id) return mistake(id, productWitness(answer, id, c.herPoly))
      return wrong(`Multiply your answer back out: it gives ${shown(c.herPoly)}, but the polynomial is ${f}.`)
    }
  }
}

function gradePair(answer: FactoringAnswer, which: 1 | 2, text: string): FaGrade {
  const pairs = answer.pairs!
  const target = which === 1 ? pairs.first : pairs.second
  const key = which === 1 ? FA_KEYS.pair1 : FA_KEYS.pair2
  const t = faShow(target)
  if (!text.trim()) return unreadable(`Type the ${which === 1 ? 'first' : 'second'} pair factored.`)
  const c = checkFactored(target, text)
  if (!c) return unreadable('This problem could not be checked. Try another one.')
  switch (c.status) {
    case 'unreadable':
      return unreadable(c.error.message)
    case 'not_polynomial':
      return notInForm(NOT_POLY)
    case 'not_product':
      return notInForm(`That is ${t} written out. Write it as what both terms share times a binomial.`)
    case 'not_integer':
      return notInForm(`That is equal to ${t}, but a factor has a fraction in it. Keep whole-number coefficients.`)
    case 'incomplete':
      return mistake(
        'fa_gcf_not_greatest',
        `That multiplies back to ${t}, but every term of ${wrapLeaf(c.leaf.text)} still shares a factor: take out the greatest common factor of the pair.`,
      )
    case 'not_equal': {
      const id = slipFor(answer, 'pairs', key, c.herPoly, polyOfText(target))
      if (id === 'fa_group_sign') {
        return mistake(
          id,
          `Taking a negative number out of ${t} divides both of its terms by it, so both signs change. Yours multiplies out to ${shown(c.herPoly)}, not ${t}.`,
        )
      }
      if (id) return mistake(id, `Yours multiplies out to ${shown(c.herPoly)}, not ${t}.`)
      return wrong(`Multiply it back out: yours gives ${shown(c.herPoly)}, but the pair is ${t}.`)
    }
    case 'complete': {
      const binomial = polyOfText(binomialText(answer))
      const has = c.reading.leaves.some((l) => polyEquals(l.poly, binomial))
      if (!has) {
        return notInForm(
          which === 1
            ? `That is equal to ${t}, but take out a common factor that leaves a binomial starting with +x, so the two pairs can match.`
            : `That is equal to ${t}, but its binomial does not match the first pair’s. Take out the common factor with the other sign, so both pairs show the same binomial.`,
        )
      }
      return correct(`Correct: ${t} = ${faShow(which === 1 ? pairs.firstAnswer : pairs.secondAnswer)}.`)
    }
  }
}

/** fa.grouping: the binomial both pairs share, app syntax: "x + 3". */
export function binomialText(answer: FactoringAnswer): string {
  const t = answer.shape.k[0]!
  return t < 0 ? `x - ${-t}` : `x + ${t}`
}

function gradeCubeBox(answer: FactoringAnswer, which: 1 | 2, text: string): FaGrade {
  const sh = answer.shape
  const key = which === 1 ? FA_KEYS.cube1 : FA_KEYS.cube2
  if (!text.trim()) return unreadable(`Type what is cubed in the ${which === 1 ? 'first' : 'second'} term.`)
  const r = readFormula(text)
  if (!r.ok) return unreadable(r.error.message)
  if (!r.poly) return notInForm(which === 1 ? 'Type a term like 5x: a number times x.' : 'Type a whole number.')
  const her = r.poly
  const right = which === 1 ? polyOfText(`${sh.m}x`) : polyOfText(`${sh.n}`)
  if (polyEquals(her, right)) {
    return correct(which === 1 ? `Correct: the first term is (${faShow(answer.cubed!.first)})^3.` : `Correct: the second term is ${answer.cubed!.second}^3.`)
  }
  const lead = her[her.length - 1]
  if (lead && lead.n < 0) return notInForm('The sign is already written between the two cubes: type what is cubed without a minus sign.')
  const slip = slipFor(answer, 'cubed', key, her, right)
  const firstTerm = faShow(polyToText(polyOfText(`${sh.m ** 3}x^3`)))
  const secondTerm = `${sh.n ** 3}`
  if (slip === 'fa_cube_root_coefficient') {
    return which === 1
      ? mistake(slip, `(${sh.m ** 3}x)^3 = ${sh.m ** 9}x^3, not ${firstTerm}: take the cube root of the number ${sh.m ** 3} as well as of x^3.`)
      : mistake(slip, `You typed ${secondTerm}, the number itself. The box wants the number whose cube is ${secondTerm}.`)
  }
  const cubed = guard(() => polyPow(her, 3))
  if (!cubed) return unreadable('A number in that answer is too large to check exactly. Look for a typing slip.')
  const inside = sh.g !== 1 || sh.e !== 0 ? ' inside the parentheses' : ''
  return wrong(
    which === 1
      ? `(${shown(her)})^3 = ${shown(cubed)}, but the first term${inside} is ${firstTerm}.`
      : `${shown(her)}^3 = ${shown(cubed)}, but the second term${inside} is ${secondTerm}.`,
  )
}

/**
 * Grade one part. `parts` has one grade per box the part checks (two for the cube roots and the pairs, one for
 * the product); `focus` is the first box to fix when the check was not an attempt.
 */
export function gradeFactoringStage(answer: FactoringAnswer, stage: FactoringStageId, entries: Record<string, string>): FaStageGrade {
  let parts: FaPart[]
  switch (stage) {
    case 'cubed':
      parts = [
        { key: FA_KEYS.cube1, label: 'First term', grade: gradeCubeBox(answer, 1, entries[FA_KEYS.cube1] ?? '') },
        { key: FA_KEYS.cube2, label: 'Second term', grade: gradeCubeBox(answer, 2, entries[FA_KEYS.cube2] ?? '') },
      ]
      break
    case 'pairs':
      parts = [
        { key: FA_KEYS.pair1, label: 'First pair', grade: gradePair(answer, 1, entries[FA_KEYS.pair1] ?? '') },
        { key: FA_KEYS.pair2, label: 'Second pair', grade: gradePair(answer, 2, entries[FA_KEYS.pair2] ?? '') },
      ]
      break
    case 'product':
      parts = [{ key: FA_KEYS.product, grade: gradeProduct(answer, entries) }]
      break
  }
  const blocked = parts.find((p) => p.grade.verdict === 'invalid')
  return { parts, focus: blocked ? blocked.key : null }
}

/** Not an attempt: some part is unreadable or not in the form asked for. */
export function faBlocked(grades: readonly FaGrade[]): boolean {
  return grades.some((g) => g.verdict === 'invalid')
}

export function faAllCorrect(grades: readonly FaGrade[]): boolean {
  return grades.length > 0 && grades.every((g) => g.verdict === 'correct')
}

/** The right answer to every part, as she would type it. For tests, the worked example and self-checks. */
export function canonicalEntries(answer: FactoringAnswer): Record<string, string> {
  const out: Record<string, string> = {}
  if (answer.cubed) {
    out[FA_KEYS.cube1] = answer.cubed.first
    out[FA_KEYS.cube2] = answer.cubed.second
  }
  if (answer.pairs) {
    out[FA_KEYS.pair1] = answer.pairs.firstAnswer
    out[FA_KEYS.pair2] = answer.pairs.secondAnswer
  }
  if (answer.question === 'squares') out[FA_KEYS.choice] = answer.prime ? 'prime' : 'factors'
  if (!answer.prime) out[FA_KEYS.product] = answer.answerText
  return out
}

/** Her boxes for the tutor, in reading order. */
export function faWork(answer: FactoringAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  const put = (label: string, key: string) => {
    const v = entries[key]?.trim()
    if (v) lines.push(`${label}: ${v}`)
  }
  if (answer.question === 'cubes') {
    put('first term cubed', FA_KEYS.cube1)
    put('second term cubed', FA_KEYS.cube2)
  }
  if (answer.question === 'grouping') {
    put('first pair', FA_KEYS.pair1)
    put('second pair', FA_KEYS.pair2)
  }
  if (answer.question === 'squares' && entries[FA_KEYS.choice] === 'prime') lines.push('answer: does not factor over the integers')
  else put('factored form', FA_KEYS.product)
  return lines
}
