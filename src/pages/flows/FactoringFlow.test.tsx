// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { FA_RULES, FA_RULE_IDS, gradeFactoringStage, type FactoringAnswer } from '@/content/modules/factoring'
import type { ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { resetStoreForTests, useStore } from '@/store'
import { problemPath } from '@/problem/url'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/" element={<p>home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function find(templateId: string, pred: (a: FactoringAnswer, p: ProblemInstance) => boolean): { seed: number; a: FactoringAnswer } {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('factoring', templateId, seed)
    if (p.answer.type === 'factoring' && pred(p.answer, p)) return { seed, a: p.answer }
  }
  throw new Error(`no ${templateId} seed`)
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function field(label: string | RegExp): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const hintsPanel = () => screen.getByRole('heading', { name: 'Hints' }).closest('section')!
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'
const PRODUCT = 'Factored form'
const CUBE1 = 'What is cubed in the first term'
const CUBE2 = 'What is cubed in the second term'
const cardTitle = (key: keyof typeof FA_RULE_IDS) => FA_RULES.find((c) => c.id === FA_RULE_IDS[key])!.title

/** The rule card shown first on the second hint rung (not one of the cards folded under it). */
function leadCard(title: string) {
  expect(within(hintsPanel()).getByText(title).closest('details')).toBeNull()
}

function slipText(a: FactoringAnswer, id: string, key: string): string {
  const slip = a.slips.find((s) => s.id === id && s.entries[key] !== undefined)
  if (!slip) throw new Error(`no ${id} slip`)
  return slip.entries[key]!
}

function witnessOf(a: FactoringAnswer, stage: FactoringAnswer['stages'][number]['id'], entries: Record<string, string>): string {
  const grade = gradeFactoringStage(a, stage, entries).parts.find((p) => p.grade.verdict === 'mistake')?.grade
  if (!grade || grade.verdict !== 'mistake') throw new Error('expected a named mistake')
  return grade.witness
}

beforeEach(() => {
  resetStoreForTests()
})

describe('FactoringFlow: sum or difference of cubes (fa.cubes)', () => {
  // (mx)^3 ± n^3 with m ≥ 2 and no common factor: the cube root of the number in front is a slip to make.
  const hit = find('fa.cubes', (a) => a.shape.m >= 2 && a.shape.g === 1 && a.shape.e === 0)
  const a = hit.a
  const path = problemPath('factoring', 'fa.cubes', hit.seed)
  const { m, n } = a.shape

  it(
    'names the cube root not taken, then the middle sign; each fix moves on, events are recorded, and it completes',
    () => {
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Part 1 of 2: What is cubed' })).toBeTruthy()
      // The factored form waits until the cube roots are right.
      expect(screen.queryByLabelText(PRODUCT)).toBeNull()
      expect(field(CUBE1).className).toContain('min-h-12')
      expect(screen.getByRole('button', { name: 'Check the cube roots' }).className).toContain('btn-chunky')

      type(CUBE1, `${m ** 3}x`)
      type(CUBE2, `${n}`)
      click('Check the cube roots')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.fa_cube_root_coefficient.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.fa_cube_root_coefficient.lesson)
      expect(alert.textContent).toContain(witnessOf(a, 'cubed', { cube1: `${m ** 3}x`, cube2: `${n}` }))
      expect(finals()).toMatchObject([{ correct: false, pattern: 'fa_cube_root_coefficient', via: 'text' }])
      // The same boxes again are not a second try.
      click('Check the cube roots')
      expect(finals()).toHaveLength(1)
      click('Nudge me')
      expect(within(hintsPanel()).getByText(a.stages[0]!.nudge)).toBeTruthy()
      click('Show the rule')
      leadCard(cardTitle('cubeRoots'))
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()

      type(CUBE1, a.cubed!.first)
      click('Check the cube roots')
      expect(finals()).toHaveLength(2)
      expect(finals()[1]).toMatchObject({ correct: true })
      expect(screen.getByText('Both cube roots are right.')).toBeTruthy()
      expect(field(CUBE1).disabled).toBe(true)
      expect(useStore.getState().attempt?.final?.polyStage).toBe(1)

      // Part 2: the factored form, with its own hint ladder.
      expect(screen.getByRole('heading', { name: 'Part 2 of 2: The factored form' })).toBeTruthy()
      expect(document.activeElement).toBe(field(PRODUCT))
      expect(within(hintsPanel()).queryByText(a.stages[0]!.nudge)).toBeNull()
      const sameSign = slipText(a, 'fa_cube_middle_sign', 'product')
      type(PRODUCT, sameSign)
      click('Check the answer')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.fa_cube_middle_sign.title)
      expect(alert.textContent).toContain(witnessOf(a, 'product', { product: sameSign }))
      expect(alert.textContent).toContain('Example:')
      expect(finals()).toHaveLength(3)
      expect(finals()[2]).toMatchObject({ correct: false, pattern: 'fa_cube_middle_sign' })
      click('Nudge me')
      click('Show the rule')
      leadCard(cardTitle('cubes'))
      expect(doneEvent()).toBeUndefined()

      // The right factors in another order.
      const [binomial, trinomial] = a.answerText.match(/\([^)]*\)/g)!
      type(PRODUCT, `${trinomial}${binomial}`)
      click('Check the answer')
      expect(finals()).toHaveLength(4)
      expect(finals()[3]).toMatchObject({ correct: true })
      expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
      for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(field(PRODUCT).disabled).toBe(true)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer or the polynomial typed back records nothing; a reload restores her boxes and her part',
    () => {
      const view = renderAt(path)
      click('Check the cube roots')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(document.activeElement).toBe(field(CUBE1))
      expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toEqual([])
      type(CUBE1, a.cubed!.first)
      expect(screen.queryByRole('alert')).toBeNull()
      type(CUBE2, a.cubed!.second)
      click('Check the cube roots')
      expect(finals()).toHaveLength(1)

      type(PRODUCT, '(x - 2')
      click('Check the answer')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      type(PRODUCT, a.f)
      click('Check the answer')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('not a product')
      expect(finals()).toHaveLength(1)

      type(PRODUCT, '(x + 1)(')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toMatchObject({ cube1: a.cubed!.first, cube2: a.cubed!.second, product: '(x + 1)(' })
      renderAt(path)
      expect(screen.getByRole('heading', { name: 'Part 2 of 2: The factored form' })).toBeTruthy()
      expect(field(PRODUCT).value).toBe('(x + 1)(')
      expect(field(CUBE1).value).toBe(a.cubed!.first)
      expect(field(CUBE1).disabled).toBe(true)
      type(PRODUCT, a.answerText)
      click('Check the answer')
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})

describe('FactoringFlow: squares (fa.squares)', () => {
  const hit = find('fa.squares', (a) => a.prime)
  const a = hit.a
  const path = problemPath('factoring', 'fa.squares', hit.seed)

  it(
    'a sum of two squares factored as (a + b)(a − b) is named; choosing that it does not factor completes',
    () => {
      renderAt(path)
      const group = screen.getByRole('group', { name: 'This polynomial' })
      const options = within(group).getAllByRole('radio') as HTMLInputElement[]
      expect(options.map((o) => o.value)).toEqual(a.choiceOrder)
      expect(options.every((o) => !o.checked)).toBe(true)
      const split = slipText(a, 'fa_sum_of_squares', 'product')
      type(PRODUCT, split)
      click('Check the answer')
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.fa_sum_of_squares.title)
      expect(finals()).toMatchObject([{ correct: false, pattern: 'fa_sum_of_squares' }])
      click('Nudge me')
      click('Show the rule')
      leadCard(cardTitle('sos'))

      fireEvent.click(within(group).getByRole('radio', { name: 'does not factor over the integers' }))
      click('Check the answer')
      expect(finals()).toHaveLength(2)
      expect(finals()[1]).toMatchObject({ correct: true })
      expect(doneEvent()).toMatchObject({ finalCorrect: false })
      expect(screen.getAllByText(`Correct: ${a.f.replace(/-/g, '−')} is a sum of two squares, so it does not factor over the integers.`).length).toBeGreaterThan(0)
      for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})

describe('FactoringFlow: grouping (fa.grouping)', () => {
  // A negative third term that is minus a perfect square: the sign slip, then stopping early.
  const hit = find('fa.grouping', (a) => a.shape.k[1]! < 0 && Number.isInteger(Math.sqrt(-a.shape.k[1]!)))
  const a = hit.a
  const path = problemPath('factoring', 'fa.grouping', hit.seed)
  const PAIR1 = /^First pair/
  const PAIR2 = /^Second pair/

  it(
    'names the sign not changed in the second pair, then a product that stopped early; the finished product completes',
    () => {
      renderAt(path)
      expect(screen.getByRole('heading', { name: 'Part 1 of 2: Factor each pair' })).toBeTruthy()
      const wrongSign = slipText(a, 'fa_group_sign', 'pair2')
      type(PAIR1, a.pairs!.firstAnswer)
      type(PAIR2, wrongSign)
      click('Check the pairs')
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.fa_group_sign.title)
      expect(finals()).toMatchObject([{ correct: false, pattern: 'fa_group_sign' }])
      click('Nudge me')
      click('Show the rule')
      leadCard(cardTitle('groupSign'))

      type(PAIR2, a.pairs!.secondAnswer)
      click('Check the pairs')
      expect(finals()[1]).toMatchObject({ correct: true })
      expect(screen.getByRole('heading', { name: 'Part 2 of 2: The factored form' })).toBeTruthy()

      const early = slipText(a, 'fa_stopped_early', 'product')
      type(PRODUCT, early)
      click('Check the answer')
      expect(screen.getByRole('alert').textContent).toContain(ERROR_PATTERNS.fa_stopped_early.title)
      expect(finals()[2]).toMatchObject({ correct: false, pattern: 'fa_stopped_early' })
      expect(doneEvent()).toBeUndefined()

      type(PRODUCT, a.answerText)
      click('Check the answer')
      expect(finals()[3]).toMatchObject({ correct: true })
      expect(doneEvent()).toMatchObject({ finalCorrect: false })
    },
    FLOW_TIMEOUT,
  )
})

describe('FactoringFlow: one part, right the first time (fa.trinomial)', () => {
  it(
    'the trinomial factored right at once is a complete first-try problem',
    () => {
      const hit = find('fa.trinomial', () => true)
      renderAt(problemPath('factoring', 'fa.trinomial', hit.seed))
      expect(screen.getByRole('heading', { name: 'The factored form' })).toBeTruthy()
      type(PRODUCT, hit.a.answerText)
      click('Check the answer')
      expect(finals()).toMatchObject([{ correct: true }])
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1, revealed: 0 })
    },
    FLOW_TIMEOUT,
  )
})
