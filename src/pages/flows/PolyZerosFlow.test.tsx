// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { canonicalEntries, gradeZerosStage, zerosSpec, type PolyZerosAnswer } from '@/content/modules/polyZeros'
import type { ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS, endBehaviorMistakes, polynomialFromZerosMistakes, rationalRootCandidates, rootCandidateMistakes } from '@/engine'
import { ratToString } from '@/notation'
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

function find(templateId: string, pred: (a: PolyZerosAnswer, p: ProblemInstance) => boolean): { seed: number; a: PolyZerosAnswer; p: ProblemInstance } {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generateProblem('polyZeros', templateId, seed)
    if (p.answer.type === 'polyZeros' && pred(p.answer, p)) return { seed, a: p.answer, p }
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

function radio(group: string, option: string | RegExp): HTMLInputElement {
  return within(screen.getByRole('group', { name: group })).getByRole('radio', { name: option }) as HTMLInputElement
}

const show = (text: string) => text.replace(/-/g, '−')
const opposite = (text: string) => (text.startsWith('-') ? text.slice(1) : `-${text}`)
const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const hintsPanel = () => screen.getByRole('heading', { name: 'Hints' }).closest('section')!
const graph = () => screen.queryByRole('img', { name: /^Graph of/ })
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

/** The rule card shown first on the second hint rung (not one of the cards folded under it). */
function leadCard(title: string) {
  expect(within(hintsPanel()).getByText(title).closest('details')).toBeNull()
}

function witnessOf(a: PolyZerosAnswer, stage: PolyZerosAnswer['stages'][number]['id'], entries: Record<string, string>): string {
  const grade = gradeZerosStage(a, stage, entries).parts[0]!.grade
  if (grade.verdict !== 'mistake') throw new Error(`expected a named mistake, got ${grade.verdict}`)
  return grade.witness
}

beforeEach(() => {
  resetStoreForTests()
})

describe('PolyZerosFlow: zeros and multiplicity (pz.zeros)', () => {
  // Three zeros, none at 0, every factor starting with a plain x: each zero has a sign to get backwards.
  const hit = find('pz.zeros', (a, p) => a.zeros.length === 3 && a.zeros.every((z) => z.text !== '0') && p.params.nonmonic === false)
  const a = hit.a
  const path = problemPath('polyZeros', 'pz.zeros', hit.seed)
  const right = canonicalEntries(a)
  const atZero = (i: number) => `At x = ${show(a.zeros[i]!.text)}, the graph`
  const CROSSES = 'crosses the x-axis'
  const TOUCHES = 'touches the x-axis and turns back'
  const label = (behavior: string | undefined) => (behavior === 'crosses' ? CROSSES : TOUCHES)

  function addRows(n: number) {
    while (!screen.queryByLabelText(`Zero ${n}`)) click('Add another zero')
  }

  function fillRows(zeros: readonly string[], mults: readonly string[]) {
    addRows(zeros.length)
    zeros.forEach((z, i) => {
      type(`Zero ${i + 1}`, z)
      type(`Multiplicity of zero ${i + 1}`, mults[i]!)
    })
  }

  const rightZeros = a.zeros.map((z) => z.text)
  const rightMults = a.zeros.map((z) => String(z.mult))

  function passZeros() {
    fillRows(rightZeros, rightMults)
    click('Check the zeros')
  }

  it(
    'names the sign slip, then the ignored multiplicities, then a wrong crosses / touches choice; each fix moves on; the graph waits for the end',
    () => {
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Part 1 of 2: Zeros and multiplicities' })).toBeTruthy()
      // The graph shows the answer: nothing of it before she finishes, in the page or in the rail.
      expect(graph()).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'The graph of f' })).toBeNull()
      // The calculator steps are there, behind their gate.
      expect(screen.getByRole('heading', { name: 'Calculator' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Show calculator steps' })).toBeTruthy()
      expect(screen.queryByText(/TBLSET/)).toBeNull()
      // One row to start with (the number of rows would say how many zeros there are), and no second part.
      expect(screen.queryByLabelText('Zero 2')).toBeNull()
      expect(screen.queryByRole('group', { name: atZero(0) })).toBeNull()
      for (const name of ['Zero 1', 'Multiplicity of zero 1']) {
        expect(field(name).className).toContain('min-h-12')
        expect(field(name).type).toBe('text')
        expect(field(name).placeholder).toBe('')
      }
      expect(screen.getByRole('button', { name: 'Add another zero' }).className).toContain('min-h-11')
      expect(screen.getByRole('button', { name: 'Check the zeros' }).className).toContain('min-h-12')
      expect(screen.queryByRole('button', { name: 'Remove zero 1' })).toBeNull()

      // Every zero with the sign of the number in its factor.
      const backwards = rightZeros.map(opposite)
      fillRows(backwards, rightMults)
      expect(screen.getByRole('button', { name: 'Remove zero 2' }).className).toContain('min-h-12')
      const signEntries = { ...right }
      backwards.forEach((z, i) => (signEntries[`z${i}`] = z))
      click('Check the zeros')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_zero_sign_reversed.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_zero_sign_reversed.lesson)
      expect(alert.textContent).toContain(witnessOf(a, 'zeros', signEntries))
      expect(alert.textContent).toContain('Example:')
      expect(finals()).toMatchObject([{ correct: false, pattern: 'poly_zero_sign_reversed', via: 'text' }])
      // The worked explanation holds the answer: it is not shown beside a mistake she can still fix.
      expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()
      expect(screen.queryByRole('region', { name: 'Worked explanation' })).toBeNull()

      // The same rows again are not a second try.
      click('Check the zeros')
      expect(finals()).toHaveLength(1)

      click('Nudge me')
      expect(within(hintsPanel()).getByText(a.stages[0]!.nudge)).toBeTruthy()
      click('Show the rule')
      leadCard('A zero is where a factor equals 0')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()

      // The zeros right, every multiplicity 1.
      fillRows(rightZeros, rightZeros.map(() => '1'))
      click('Check the zeros')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_multiplicity_ignored.title)
      expect(finals()).toHaveLength(2)
      expect(finals()[1]).toMatchObject({ correct: false, pattern: 'poly_multiplicity_ignored' })
      // The rule card follows the slip just named.
      leadCard('Multiplicity is the exponent on the factor')
      expect(screen.queryByRole('group', { name: atZero(0) })).toBeNull()

      passZeros()
      expect(finals()).toHaveLength(3)
      expect(finals()[2]).toMatchObject({ correct: true })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByText('The zeros and their multiplicities are right.')).toBeTruthy()
      expect(field('Zero 1').disabled).toBe(true)
      expect(field('Multiplicity of zero 3').disabled).toBe(true)
      expect(screen.queryByRole('button', { name: 'Add another zero' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Remove zero 1' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Check the zeros' })).toBeNull()
      expect(useStore.getState().attempt?.final?.polyStage).toBe(1)

      // Part 2: one choice per zero, in ascending order, 44 px targets, nothing chosen, focus in the first.
      expect(screen.getByRole('heading', { name: 'Part 2 of 2: At each zero' })).toBeTruthy()
      a.zeros.forEach((_, i) => {
        for (const option of [CROSSES, TOUCHES]) {
          expect(radio(atZero(i), option).checked).toBe(false)
          expect(radio(atZero(i), option).closest('label')!.className).toContain('min-h-11')
        }
      })
      const legends = screen.getAllByRole('group', { name: /^At x = / }).map((g) => g.querySelector('legend')!.textContent)
      expect(legends).toEqual(a.zeros.map((_, i) => atZero(i)))
      expect(document.activeElement).toBe(radio(atZero(0), CROSSES))
      // Each part has its own hint ladder: this one starts closed.
      expect(screen.getByRole('button', { name: 'Nudge me' })).toBeTruthy()
      expect(within(hintsPanel()).queryByText(a.stages[0]!.nudge)).toBeNull()

      // One zero left unanswered: not an attempt, and that choice gets the focus.
      fireEvent.click(radio(atZero(0), label(a.zeros[0]!.behavior)))
      fireEvent.click(radio(atZero(2), label(a.zeros[2]!.behavior)))
      click('Check the choices')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain(`Choose crosses or touches for x = ${show(a.zeros[1]!.text)}.`)
      expect(document.activeElement).toBe(radio(atZero(1), CROSSES))
      expect(finals()).toHaveLength(3)

      // The middle zero the wrong way round.
      const wrong = a.zeros[1]!.behavior === 'crosses' ? 'touches' : 'crosses'
      fireEvent.click(radio(atZero(1), label(wrong)))
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check the choices')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_cross_touch_swapped.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_cross_touch_swapped.lesson)
      expect(alert.textContent).toContain(witnessOf(a, 'cross', { ...right, c1: wrong }))
      expect(finals()).toHaveLength(4)
      expect(finals()[3]).toMatchObject({ correct: false, pattern: 'poly_cross_touch_swapped' })
      expect(graph()).toBeNull()
      expect(doneEvent()).toBeUndefined()
      click('Nudge me')
      expect(within(hintsPanel()).getByText(a.stages[1]!.nudge)).toBeTruthy()
      click('Show the rule')
      leadCard('Odd multiplicity crosses, even multiplicity touches')

      fireEvent.click(radio(atZero(1), label(a.zeros[1]!.behavior)))
      click('Check the choices')
      expect(finals()).toHaveLength(5)
      expect(finals()[4]).toMatchObject({ correct: true })
      expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
      for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(screen.getByText(/^Correct: (crosses|touches) at x = /)).toBeTruthy()
      expect(radio(atZero(1), CROSSES).disabled).toBe(true)
      expect(screen.queryByRole('button', { name: 'Check the choices' })).toBeNull()
      // Now the graph: f, drawn by the existing Graph component.
      expect(screen.getByRole('heading', { name: 'The graph of f' })).toBeTruthy()
      expect(graph()!.getAttribute('aria-label')).toBe(`Graph of ${a.f}`)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an empty table, a zero without its multiplicity or an unreadable box is not an attempt: nothing is recorded',
    () => {
      renderAt(path)
      click('Check the zeros')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('Type a zero in the first row, with its multiplicity.')
      expect(field('Zero 1').getAttribute('aria-invalid')).toBe('true')
      expect(document.activeElement).toBe(field('Zero 1'))
      expect(useStore.getState().events).toEqual([])

      // The notice goes as soon as she edits.
      type('Zero 1', rightZeros[0]!)
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check the zeros')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('Zero 1 needs its multiplicity')
      expect(document.activeElement).toBe(field('Multiplicity of zero 1'))
      expect(field('Multiplicity of zero 1').getAttribute('aria-invalid')).toBe('true')
      expect(field('Zero 1').getAttribute('aria-invalid')).toBeNull()

      fillRows(rightZeros, rightMults)
      type('Zero 2', '3)')
      click('Check the zeros')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(document.activeElement).toBe(field('Zero 2'))
      type('Zero 2', rightZeros[1]!)
      type('Multiplicity of zero 3', 'two')
      click('Check the zeros')
      expect(screen.getByRole('alert').textContent).toContain('The multiplicity of zero 3 must be a positive whole number')
      expect(document.activeElement).toBe(field('Multiplicity of zero 3'))
      expect(useStore.getState().events).toEqual([])
      expect(screen.queryByRole('group', { name: atZero(0) })).toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'rows can be added and removed, a reload restores them with the part she had reached, and all right first time is a complete problem',
    () => {
      const view = renderAt(path)
      click('Add another zero')
      // The new row takes the focus.
      expect(document.activeElement).toBe(field('Zero 2'))
      click('Add another zero')
      click('Add another zero')
      type('Zero 1', rightZeros[0]!)
      type('Multiplicity of zero 1', rightMults[0]!)
      type('Zero 2', '99')
      type('Multiplicity of zero 2', '7')
      type('Zero 3', rightZeros[1]!)
      type('Multiplicity of zero 3', rightMults[1]!)
      type('Zero 4', rightZeros[2]!)
      // Taking the stray row out moves the rows below it up.
      click('Remove zero 2')
      expect(screen.queryByLabelText('Zero 4')).toBeNull()
      expect(field('Zero 2').value).toBe(rightZeros[1])
      expect(field('Multiplicity of zero 2').value).toBe(rightMults[1])
      expect(field('Zero 3').value).toBe(rightZeros[2])
      expect(field('Multiplicity of zero 3').value).toBe('')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ rows: '3', z0: rightZeros[0], m0: rightMults[0], z1: rightZeros[1], m1: rightMults[1], z2: rightZeros[2] })

      const again = renderAt(path)
      expect(field('Zero 1').value).toBe(rightZeros[0])
      expect(field('Zero 3').value).toBe(rightZeros[2])
      expect(screen.queryByLabelText('Zero 4')).toBeNull()
      type('Multiplicity of zero 3', rightMults[2]!)
      click('Check the zeros')
      expect(finals()).toMatchObject([{ correct: true }])
      fireEvent.click(radio(atZero(0), label(a.zeros[0]!.behavior)))
      again.unmount()
      expect(useStore.getState().attempt?.final).toMatchObject({ polyStage: 1, polyEntries: { c0: a.zeros[0]!.behavior } })

      renderAt(path)
      expect(screen.getByRole('heading', { name: 'Part 2 of 2: At each zero' })).toBeTruthy()
      expect(field('Zero 2').disabled).toBe(true)
      expect(screen.getByText('The zeros and their multiplicities are right.')).toBeTruthy()
      expect(radio(atZero(0), label(a.zeros[0]!.behavior)).checked).toBe(true)
      expect(radio(atZero(1), CROSSES).checked).toBe(false)
      fireEvent.click(radio(atZero(1), label(a.zeros[1]!.behavior)))
      fireEvent.click(radio(atZero(2), label(a.zeros[2]!.behavior)))
      click('Check the choices')
      expect(finals()).toMatchObject([{ correct: true }, { correct: true }])
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
      expect(graph()).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint rung explains the zeros and marks the attempt as shown; the next part gets a new ladder',
    () => {
      renderAt(path)
      click('Nudge me')
      click('Show the rule')
      click(/^Explain the answer/)
      for (const line of a.stages[0]!.reveal) expect(within(hintsPanel()).getByText(line)).toBeTruthy()
      expect(useStore.getState().attempt?.final).toMatchObject({ revealed: true, firstCorrect: false })
      expect(useStore.getState().attempt?.hintsUsed).toEqual({ '0': 3 })
      // Still no graph: the hint is words, the picture waits.
      expect(graph()).toBeNull()

      passZeros()
      click('Nudge me')
      expect(within(hintsPanel()).getByText(a.stages[1]!.nudge)).toBeTruthy()
      expect(useStore.getState().attempt?.hintsUsed).toEqual({ '0': 3, '1': 1 })
      a.zeros.forEach((z, i) => fireEvent.click(radio(atZero(i), label(z.behavior))))
      click('Check the choices')
      expect(doneEvent()!.revealed).toBeGreaterThan(0)
      expect(doneEvent()!.firstTryRate).toBe(0)
      expect(doneEvent()!.finalCorrect).toBe(true)
    },
    FLOW_TIMEOUT,
  )
})

describe('PolyZerosFlow: end behavior (pz.end)', () => {
  // A negative leading coefficient: ignoring its sign flips both ends.
  const hit = find('pz.end', (a) => a.trap === 'end_sign_ignored' && a.form === 'factored')
  const a = hit.a
  const path = problemPath('polyZeros', 'pz.end', hit.seed)
  const LEFT = 'At the far left (x → −∞), f(x) goes'
  const RIGHT = 'At the far right (x → ∞), f(x) goes'
  const option = (direction: string) => (direction === 'up' ? /^up/ : /^down/)
  const slip = endBehaviorMistakes(a.f)!.find((c) => c.kind === 'end_sign_ignored')!
  const end = a.end!

  it(
    'names the ignored sign, then accepts the right ends and shows the graph; an unanswered end is not an attempt',
    () => {
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      // One part: no "Part 1 of 1". No calculator panel on this question, and no graph yet.
      expect(screen.getByRole('heading', { name: 'The two ends' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: /^Part / })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(graph()).toBeNull()
      for (const group of [LEFT, RIGHT]) {
        for (const o of [/^up/, /^down/]) {
          expect(radio(group, o).checked).toBe(false)
          expect(radio(group, o).closest('label')!.className).toContain('min-h-11')
          expect(radio(group, o).closest('label')!.className).toContain('min-w-11')
        }
      }

      click('Check the ends')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('Choose up (f(x) → ∞) or down (f(x) → −∞) for each end.')
      expect(document.activeElement).toBe(radio(LEFT, /^up/))
      fireEvent.click(radio(LEFT, option(slip.end.left)))
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check the ends')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(document.activeElement).toBe(radio(RIGHT, /^up/))
      expect(useStore.getState().events).toEqual([])

      fireEvent.click(radio(RIGHT, option(slip.end.right)))
      click('Check the ends')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_end_sign_ignored.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_end_sign_ignored.lesson)
      expect(alert.textContent).toContain(slip.witness)
      expect(alert.textContent).toContain('Example:')
      expect(finals()).toMatchObject([{ correct: false, pattern: 'poly_end_sign_ignored', via: 'text' }])
      expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()
      expect(graph()).toBeNull()
      click('Check the ends')
      expect(finals()).toHaveLength(1)
      click('Nudge me')
      expect(within(hintsPanel()).getByText(a.nudge)).toBeTruthy()
      click('Show the rule')
      leadCard('The ends: the degree and the sign decide')

      fireEvent.click(radio(LEFT, option(end.left)))
      fireEvent.click(radio(RIGHT, option(end.right)))
      click('Check the ends')
      expect(finals()).toMatchObject([{ correct: false }, { correct: true }])
      expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(screen.getByText(/^Correct: degree /)).toBeTruthy()
      expect(radio(LEFT, option(end.left)).disabled).toBe(true)
      expect(screen.getByRole('heading', { name: 'The graph of f' })).toBeTruthy()
      expect(screen.getByText(`At the far left it goes ${end.left}; at the far right it goes ${end.right}.`)).toBeTruthy()
      expect(graph()!.getAttribute('aria-label')).toBe(`Graph of ${a.f}`)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores the end she had chosen; right first time is a complete problem',
    () => {
      const view = renderAt(path)
      fireEvent.click(radio(LEFT, option(end.left)))
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ left: end.left })

      renderAt(path)
      expect(radio(LEFT, option(end.left)).checked).toBe(true)
      expect(radio(RIGHT, /^up/).checked).toBe(false)
      expect(radio(RIGHT, /^down/).checked).toBe(false)
      fireEvent.click(radio(RIGHT, option(end.right)))
      click('Check the ends')
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a polynomial in standard form is asked the same way',
    () => {
      const std = find('pz.end', (x) => x.form === 'standard')
      renderAt(problemPath('polyZeros', 'pz.end', std.seed))
      expect(screen.getByText(std.a.prompt)).toBeTruthy()
      fireEvent.click(radio(LEFT, option(std.a.end!.left)))
      fireEvent.click(radio(RIGHT, option(std.a.end!.right)))
      click('Check the ends')
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1 })
      expect(graph()!.getAttribute('aria-label')).toBe(`Graph of ${std.a.f}`)
    },
    FLOW_TIMEOUT,
  )
})

describe('PolyZerosFlow: a polynomial from its zeros (pz.build)', () => {
  const hit = find('pz.build', (a) => a.trap === 'lead_coefficient_omitted')
  const a = hit.a
  const path = problemPath('polyZeros', 'pz.build', hit.seed)
  const slips = polynomialFromZerosMistakes(zerosSpec(a))!
  const omitted = slips.find((c) => c.kind === 'lead_coefficient_omitted')!
  const FORMULA = 'Formula for f(x)'

  it(
    'names the missing number in front, then accepts the formula; an unreadable formula is not an attempt',
    () => {
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      // The statement is the zeros and the point. The formula is the answer.
      for (const z of a.zeros) expect(screen.getByText(`x = ${show(z.text)}, multiplicity ${z.mult}`)).toBeTruthy()
      expect(screen.getByText(`(${show(a.point!.x)}, ${show(a.point!.y)})`, { exact: false })).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Your formula' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(field(FORMULA).className).toContain('min-h-12')
      expect(screen.getByRole('button', { name: 'Check the formula' }).className).toContain('min-h-12')

      click('Check the formula')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('Type your answer first.')
      expect(document.activeElement).toBe(field(FORMULA))
      type(FORMULA, `${a.f.slice(0, -1)}`)
      expect(screen.queryByRole('alert')).toBeNull()
      click('Check the formula')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toEqual([])

      type(FORMULA, omitted.text)
      click('Check the formula')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_lead_coefficient_omitted.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_lead_coefficient_omitted.lesson)
      expect(alert.textContent).toContain(omitted.witness)
      expect(alert.textContent).toContain('Example:')
      expect(finals()).toMatchObject([{ correct: false, pattern: 'poly_lead_coefficient_omitted', via: 'text' }])
      expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()
      click('Check the formula')
      expect(finals()).toHaveLength(1)
      click('Nudge me')
      click('Show the rule')
      leadCard('From zeros to a formula')

      // Another slip, typed the way the engine writes it: its own name and its own card.
      const reversed = slips.find((c) => c.kind === 'zero_sign_reversed')!
      type(FORMULA, reversed.text)
      click('Check the formula')
      expect(screen.getByRole('alert').textContent).toContain(ERROR_PATTERNS.poly_zero_sign_reversed.title)
      expect(finals()).toHaveLength(2)
      leadCard('A zero is where a factor equals 0')

      type(FORMULA, `f(x) = ${a.f}`)
      click('Check the formula')
      expect(finals()).toHaveLength(3)
      expect(finals()[2]).toMatchObject({ correct: true })
      expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(screen.getByText(/^Correct: f\(x\) = /)).toBeTruthy()
      expect(field(FORMULA).disabled).toBe(true)
      expect(screen.queryByRole('button', { name: 'Check the formula' })).toBeNull()
      // No graph on this question, even afterwards.
      expect(graph()).toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores the formula she was typing; the multiplied-out polynomial is accepted first time',
    () => {
      const view = renderAt(path)
      type(FORMULA, '2(x - 1)')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ formula: '2(x - 1)' })

      renderAt(path)
      expect(field(FORMULA).value).toBe('2(x - 1)')
      const b = generateProblem('polyZeros', 'pz.build', hit.seed)
      expect(b.answer.type).toBe('polyZeros')
      // Any formula that multiplies out to the right polynomial: here with the factors in another order.
      const [first, ...rest] = a.f.match(/\([^)]*\)(?:\^\d+)?/g)!
      const lead = a.f.slice(0, a.f.indexOf('('))
      type(FORMULA, `${lead}${rest.join('')}${first}`)
      click('Check the formula')
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})

describe('PolyZerosFlow: rational root candidates (pz.rational)', () => {
  // Three rational zeros, and a list that turning p/q over changes.
  const hit = find('pz.rational', (a, p) => p.params.scenario === 'product' && Boolean(rootCandidateMistakes(a.f)?.some((c) => c.kind === 'rrt_inverted' && c.shadows.length === 0)))
  const a = hit.a
  const path = problemPath('polyZeros', 'pz.rational', hit.seed)
  const inverted = rootCandidateMistakes(a.f)!.find((c) => c.kind === 'rrt_inverted')!
  const zeros = rationalRootCandidates(a.f)!.zeros
  const backwards = zeros.map((z) => ratToString({ n: -z.n, d: z.d })).join(', ')
  const LIST = 'Possible rational zeros'
  const ZEROS = 'Rational zeros of f'

  it(
    'names the list turned upside down, then every sign backwards; each fix moves on; an empty list is not an attempt',
    () => {
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      // How to type ± is said before she starts.
      expect(screen.getByText(/To type plus-or-minus, write \+- in front of a number, as in "\+-1, \+-3"/)).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Part 1 of 2: Possible rational zeros' })).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Calculator' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Show calculator steps' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(screen.queryByLabelText(ZEROS)).toBeNull()
      expect(field(LIST).className).toContain('min-h-12')
      expect(field(LIST).placeholder).toBe('')

      click('Check the list')
      let alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).toContain('Type your list first, with commas between the numbers.')
      expect(field(LIST).getAttribute('aria-invalid')).toBe('true')
      expect(document.activeElement).toBe(field(LIST))
      type(LIST, '+-1, , +-2')
      expect(screen.queryByRole('alert')).toBeNull()
      // What she typed is read back with the ± sign.
      expect(screen.getByText('±1, , ±2')).toBeTruthy()
      click('Check the list')
      expect(screen.getByRole('alert').textContent).toContain('There is an empty place in the list')
      expect(useStore.getState().events).toEqual([])

      type(LIST, inverted.text)
      click('Check the list')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_rrt_inverted.title)
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_rrt_inverted.lesson)
      expect(alert.textContent).toContain(inverted.witness)
      expect(alert.textContent).toContain('Example:')
      expect(finals()).toMatchObject([{ correct: false, pattern: 'poly_rrt_inverted', via: 'text' }])
      expect(screen.queryByRole('region', { name: 'How it works out' })).toBeNull()
      click('Check the list')
      expect(finals()).toHaveLength(1)
      click('Nudge me')
      expect(within(hintsPanel()).getByText(a.stages[0]!.nudge)).toBeTruthy()
      click('Show the rule')
      leadCard('Possible rational zeros are p over q')
      expect(screen.queryByLabelText(ZEROS)).toBeNull()

      type(LIST, a.candidatesText!)
      click('Check the list')
      expect(finals()).toMatchObject([{ correct: false }, { correct: true }])
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByText('The list is complete, with nothing extra.')).toBeTruthy()
      expect(field(LIST).disabled).toBe(true)
      expect(useStore.getState().attempt?.final?.polyStage).toBe(1)

      // Part 2: which of them are zeros.
      expect(screen.getByRole('heading', { name: 'Part 2 of 2: The zeros among them' })).toBeTruthy()
      expect(document.activeElement).toBe(field(ZEROS))
      expect(field(ZEROS).className).toContain('min-h-12')
      click('Check the zeros')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(finals()).toHaveLength(2)

      type(ZEROS, backwards)
      click('Check the zeros')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(ERROR_PATTERNS.poly_zero_sign_reversed.title)
      expect(alert.textContent).toContain(witnessOf(a, 'rational', { rational: backwards }))
      expect(finals()).toHaveLength(3)
      expect(finals()[2]).toMatchObject({ correct: false, pattern: 'poly_zero_sign_reversed' })
      // A new part, a new ladder: its own nudge, and the card for the slip just named.
      click('Nudge me')
      expect(within(hintsPanel()).getByText(a.stages[1]!.nudge)).toBeTruthy()
      click('Show the rule')
      leadCard('A zero is where a factor equals 0')
      expect(doneEvent()).toBeUndefined()

      // One zero short is a plain wrong answer that does not give the missing zero away.
      const most = zeros.slice(0, -1).map(ratToString).join(', ')
      type(ZEROS, most)
      click('Check the zeros')
      alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(`You have ${zeros.length - 1} of the ${zeros.length} rational zeros`)
      expect(finals()).toHaveLength(4)
      expect(finals()[3]!.pattern).toBeUndefined()

      type(ZEROS, a.rationalZerosText!)
      click('Check the zeros')
      expect(finals()).toHaveLength(5)
      expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(field(ZEROS).disabled).toBe(true)
      expect(graph()).toBeNull()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores the list, the part and the zeros she was typing',
    () => {
      const view = renderAt(path)
      type(LIST, a.candidatesText!)
      click('Check the list')
      type(ZEROS, '1, 2')
      view.unmount()
      expect(useStore.getState().attempt?.final).toMatchObject({ polyStage: 1, polyEntries: { candidates: a.candidatesText, rational: '1, 2' } })

      renderAt(path)
      expect(field(LIST).value).toBe(a.candidatesText)
      expect(field(LIST).disabled).toBe(true)
      expect(field(ZEROS).value).toBe('1, 2')
      type(ZEROS, a.rationalZerosText!)
      click('Check the zeros')
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1 })
    },
    FLOW_TIMEOUT,
  )

  it(
    'a cubic with no rational zero is answered with "none"',
    () => {
      const none = find('pz.rational', (x) => x.rationalZerosText === 'none')
      renderAt(problemPath('polyZeros', 'pz.rational', none.seed))
      type(LIST, none.a.candidatesText!)
      click('Check the list')
      type(ZEROS, 'none')
      click('Check the zeros')
      expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1 })
      expect(screen.getByText(/^Correct: none of the \d+ candidates gives 0/)).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})
