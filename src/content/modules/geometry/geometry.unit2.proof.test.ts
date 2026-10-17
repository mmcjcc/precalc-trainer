/**
 * Each two-column skeleton, read again from its own wording. The expected reason on every row is
 * written here, not copied out of the generator's trap table.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import { gradeGeoStage } from './grade'
import { REASONS, isReason, reasonLabel } from './reasons'
import { auditAlgebra, auditReasonLine, auditTwoColumn } from './unit2Check'
import { PROOF_RULES } from './unit2Rules'

const HEAVY = 120_000

const SKELETONS = [
  'midpoint-algebra',
  'seg-overlap',
  'linear-supp',
  'vertical-prove',
  'vertical-apply',
  'cong-supplements',
  'cong-complements',
  'right-angles',
  'angle-bisector',
  'segment-bisector',
  'transitive-segments',
  'perpendicular',
] as const

function proof(seed: number): { skeleton: string; prompt: string; answer: GeometryAnswer } {
  const p = generateProblem('geoProof', 'gp.twocolumn', seed)
  if (p.answer.type !== 'geometry') throw new Error('not geometry')
  return { skeleton: String(p.params.skeleton), prompt: p.answer.prompt, answer: p.answer }
}

describe('two-column skeletons, each reason justified by hand', () => {
  it.each(SKELETONS)('%s holds for several salts and letter sets', (skeleton) => {
    const index = SKELETONS.indexOf(skeleton)
    for (const step of [0, 1, 2, 3, 5, 8]) {
      const seed = index + 1 + step * SKELETONS.length
      const built = proof(seed)
      expect(built.skeleton, `seed ${seed}`).toBe(skeleton)
      expect(auditTwoColumn(built.skeleton, built.prompt, built.answer), `${skeleton}/${seed} ${built.prompt}`).toEqual([])
    }
  })

  it('every skeleton appears, and none of them is true for every x', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= SKELETONS.length; seed++) {
      const built = proof(seed)
      seen.add(built.skeleton)
      expect(auditTwoColumn(built.skeleton, built.prompt, built.answer), built.prompt).toEqual([])
    }
    expect([...seen]).toEqual([...SKELETONS])
  }, HEAVY)
})

describe('algebraic proofs, solved again from the lines', () => {
  it('each line follows from the line before it, and x is unique', () => {
    for (let seed = 1; seed <= 90; seed++) {
      const p = generateProblem('geoProof', 'gp.algebraic', seed)
      if (p.answer.type !== 'geometry') throw new Error('not geometry')
      const reasons = p.answer.stages.map((stage) => stage.answerText)
      expect(auditAlgebra(String(p.params.skeleton), p.answer.lines ?? [], reasons), `${p.params.skeleton}/${seed}`).toEqual([])
    }
  }, HEAVY)
})

describe('a single proof line names its own reason', () => {
  it('the sentence, not the seed, decides the reason', () => {
    for (let seed = 1; seed <= 90; seed++) {
      const p = generateProblem('geoProof', 'gp.reason', seed)
      if (p.answer.type !== 'geometry') throw new Error('not geometry')
      const statement = p.answer.prompt.split('\n')[1] ?? ''
      expect(auditReasonLine(statement), statement).toBe(p.answer.stages[0]!.answerText)
    }
  }, HEAVY)
})

// ---------------------------------------------------------------------------------------------------
// The moves, checked by arithmetic. Each row is read back into an equation on its own (this file's
// reader, not the generator's), and the reason the answer key gives must be the move that turns the
// earlier rows into this one.

const SEEDS_300 = Array.from({ length: 300 }, (_, i) => i + 1)

type ProofTemplate = 'gp.reason' | 'gp.algebraic' | 'gp.twocolumn'

function drawn(template: ProofTemplate, seed: number): { skeleton: string; answer: GeometryAnswer } {
  const p = generateProblem('geoProof', template, seed)
  if (p.answer.type !== 'geometry') throw new Error('not geometry')
  return { skeleton: String(p.params.skeleton), answer: p.answer }
}

interface ProofLine {
  statement: string
  reason: string
  pick: 'reason' | 'statement'
}

const REASON_BY_LABEL = new Map<string, string>(REASONS.map((reason) => [reason.label, reason.id]))

/** The rows once filled in: the statement, and the reason the answer key gives for it. */
function linesOf(answer: GeometryAnswer): ProofLine[] {
  return answer.stages.map((stage): ProofLine => {
    if (stage.kind === 'reason') return { statement: (stage.note ?? '').replace(/^Statement: /, ''), reason: stage.answerText, pick: 'reason' }
    const statement = stage.choices?.find((choice) => choice.id === stage.answerText)?.text ?? ''
    const label = /supported by ([^.]+)\./.exec(stage.reveal[0] ?? '')?.[1] ?? ''
    return { statement, reason: REASON_BY_LABEL.get(label) ?? `unread support “${label}”`, pick: 'statement' }
  })
}

/** One side of an equation: a coefficient for each name (x, m1 for the measure of angle 1, or a segment such as AB), '' for the constant. */
type Side = Map<string, number>

interface Equation {
  /** The sides as sums of terms, or null when a side is not one (6(x + 2), say). */
  sides: [Side, Side] | null
  /** The sides as printed, for a row written with an equals sign. */
  text: [string, string] | null
}

function tidy(side: Side): Side {
  for (const [name, n] of [...side]) if (n === 0) side.delete(name)
  return side
}

function sideFrom(...terms: [string, number][]): Side {
  const side: Side = new Map()
  for (const [name, n] of terms) side.set(name, (side.get(name) ?? 0) + n)
  return tidy(side)
}

/** "2x − 5", "12", "x", or "AB + BC" as terms. Null for anything else. */
function termsOf(text: string): Side | null {
  const s = text.replace(/−/g, '-').replace(/\s+/g, '')
  const parts = s.match(/[+-]?[^+-]+/g)
  if (!parts || parts.join('') !== s) return null
  const terms: [string, number][] = []
  for (const part of parts) {
    const m = /^([+-]?)(\d*)(x|[A-Z]{2})?$/.exec(part)
    if (!m || (!m[2] && !m[3])) return null
    terms.push([m[3] ?? '', (m[2] ? Number(m[2]) : 1) * (m[1] === '-' ? -1 : 1)])
  }
  return sideFrom(...terms)
}

const angle = (n: string | undefined) => `m${n}`

/** The plain-English rows that are equations of angle measures, written back as equations. */
const SENTENCES: readonly [RegExp, (g: RegExpExecArray) => [Side, Side]][] = [
  [/^The measures of angle (\d) and angle (\d) add to (\d+)$/, (g) => [sideFrom([angle(g[1]), 1], [angle(g[2]), 1]), sideFrom(['', Number(g[3])])]],
  [/^(\d+) equals the measure of angle (\d) plus the measure of angle (\d)$/, (g) => [sideFrom(['', Number(g[1])]), sideFrom([angle(g[2]), 1], [angle(g[3]), 1])]],
  [
    /^The measure of angle (\d) plus the measure of angle (\d) equals the measure of angle (\d) plus the measure of angle (\d)$/,
    (g) => [sideFrom([angle(g[1]), 1], [angle(g[2]), 1]), sideFrom([angle(g[3]), 1], [angle(g[4]), 1])],
  ],
  [/^Angle (\d) and angle (\d) have the same measure$/, (g) => [sideFrom([angle(g[1]), 1]), sideFrom([angle(g[2]), 1])]],
  [/^The measure of angle (\d) is (\d+) degrees$/, (g) => [sideFrom([angle(g[1]), 1]), sideFrom(['', Number(g[2])])]],
  [/^(\d+) degrees equals the measure of angle (\d)$/, (g) => [sideFrom(['', Number(g[1])]), sideFrom([angle(g[2]), 1])]],
  [/^The measures of angle (\d) and angle (\d) add to the measure of angle (\d)$/, (g) => [sideFrom([angle(g[1]), 1], [angle(g[2]), 1]), sideFrom([angle(g[3]), 1])]],
  [/^The measure of angle (\d) added to itself equals the measure of angle (\d)$/, (g) => [sideFrom([angle(g[1]), 2]), sideFrom([angle(g[2]), 1])]],
  [/^The measure of angle (\d) equals the measure of angle (\d) added to itself$/, (g) => [sideFrom([angle(g[1]), 1]), sideFrom([angle(g[2]), 2])]],
]

function equationOf(statement: string): Equation | null {
  for (const [pattern, read] of SENTENCES) {
    const m = pattern.exec(statement)
    if (m) return { sides: read(m), text: null }
  }
  const parts = statement.split(' = ')
  if (parts.length !== 2) return null
  const left = termsOf(parts[0]!)
  const right = termsOf(parts[1]!)
  return { sides: left && right ? [left, right] : null, text: [parts[0]!, parts[1]!] }
}

function sameSide(a: Side, b: Side): boolean {
  return a.size === b.size && [...a].every(([name, n]) => b.get(name) === n)
}

function minus(a: Side, b: Side): Side {
  const out: Side = new Map(a)
  for (const [name, n] of b) out.set(name, (out.get(name) ?? 0) - n)
  return tidy(out)
}

function scaled(a: Side, k: number): Side {
  return tidy(new Map([...a].map(([name, n]): [string, number] => [name, n * k])))
}

function shown(side: Side): string {
  return [...side].map(([name, n]) => `${n}${name}`).join(' + ') || '0'
}

/** What both sides of the row before had added to them to make this row, or null when the sides changed differently. */
function change(prev: [Side, Side], cur: [Side, Side]): Side | null {
  const left = minus(cur[0], prev[0])
  return sameSide(left, minus(cur[1], prev[1])) ? left : null
}

/** The k with the row before equal to k times this row, side by side, or null. */
function divisor(prev: [Side, Side], cur: [Side, Side]): number | null {
  for (const s of [0, 1] as const) {
    for (const [name, n] of cur[s]) {
      const k = (prev[s].get(name) ?? 0) / n
      return sameSide(prev[0], scaled(cur[0], k)) && sameSide(prev[1], scaled(cur[1], k)) ? k : null
    }
  }
  return null
}

/** True when a = b and b = c, from two earlier rows in that order, give exactly this row: a = c. */
function strictChain(earlier: [Side, Side][], cur: [Side, Side]): boolean {
  return earlier.some((first) => sameSide(first[0], cur[0]) && earlier.some((second) => second !== first && sameSide(first[1], second[0]) && sameSide(second[1], cur[1])))
}

/** True when the two sides of this row are each equal, in some earlier row, to one shared third quantity. */
function looseChain(earlier: [Side, Side][], cur: [Side, Side]): boolean {
  const other = (row: [Side, Side], side: Side) => (sameSide(row[0], side) ? row[1] : sameSide(row[1], side) ? row[0] : null)
  return earlier.some((first) => {
    const middle = other(first, cur[0])
    return middle !== null && earlier.some((second) => second !== first && other(second, cur[1]) !== null && sameSide(other(second, cur[1])!, middle))
  })
}

const MOVES = new Set(['eq-sym', 'eq-add', 'eq-sub', 'eq-mul', 'eq-div', 'eq-trans'])

/** Why this row's reason fails to make it from the rows before it. Empty when it does. */
function moveErrors(lines: readonly ProofLine[], at: number): string[] {
  const line = lines[at]!
  const where = `row ${at + 1} “${line.statement}” (${line.reason})`
  const cur = equationOf(line.statement)
  const prev = at > 0 ? equationOf(lines[at - 1]!.statement) : null
  if (!cur) return [`${where}: not an equation`]
  if (line.reason === 'eq-sym') {
    if (!prev) return [`${where}: there is no line before it to turn around`]
    const byText = cur.text !== null && prev.text !== null && cur.text[0] === prev.text[1] && cur.text[1] === prev.text[0]
    const bySides = cur.sides !== null && prev.sides !== null && sameSide(cur.sides[0], prev.sides[1]) && sameSide(cur.sides[1], prev.sides[0])
    if (!byText && !bySides) return [`${where}: is not the line before with its two sides swapped`]
    if ((cur.text && cur.text[0] === cur.text[1]) || (cur.sides && sameSide(cur.sides[0], cur.sides[1]))) return [`${where}: says a quantity equals itself`]
    return []
  }
  if (line.reason === 'eq-trans') {
    if (!cur.sides) return [`${where}: cannot read the chain`]
    const earlier = lines
      .slice(0, at)
      .map((row) => equationOf(row.statement)?.sides)
      .filter((sides): sides is [Side, Side] => Boolean(sides))
    // A row where she picks the reason uses the strict textbook form; a statement row only needs a shared third quantity.
    const ok = line.pick === 'reason' ? strictChain(earlier, cur.sides) : looseChain(earlier, cur.sides)
    return ok ? [] : [`${where}: no two earlier rows chain to it${line.pick === 'reason' ? ' as a = b, b = c' : ''}`]
  }
  if (!prev?.sides || !cur.sides) return [`${where}: cannot read the move from the line before`]
  if (line.reason === 'eq-add' || line.reason === 'eq-sub') {
    const moved = change(prev.sides, cur.sides)
    if (!moved) return [`${where}: the two sides did not change by the same amount`]
    if (moved.size === 0) return [`${where}: repeats the line before, a move of zero`]
    const signs = [...moved.values()]
    const want = signs.every((n) => n > 0) ? 'eq-add' : signs.every((n) => n < 0) ? 'eq-sub' : 'one move that adds and subtracts at once'
    return want === line.reason ? [] : [`${where}: both sides changed by ${shown(moved)}, which is ${want}`]
  }
  if (line.reason === 'eq-div' || line.reason === 'eq-mul') {
    const k = divisor(prev.sides, cur.sides)
    if (k === null || k === 0 || k === 1) return [`${where}: is not the line before scaled by one number`]
    const want = Number.isInteger(k) ? 'eq-div' : 'eq-mul'
    return want === line.reason ? [] : [`${where}: the line before is ${k} times this one, which is ${want}`]
  }
  return []
}

describe('each move row is the move its reason names, over 300 seeds', () => {
  it('gp.algebraic and gp.twocolumn: every symmetric, add, subtract, divide, and chain row', () => {
    const errors: string[] = []
    const constantMoves = new Set<string>()
    for (const template of ['gp.algebraic', 'gp.twocolumn'] as const) {
      for (const seed of SEEDS_300) {
        const { skeleton, answer } = drawn(template, seed)
        const lines = linesOf(answer)
        lines.forEach((line, at) => {
          const where = `${template}/${seed} ${skeleton}`
          if (at > 0 && line.statement === lines[at - 1]!.statement) errors.push(`${where}: row ${at + 1} repeats the row before`)
          if (!MOVES.has(line.reason)) return
          for (const error of moveErrors(lines, at)) errors.push(`${where}: ${error}`)
          if (line.reason !== 'eq-add' && line.reason !== 'eq-sub') return
          const prev = equationOf(lines[at - 1]!.statement)?.sides
          const cur = equationOf(line.statement)?.sides
          const moved = prev && cur ? change(prev, cur) : null
          // A constant that leaves the x side: negative leaves by adding, positive by subtracting.
          if (moved && moved.size === 1 && moved.has('')) constantMoves.add(`${line.reason} ${moved.get('')! > 0 ? 'negative' : 'positive'} constant`)
        })
      }
    }
    expect(errors.slice(0, 10)).toEqual([])
    // Both directions of the sign rule ship: the midpoint and chain proofs move a negative constant, the
    // distributive proof a positive one.
    expect([...constantMoves].sort()).toEqual(['eq-add negative constant', 'eq-sub positive constant'])
  }, HEAVY)

  it('the moved constant names the reason: a negative one is added away, a positive one subtracted', () => {
    const errors: string[] = []
    let checked = 0
    for (const template of ['gp.algebraic', 'gp.twocolumn'] as const) {
      for (const seed of SEEDS_300) {
        const { skeleton, answer } = drawn(template, seed)
        if (skeleton !== 'midpoint-algebra' && skeleton !== 'chain') continue
        const lines = linesOf(answer)
        // The row "b = (gap)x + d" leaves the constant d on the x side, and the next row, "b − d = (gap)x", moves it across.
        const at = lines.findIndex((line, i) => /^\S+ = \d*x [+−] \d+$/.test(line.statement) && /^\S+ = \d*x$/.test(lines[i + 1]?.statement ?? ''))
        const side = equationOf(lines[at]?.statement ?? '')?.sides?.[1]
        const next = lines[at + 1]
        if (at < 0 || !side || !next) {
          errors.push(`${template}/${seed} ${skeleton}: no row leaves a constant on the x side`)
          continue
        }
        const d = side.get('') ?? 0
        checked += 1
        if (d === 0) errors.push(`${template}/${seed} ${skeleton}: a zero constant row`)
        const want = d < 0 ? 'eq-add' : 'eq-sub'
        if (next.reason !== want) errors.push(`${template}/${seed} ${skeleton}: moving ${d} across is ${want}, not ${next.reason}`)
      }
    }
    expect(errors.slice(0, 10)).toEqual([])
    expect(checked).toBeGreaterThan(0)
  }, HEAVY)

  it('midpoint-algebra divides only when the x terms differ by more than one, then turns the sides around', () => {
    const seen = { one: 0, more: 0 }
    for (const seed of SEEDS_300) {
      const { skeleton, answer } = drawn('gp.twocolumn', seed)
      if (skeleton !== 'midpoint-algebra') continue
      const where = `gp.twocolumn/${seed}`
      const m = /^M is the midpoint of [A-Z]{2}\. [A-Z]M = (.+)\. M[A-Z] = (.+)\. Fill in each row of the proof\.$/.exec(answer.prompt)
      const left = m ? termsOf(m[1]!) : null
      const right = m ? termsOf(m[2]!) : null
      if (!left || !right) throw new Error(`${where}: unread prompt ${answer.prompt}`)
      const gap = (right.get('x') ?? 0) - (left.get('x') ?? 0)
      const x = ((left.get('') ?? 0) - (right.get('') ?? 0)) / gap
      expect(Number.isInteger(x) && x > 0 && x !== 4, `${where} x = ${x}`).toBe(true)
      const lines = linesOf(answer)
      expect(lines.length, where).toBeLessThanOrEqual(8)
      expect(lines.at(-1), where).toEqual({ statement: `x = ${x}`, reason: 'eq-sym', pick: 'statement' })
      expect(lines.at(-2)?.statement, where).toBe(`${x} = x`)
      if (gap === 1) {
        seen.one += 1
        // "12 = x" already: nothing is divided, and the last row only swaps the sides.
        expect(lines.at(-2)?.reason, where).toBe((right.get('') ?? 0) < 0 ? 'eq-add' : 'eq-sub')
        expect(lines.some((line) => line.reason === 'eq-div'), where).toBe(false)
      } else {
        seen.more += 1
        expect(lines.at(-2)?.reason, where).toBe('eq-div')
        expect(lines.at(-3)?.statement, where).toBe(`${gap * x} = ${gap}x`)
      }
    }
    expect(seen.one).toBeGreaterThan(0)
    expect(seen.more).toBeGreaterThan(0)
  }, HEAVY)
})

describe('a chain row in a proof also takes substitution', () => {
  it('two-column and algebraic proofs: transitive and substitution both grade correct on every chain row, over 300 seeds', () => {
    const chains = new Set<string>()
    for (const template of ['gp.twocolumn', 'gp.algebraic'] as const) {
      for (const seed of SEEDS_300) {
        const { skeleton, answer } = drawn(template, seed)
        const where = `${template}/${seed} ${skeleton}`
        for (const stage of answer.stages) {
          if (stage.kind !== 'reason' || stage.answerText !== 'eq-trans') {
            expect(stage.accept, `${where} ${stage.id}`).toBeUndefined()
            continue
          }
          chains.add(skeleton)
          expect(stage.accept, where).toEqual(['eq-subst'])
          expect(gradeGeoStage(answer, stage.id, 'eq-trans').verdict, where).toBe('correct')
          expect(gradeGeoStage(answer, stage.id, 'eq-subst').verdict, where).toBe('correct')
          // Substitution is no longer a slip on this row, and a third reason is still plain wrong.
          expect(stage.traps.some((trap) => trap.text === 'eq-subst'), where).toBe(false)
          expect(gradeGeoStage(answer, stage.id, 'eq-refl').verdict, where).toBe('wrong')
          // The worked line names both, so the answer key never contradicts her pick.
          expect(stage.reveal[0], where).toContain(reasonLabel('eq-trans'))
          expect(stage.reveal[0], where).toContain(reasonLabel('eq-subst'))
        }
        expect(answer.trap, where).not.toBe('geo_substitution_for_transitive')
      }
    }
    expect([...chains].sort()).toEqual(['chain', 'cong-complements', 'cong-supplements', 'right-angles', 'transitive-segments'])
  }, HEAVY)

  it('name the property still wants Transitive: substitution stays the named slip there', () => {
    let equality = 0
    let congruence = 0
    for (const seed of SEEDS_300) {
      const { answer } = drawn('gp.reason', seed)
      const stage = answer.stages[0]!
      expect(stage.accept, `gp.reason/${seed}`).toBeUndefined()
      if (stage.answerText !== 'eq-trans' && stage.answerText !== 'cong-trans') continue
      if (stage.answerText === 'eq-trans') equality += 1
      else congruence += 1
      expect(gradeGeoStage(answer, stage.id, stage.answerText).verdict).toBe('correct')
      expect(gradeGeoStage(answer, stage.id, 'eq-subst')).toMatchObject({ verdict: 'mistake', mistake: 'geo_substitution_for_transitive' })
      expect(stage.traps).toContainEqual(expect.objectContaining({ id: 'geo_substitution_for_transitive', text: 'eq-subst' }))
      expect(answer.trap).toBe('geo_substitution_for_transitive')
      expect(answer.trapAnswer).toBe('eq-subst')
    }
    expect(equality).toBeGreaterThan(0)
    expect(congruence).toBeGreaterThan(0)
  }, HEAVY)
})

describe('every promised trap is a real choice that grades as that mistake', () => {
  // These skeletons used to promise substitution on the chain row. They now promise the reflexive pick
  // on the row that turns an equality around.
  const TURN_AROUND: Record<string, { row: number; answer: string }> = {
    'cong-supplements': { row: 4, answer: 'eq-refl' },
    'cong-complements': { row: 4, answer: 'eq-refl' },
    'right-angles': { row: 4, answer: 'eq-refl' },
    'transitive-segments': { row: 3, answer: 'self' },
    chain: { row: 2, answer: 'eq-refl' },
  }

  it.each(['gp.reason', 'gp.algebraic', 'gp.twocolumn'] as const)('%s over 300 seeds', (template) => {
    const skeletons = new Set<string>()
    for (const seed of SEEDS_300) {
      const { skeleton, answer } = drawn(template, seed)
      const where = `${template}/${seed} ${skeleton}`
      skeletons.add(skeleton)
      const at = answer.stages.findIndex((stage) => stage.id === answer.trapStage)
      const stage = answer.stages[at]
      if (!stage) throw new Error(`${where}: no part ${answer.trapStage}`)
      expect(gradeGeoStage(answer, stage.id, answer.trapAnswer), where).toMatchObject({ verdict: 'mistake', mistake: answer.trap })
      expect(stage.traps, where).toContainEqual(expect.objectContaining({ id: answer.trap, text: answer.trapAnswer }))
      if (stage.kind === 'choice') {
        expect(stage.choices?.find((choice) => choice.id === answer.trapAnswer)?.trap, where).toBe(answer.trap)
      } else {
        expect(isReason(answer.trapAnswer), where).toBe(true)
        expect(answer.trapAnswer, where).not.toBe(stage.answerText)
        expect(stage.accept ?? [], where).not.toContain(answer.trapAnswer)
      }
      if (template !== 'gp.reason') expect(answer.trap, where).not.toBe('geo_substitution_for_transitive')
      const turn = TURN_AROUND[skeleton]
      if (turn) {
        expect(answer.trap, where).toBe('geo_reflexive_for_symmetric')
        expect(at, where).toBe(turn.row)
        expect(answer.trapAnswer, where).toBe(turn.answer)
        expect(linesOf(answer)[at]?.reason, where).toBe('eq-sym')
      }
    }
    if (template === 'gp.twocolumn') expect(skeletons.size).toBe(12)
    if (template === 'gp.algebraic') expect([...skeletons].sort()).toEqual(['chain', 'distribute', 'sym-div'])
  }, HEAVY)
})

describe('proof rule cards use the reserved story', () => {
  it('each example is one wrong line ✗ → one right line, with no statement or number a proof prints', () => {
    const statements = new Set<string>()
    const numbers = new Set<string>()
    for (const template of ['gp.reason', 'gp.algebraic', 'gp.twocolumn'] as const) {
      for (const seed of SEEDS_300) {
        const { answer } = drawn(template, seed)
        const choices = answer.stages.flatMap((stage) => (stage.choices ?? []).map((choice) => choice.text))
        for (const text of [...linesOf(answer).map((line) => line.statement), ...(answer.lines ?? []), ...choices]) {
          statements.add(text)
          for (const n of text.match(/\d+/g) ?? []) numbers.add(n)
        }
      }
    }
    for (const card of PROOF_RULES) {
      const example = card.example ?? ''
      expect(example.split('✗'), card.id).toHaveLength(2)
      expect(example.split('→'), card.id).toHaveLength(2)
      // Nothing trails the right line: no second sentence after the arrow.
      expect(example.split('→')[1], card.id).not.toMatch(/[.!?]\s/)
      for (const statement of statements) expect(example.includes(statement), `${card.id} shows “${statement}”`).toBe(false)
      // Angle 8 is the reserved angle; any other number on a card must be one no proof prints.
      for (const n of example.replace(/angle 8\b/gi, '').match(/\d+/g) ?? []) expect(numbers.has(n), `${card.id} uses ${n}`).toBe(false)
    }
  }, HEAVY)
})
