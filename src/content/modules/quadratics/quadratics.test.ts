import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { AnswerSpec, ProblemInstance } from '@/content/types'
import {
  ERROR_PATTERNS,
  POLY_MISTAKE_KINDS,
  axisMistakes,
  checkSquareLine,
  completeSquare,
  gradeAxisOfSymmetry,
  gradeVertex,
  gradeVertexForm,
  squareMistakes,
  verifyRewrite,
  vertexMistakes,
} from '@/engine'
import { POLY_PATTERN } from '@/content/modules/polynomials/patterns'
import { CS_RULE_FOR, CS_RULE_IDS, CS_RULES, csRuleIdFor, gradeExtremum, gradeOpens, quadSelfTest, quadTrapKinds } from './index'

type QuadAnswer = Extract<AnswerSpec, { type: 'quadratics' }>

const SEEDS = 300
const LOOP_TIMEOUT = 120_000

function quad(p: ProblemInstance): QuadAnswer {
  if (p.answer.type !== 'quadratics') throw new Error(`${p.id}: not a quadratics answer`)
  return p.answer
}

/** Words that would hand her the method or the trap. The sentence above the prompt may not use them. */
const METHOD_WORDS = /half|halve|factor|square it|add and subtract|opposite|−b|2a|parenthes/i

describe('quadratics module', () => {
  it('is registered with two templates and its own rule cards', () => {
    const mod = getModule('quadratics')
    expect(mod.title).toBe('Completing the square')
    expect(mod.subject).toBeUndefined()
    expect(mod.templates.map((t) => t.id)).toEqual(['cs.form', 'cs.vertex'])
    expect(mod.ruleCards).toBe(CS_RULES)
    expect(new Set(CS_RULES.map((c) => c.id)).size).toBe(CS_RULES.length)
    expect(CS_RULES.map((c) => c.id).sort()).toEqual(Object.values(CS_RULE_IDS).sort())
    for (const template of mod.templates) expect(template.knobs.map((k) => k.key)).toEqual(['fractions'])
  })

  it('has a rule card for every completing-the-square mistake kind, and none for the others', () => {
    const cs = POLY_MISTAKE_KINDS.filter((k) => k.startsWith('cs_'))
    expect(Object.keys(CS_RULE_FOR).sort()).toEqual([...cs].sort())
    for (const kind of cs) {
      expect(CS_RULES.some((c) => c.id === csRuleIdFor(kind)), kind).toBe(true)
      expect(ERROR_PATTERNS[POLY_PATTERN[kind]]).toBeTruthy()
    }
    expect(csRuleIdFor('sd_subtracted')).toBeUndefined()
    expect(csRuleIdFor('none')).toBeUndefined()
  })
})

describe.each(['cs.form', 'cs.vertex'] as const)('%s over 300 seeds', (templateId) => {
  const question = templateId === 'cs.form' ? 'form' : 'vertex'

  it(
    'is deterministic, passes the engine self-tests, grades its own answers correct, and promises a real trap',
    () => {
      const leads = new Set<string>()
      const traps = new Set<string>()
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('quadratics', templateId, seed)
        expect(generateProblem('quadratics', templateId, seed), p.id).toEqual(p)
        const a = quad(p)
        expect(p.kind).toBe('quadratics')
        expect(p.moduleId).toBe('quadratics')
        expect(p.skill).toBe(templateId)
        expect(a.question).toBe(question)
        expect(p.canonical).toEqual([])
        expect(p.vars).toEqual(['x'])

        // §5 self-tests, straight from the engine.
        expect(quadSelfTest(a.f, seed), p.id).toBeNull()
        const m = completeSquare(a.f)
        expect(m, p.id).not.toBeNull()
        if (!m) continue
        expect(m.f).toBe(a.f)
        expect(p.statementText).toBe(m.f)
        expect(gradeVertexForm(a.f, m.vertexForm).verdict, p.id).toBe('correct')
        expect(gradeVertex(a.f, m.vertexText).verdict, p.id).toBe('correct')
        expect(gradeAxisOfSymmetry(a.f, m.axisText).verdict, p.id).toBe('correct')
        for (let i = 0; i < m.path.length; i++) {
          const g = checkSquareLine(a.f, m.path[i]!.text)
          expect(g.verdict, `${p.id} ${m.path[i]!.text}`).toBe('correct')
          if (g.verdict === 'correct') expect(g.done, `${p.id} ${m.path[i]!.text}`).toBe(i === m.path.length - 1)
          if (i > 0) expect(verifyRewrite(m.path[i - 1]!.text, m.path[i]!.text, { vars: ['x'], seed }).ok, `${p.id} line ${i}`).toBe(true)
        }

        // The answer spec is the engine's, and its canonical answers grade correct (never unsupported).
        expect(a.vertexForm).toBe(m.vertexForm)
        expect(a.vertexText).toBe(m.vertexText)
        expect(a.axisText).toBe(m.axisText)
        expect(a.opens).toBe(m.opens)
        expect(a.extremumKind).toBe(m.extremum.kind)
        expect(a.path.map((l) => l.text)).toEqual(m.path.map((l) => l.text))
        expect(gradeVertexForm(a.f, a.vertexForm).verdict).toBe('correct')
        expect(gradeVertex(a.f, a.vertexText).verdict).toBe('correct')
        expect(gradeAxisOfSymmetry(a.f, a.axisText).verdict).toBe('correct')
        expect(gradeOpens(a.f, a.opens).verdict).toBe('correct')
        expect(gradeExtremum(a.f, a.extremumKind, a.extremumText, { vertex: a.vertexText }).verdict, p.id).toBe('correct')

        // What to avoid (§5): b = 0, a vertex on an axis or on y = x.
        expect(m.path.length, p.id).toBeGreaterThan(2)
        expect(m.b.n).not.toBe(0)
        expect(m.h.n).not.toBe(0)
        expect(m.k.n).not.toBe(0)
        const vertexKinds = (vertexMistakes(a.f) ?? []).map((c) => c.kind)
        expect(vertexKinds).toContain('cs_h_sign')
        expect(vertexKinds).toContain('cs_vertex_swapped')
        // Whole-number h unless the knob asks for fractions.
        expect(m.h.d, p.id).toBe(1)
        expect(p.params.fractionalH).toBe(false)

        // The promised trap is one the engine lists for THIS question, and its rule card leads.
        const kinds = quadTrapKinds(a.f, question)
        expect(kinds.length).toBeGreaterThan(0)
        expect(kinds, `${p.id} trap ${a.trap}`).toContain(a.trap)
        const fromEngine = question === 'form' ? squareMistakes(a.f) : [...(vertexMistakes(a.f) ?? []), ...(axisMistakes(a.f) ?? [])]
        expect((fromEngine ?? []).map((c) => c.kind)).toContain(a.trap)
        expect(p.params.trap).toBe(a.trap)
        expect(a.ruleCard).toBe(csRuleIdFor(a.trap))
        expect(a.ruleCards[0]).toBe(a.ruleCard)
        expect(new Set(a.ruleCards).size).toBe(a.ruleCards.length)
        for (const id of a.ruleCards) expect(CS_RULES.some((c) => c.id === id), id).toBe(true)

        // The sentences above the work say what the problem is, not how to do it. The method is the hint.
        for (const text of [p.title, p.instructions, a.prompt]) expect(text, text).not.toMatch(METHOD_WORDS)
        expect(a.nudge.length).toBeGreaterThan(40)
        expect(a.nudge).not.toContain(a.vertexForm)
        expect(a.reveal.length).toBeGreaterThan(2)

        leads.add(String(p.params.a))
        traps.add(a.trap)
      }
      // a = 1 and every other lead come up; every kind the question can show gets promised somewhere.
      expect([...leads].sort()).toEqual(['-1', '-2', '1', '1/2', '2', '3'])
      const expected = question === 'form' ? ['cs_constant_not_scaled', 'cs_h_sign', 'cs_half_or_square', 'cs_no_factor_a', 'cs_unbalanced'] : ['cs_constant_not_scaled', 'cs_h_sign', 'cs_half_or_square', 'cs_no_factor_a', 'cs_unbalanced', 'cs_vertex_swapped']
      expect([...traps].sort()).toEqual(expected)
    },
    LOOP_TIMEOUT,
  )

  it(
    'keeps a = 1 common and prefers 3, −2, −1 and 1/2 over 2',
    () => {
      const count: Record<string, number> = {}
      for (let seed = 1; seed <= SEEDS; seed++) {
        const a = String(generateProblem('quadratics', templateId, seed).params.a)
        count[a] = (count[a] ?? 0) + 1
      }
      expect(count['1']!).toBeGreaterThan(SEEDS * 0.2)
      expect(count['1']!).toBeLessThan(SEEDS * 0.55)
      for (const lead of ['3', '-2', '-1', '1/2']) expect(count[lead]!, lead).toBeGreaterThan(count['2']!)
    },
    LOOP_TIMEOUT,
  )

  it(
    'the fractions knob gives a half-integer h on every seed, still passing the self-tests',
    () => {
      for (let seed = 1; seed <= 60; seed++) {
        const p = generateProblem('quadratics', templateId, seed, { fractions: true })
        const a = quad(p)
        const m = completeSquare(a.f)!
        expect(m.h.d, p.id).toBe(2)
        expect(p.params.fractionalH).toBe(true)
        expect(quadSelfTest(a.f, seed), p.id).toBeNull()
        expect(quadTrapKinds(a.f, question)).toContain(a.trap)
        expect(generateProblem('quadratics', templateId, seed, { fractions: true })).toEqual(p)
      }
    },
    LOOP_TIMEOUT,
  )
})

describe('cs.form', () => {
  it(
    'starts the worked column at f, has no calculator panel, and keeps the graph off the rail',
    () => {
      for (let seed = 1; seed <= 40; seed++) {
        const p = generateProblem('quadratics', 'cs.form', seed)
        const a = quad(p)
        expect(p.start).toBe(a.f)
        expect(p.graph).toEqual({ kind: 'none' })
        expect(p.calc).toEqual({ ti84: [], nspire: [] })
        // The reveal walks the engine's path, then states the vertex form.
        expect(a.reveal).toHaveLength(a.path.length)
        expect(a.reveal.at(-1)).toMatch(/^Vertex form: f\(x\) = /)
        for (let i = 1; i < a.path.length; i++) expect(a.reveal[i - 1]).toContain(a.path[i]!.reason)
        expect(a.expectedDisplay).toBe(a.vertexForm.replace(/-/g, '−'))
      }
    },
    LOOP_TIMEOUT,
  )

  it(
    'every unshadowed slip the engine lists is named when she types it as a line',
    () => {
      for (let seed = 1; seed <= 40; seed++) {
        const a = quad(generateProblem('quadratics', 'cs.form', seed))
        for (const cand of squareMistakes(a.f) ?? []) {
          const g = checkSquareLine(a.f, cand.text)
          expect(g.verdict, `${a.f}: ${cand.text}`).toBe('mistake')
          if (g.verdict === 'mistake') expect(g.mistake, `${a.f}: ${cand.text}`).toBe(cand.kind)
        }
      }
    },
    LOOP_TIMEOUT,
  )
})

describe('cs.vertex', () => {
  it(
    'has TI-84 and Nspire steps for the minimum / maximum tool, and a graph kept for after she finishes',
    () => {
      for (let seed = 1; seed <= 40; seed++) {
        const p = generateProblem('quadratics', 'cs.vertex', seed)
        const a = quad(p)
        const m = completeSquare(a.f)!
        expect(p.start).toBeNull()
        expect(p.graph).toEqual({ kind: 'none' })
        expect(a.reveal).toEqual(m.explanation)
        expect(a.expectedDisplay).toContain(`opens ${a.opens}`)
        expect(a.expectedDisplay).toContain(`${a.extremumKind} value`)

        const tool = a.extremumKind
        expect(p.calc.ti84.length).toBeGreaterThanOrEqual(3)
        expect(p.calc.nspire.length).toBeGreaterThanOrEqual(3)
        expect(p.calc.ti84[0]!.keys).toMatch(/^Y= → Y1 = /)
        expect(p.calc.ti84[0]!.keys).not.toMatch(/x/)
        expect(p.calc.ti84.some((s) => s.keys.includes(tool === 'minimum' ? '3:minimum' : '4:maximum'))).toBe(true)
        expect(p.calc.nspire[0]!.keys).toContain('f1(x) = ')
        expect(p.calc.nspire.some((s) => s.keys.includes(tool === 'minimum' ? 'Minimum' : 'Maximum'))).toBe(true)
        for (const s of [...p.calc.ti84, ...p.calc.nspire]) expect(`${s.title} ${s.keys}`).not.toMatch(/undefined|NaN/)

        // The parabola: a window that holds the vertex and the origin, sampled through the vertex.
        const g = a.graph
        expect(g.kind).toBe('function')
        const h = m.h.n / m.h.d
        const k = m.k.n / m.k.d
        expect(g.markers).toHaveLength(1)
        expect(g.markers![0]).toMatchObject({ x: h, y: k })
        expect(g.markers![0]!.label).toBe(a.vertexText.replace(/-/g, '−'))
        const [xLo, xHi] = g.xDomain!
        const [yLo, yHi] = g.yDomain!
        expect(xLo).toBeLessThan(Math.min(h, 0))
        expect(xHi).toBeGreaterThan(Math.max(h, 0))
        expect(yLo).toBeLessThan(Math.min(k, 0))
        expect(yHi).toBeGreaterThan(Math.max(k, 0))
        expect(g.samples!.length).toBeGreaterThan(100)
        expect(g.samples!.some((s) => Math.abs(s.x - h) < 1e-9 && Math.abs(s.y - k) < 1e-9), p.id).toBe(true)
      }
    },
    LOOP_TIMEOUT,
  )

  it('every vertex and axis slip the engine lists is named by its grader', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const a = quad(generateProblem('quadratics', 'cs.vertex', seed))
      for (const cand of vertexMistakes(a.f) ?? []) {
        const g = gradeVertex(a.f, cand.text)
        expect(g.verdict, `${a.f}: ${cand.text}`).toBe('mistake')
        if (g.verdict === 'mistake') expect(g.mistake).toBe(cand.kind)
      }
      for (const cand of axisMistakes(a.f) ?? []) {
        const g = gradeAxisOfSymmetry(a.f, cand.text)
        expect(g.verdict, `${a.f}: ${cand.text}`).toBe('mistake')
        if (g.verdict === 'mistake') expect(g.mistake).toBe(cand.kind)
      }
    }
  }, LOOP_TIMEOUT)
})

describe('gradeOpens and gradeExtremum', () => {
  const F = '2x^2 - 12x + 13' // 2(x − 3)^2 − 5: vertex (3, −5), opens up, minimum −5
  const G = '-x^2 - 6x + 13' // −(x + 3)^2 + 22: vertex (−3, 22), opens down, maximum 22

  it('grades the direction from the engine, and an unanswered choice is not an attempt', () => {
    expect(gradeOpens(F, 'up')).toMatchObject({ verdict: 'correct' })
    expect(gradeOpens(G, 'down')).toMatchObject({ verdict: 'correct' })
    const wrong = gradeOpens(F, 'down')
    expect(wrong.verdict).toBe('wrong')
    if (wrong.verdict === 'wrong') expect(wrong.message).toContain('a = 2 is positive')
    const down = gradeOpens(G, 'up')
    if (down.verdict === 'wrong') expect(down.message).toContain('a = −1 is negative')
    expect(gradeOpens(F, '')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(gradeOpens('x^3 + 1', 'up').verdict).toBe('unsupported')
  })

  it('grades the minimum or maximum value exactly, in any spelling of the number', () => {
    expect(gradeExtremum(F, 'minimum', '-5').verdict).toBe('correct')
    expect(gradeExtremum(F, 'minimum', '−5').verdict).toBe('correct')
    expect(gradeExtremum(F, 'minimum', '-10/2').verdict).toBe('correct')
    expect(gradeExtremum(G, 'maximum', '22').verdict).toBe('correct')
    expect(gradeExtremum('x^2 + 3x + 1', 'minimum', '-5/4').verdict).toBe('correct')
    expect(gradeExtremum('x^2 + 3x + 1', 'minimum', '-1.25').verdict).toBe('correct')
  })

  it('says which part is off without giving the value away', () => {
    const kind = gradeExtremum(F, 'maximum', '-5')
    expect(kind.verdict).toBe('wrong')
    if (kind.verdict === 'wrong') expect(kind.message).toContain('it is a minimum, not a maximum')

    const x = gradeExtremum(F, 'minimum', '3')
    expect(x.verdict).toBe('wrong')
    if (x.verdict === 'wrong') {
      expect(x.message).toContain('x-coordinate of the vertex')
      expect(x.message).not.toContain('−5')
    }

    const off = gradeExtremum(F, 'minimum', '1')
    expect(off.verdict).toBe('wrong')
    if (off.verdict === 'wrong') expect(off.message).not.toContain('−5')
  })

  it('lets the engine name a value that is the k of a slip, unless her vertex box already says it', () => {
    // 13 − 9 = 4: took the 9 out without multiplying by a = 2.
    const named = gradeExtremum(F, 'minimum', '4')
    expect(named).toMatchObject({ verdict: 'mistake', mistake: 'cs_constant_not_scaled' })
    const echoed = gradeExtremum(F, 'minimum', '4', { vertex: '(3, 4)' })
    expect(echoed.verdict).toBe('wrong')
    if (echoed.verdict === 'wrong') expect(echoed.message).toContain('y-coordinate of the vertex you gave')
    // A right value is right whatever the vertex box says.
    expect(gradeExtremum(F, 'minimum', '-5', { vertex: '(-3, -5)' }).verdict).toBe('correct')
  })

  it('an empty, unreadable or unchosen answer is invalid, never wrong', () => {
    expect(gradeExtremum(F, '', '-5')).toMatchObject({ verdict: 'invalid' })
    expect(gradeExtremum(F, 'minimum', '')).toMatchObject({ verdict: 'invalid' })
    expect(gradeExtremum(F, 'minimum', 'y = -5')).toMatchObject({ verdict: 'invalid' })
    expect(gradeExtremum(F, 'minimum', 'five')).toMatchObject({ verdict: 'invalid' })
  })
})
