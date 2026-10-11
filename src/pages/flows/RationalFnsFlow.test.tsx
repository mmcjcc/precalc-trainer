// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { RF_KEYS, canonicalEntries, gradeRfStage, type RationalFnsAnswer, type RfStageId } from '@/content/modules/rationalFns'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000

const BOX: Record<RfStageId, { label: string; check: string }> = {
  domain: { label: 'Domain', check: 'Check the domain' },
  va: { label: 'Vertical asymptotes', check: 'Check the vertical asymptotes' },
  holes: { label: 'Holes', check: 'Check the holes' },
  asymptote: { label: 'Horizontal or slant asymptote', check: 'Check the asymptote' },
  xint: { label: 'x-intercepts', check: 'Check the x-intercepts' },
  yint: { label: 'y-intercept', check: 'Check the y-intercept' },
  solution: { label: 'Solution set', check: 'Check the solution' },
}

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

function load(templateId: string, seed = 1) {
  const p = generateProblem('rationalFns', templateId, seed)
  if (p.answer.type !== 'rationalFns') throw new Error(`${templateId}: not a rational function`)
  return { p, a: p.answer, path: problemPath('rationalFns', templateId, seed) }
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function field(label: string): HTMLInputElement {
  return screen.getByRole('textbox', { name: label }) as HTMLInputElement
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const graph = () => screen.queryByRole('img', { name: /^Graph of/ })
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

beforeEach(() => {
  resetStoreForTests()
})

function walk(a: RationalFnsAnswer) {
  const right = canonicalEntries(a)
  let seenMistake = false
  for (const stage of a.stages) {
    const box = BOX[stage.id]
    expect(screen.getByRole('heading', { name: a.stages.length > 1 ? new RegExp(box.label) : box.label })).toBeTruthy()
    if (stage.id === a.trapStage) {
      const before = finals().length
      type(box.label, a.trapAnswer)
      click(box.check)
      const alert = screen.getByRole('alert')
      const info = ERROR_PATTERNS[a.trap]
      expect(alert.textContent).toContain(info.title)
      expect(alert.textContent).toContain(info.lesson)
      expect(alert.textContent).toContain('Example:')
      const grade = gradeRfStage(a, stage.id, a.trapAnswer)
      if (grade.verdict !== 'mistake') throw new Error(`trap graded ${grade.verdict}`)
      expect(alert.textContent).toContain(grade.witness)
      expect(finals()).toHaveLength(before + 1)
      expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
      click(box.check)
      expect(finals()).toHaveLength(before + 1)
      expect(graph()).toBeNull()
      expect(doneEvent()).toBeUndefined()
      expect(screen.queryByRole('heading', { name: 'The graph of f' })).toBeNull()
      seenMistake = true
    }
    type(box.label, right[RF_KEYS[stage.id]] ?? '')
    click(box.check)
    expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  }
  expect(seenMistake).toBe(true)
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'The graph of f' })).toBeTruthy()
  expect(graph()).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
}

describe.each([
  ['rf.features', 'Find the domain, the vertical asymptotes, the holes, the horizontal or slant asymptote, the x-intercepts, and the y-intercept of f.'],
  ['rf.asymptote', 'Give the horizontal or slant asymptote of f.'],
  ['rf.equation', 'Solve the equation.'],
] as const)('RationalFnsFlow %s', (templateId, prompt) => {
  it(
    'names the promised mistake, then accepts the fix, records both, and draws the graph only at the end',
    () => {
      const { a, path } = load(templateId)
      renderAt(path)
      expect(screen.getByText(prompt)).toBeTruthy()
      expect(screen.getByText(a.prompt)).toBeTruthy()
      expect(graph()).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'The graph of f' })).toBeNull()
      expect(screen.queryByText(a.reveal[0]!)).toBeNull()
      expect(screen.queryByRole('region', { name: 'Worked explanation' })).toBeNull()
      if (templateId === 'rf.features') {
        expect(screen.queryByRole('heading', { name: /x-intercepts/ })).toBeNull()
        click('Nudge me')
        expect(screen.getByText(a.stages[0]!.nudge)).toBeTruthy()
        expect(screen.queryByText(a.reveal[0]!)).toBeNull()
        click('Show the rule')
        expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
        expect(screen.queryByText(a.reveal[0]!)).toBeNull()
      }
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer records nothing',
    () => {
      const { a, path } = load(templateId)
      const box = BOX[a.stages[0]!.id]
      renderAt(path)
      click(box.check)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(field(box.label).getAttribute('aria-invalid')).toBe('true')
      expect(useStore.getState().events).toEqual([])
      type(box.label, '???')
      expect(screen.queryByRole('alert')).toBeNull()
      click(box.check)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toEqual([])
      expect(graph()).toBeNull()
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores the entry, and the graph is still hidden',
    () => {
      const { a, path } = load(templateId)
      const box = BOX[a.stages[0]!.id]
      const key = RF_KEYS[a.stages[0]!.id]
      const view = renderAt(path)
      type(box.label, 'not yet')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [key]: 'not yet' })
      const again = renderAt(path)
      expect(field(box.label).value).toBe('not yet')
      expect(graph()).toBeNull()
      if (a.stages.length > 1) {
        const right = canonicalEntries(a)
        type(box.label, right[key] ?? '')
        click(box.check)
        again.unmount()
        expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
        renderAt(path)
        expect(field(box.label).value).toBe(right[key])
        expect(field(box.label).disabled).toBe(true)
        expect(field(BOX[a.stages[1]!.id].label).value).toBe('')
        expect(graph()).toBeNull()
        expect(screen.queryByRole('heading', { name: /Part 3 of/ })).toBeNull()
      }
    },
    FLOW_TIMEOUT,
  )
})

describe('RationalFnsFlow hints', () => {
  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('rf.asymptote', 2)
      renderAt(path)
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      click('Nudge me')
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final?.revealed).toBe(true)
      expect(useStore.getState().attempt?.final?.firstCorrect).toBe(false)
      for (const line of a.stages[0]!.reveal) expect(screen.getByText(line)).toBeTruthy()
      expect(graph()).toBeNull()
      expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toEqual([])
    },
    FLOW_TIMEOUT,
  )
})
