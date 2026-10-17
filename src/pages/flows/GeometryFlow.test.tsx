// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { GEO_KEYS, canonicalEntries, gradeGeoStage, type GeometryAnswer } from '@/content/modules/geometry'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import type { ModuleId } from '@/shared/types'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000

const TEMPLATES: readonly (readonly [ModuleId, string])[] = [
  ['geoSegments', 'gs.addition'],
  ['geoSegments', 'gs.midpoint'],
  ['geoSegments', 'gs.coord'],
  ['geoAngles', 'ga.addition'],
  ['geoAngles', 'ga.bisector'],
  ['geoAngles', 'ga.pairs'],
  ['geoAngles', 'ga.words'],
]

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

function load(moduleId: ModuleId, templateId: string, seed = 1) {
  const p = generateProblem(moduleId, templateId, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${templateId}: not geometry`)
  return { p, a: p.answer, path: problemPath(moduleId, templateId, seed) }
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
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

beforeEach(() => {
  resetStoreForTests()
})

function walk(a: GeometryAnswer) {
  const right = canonicalEntries(a)
  const trapAt = a.stages.findIndex((s) => s.id === a.trapStage)
  for (let i = 0; i < a.stages.length; i++) {
    const stage = a.stages[i]!
    const heading = a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${stage.label}` : stage.label
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    const checkName = `Check ${stage.label}`
    if (i === trapAt) {
      const before = finals().length
      type(stage.label, a.trapAnswer)
      click(checkName)
      const alert = screen.getByRole('alert')
      const info = ERROR_PATTERNS[a.trap]
      expect(alert.textContent).toContain(info.title)
      expect(alert.textContent).toContain(info.lesson)
      expect(alert.textContent).toContain('Example:')
      const grade = gradeGeoStage(a, stage.id, a.trapAnswer)
      if (grade.verdict !== 'mistake') throw new Error(`trap graded ${grade.verdict}`)
      expect(alert.textContent).toContain(grade.witness)
      expect(finals()).toHaveLength(before + 1)
      expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
      click(checkName)
      expect(finals()).toHaveLength(before + 1)
      expect(doneEvent()).toBeUndefined()
      type(stage.label, right[GEO_KEYS[stage.id]] ?? '')
      click(checkName)
    } else {
      type(stage.label, right[GEO_KEYS[stage.id]] ?? '')
      click(checkName)
    }
  }
  expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
}

describe.each(TEMPLATES)('GeometryFlow %s/%s', (moduleId, templateId) => {
  it(
    'shows the figure first, names the promised mistake, then accepts the fix',
    () => {
      const { a, path } = load(moduleId, templateId)
      renderAt(path)
      const figure = screen.getByRole('img', { name: a.figure.ariaLabel })
      expect(screen.getByText(a.prompt)).toBeTruthy()
      for (const stage of a.stages) {
        expect(figure.textContent ?? '').not.toContain(stage.answerText)
        expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
      }
      expect(screen.queryByRole('button', { name: 'Show the graph' })).toBeNull()
      if (a.stages.length === 1) expect(screen.queryByText(/Part 1 of 1/)).toBeNull()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer records nothing',
    () => {
      const { a, path } = load(moduleId, templateId)
      renderAt(path)
      const label = a.stages[0]!.label
      const checkName = `Check ${label}`
      click(checkName)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(field(label).getAttribute('aria-invalid')).toBe('true')
      expect(useStore.getState().events).toEqual([])
      type(label, '???')
      expect(screen.queryByRole('alert')).toBeNull()
      click(checkName)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      type(label, '√45')
      click(checkName)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries',
    () => {
      const { a, path } = load(moduleId, templateId)
      const view = renderAt(path)
      const label = a.stages[0]!.label
      type(label, 'not yet')
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [GEO_KEYS[a.stages[0]!.id]]: 'not yet' })
      renderAt(path)
      expect(field(label).value).toBe('not yet')
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('GeometryFlow parts and hints', () => {
  it(
    'a finished first part is still there after a reload, and the next part is open',
    () => {
      const { a, path } = load('geoSegments', 'gs.addition', 1)
      const view = renderAt(path)
      type('x', a.stages[0]!.answerText)
      click('Check x')
      expect(screen.getByRole('heading', { name: 'Part 2 of 2: AB' })).toBeTruthy()
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
      renderAt(path)
      expect(field('x').value).toBe('6')
      expect(field('AB').value).toBe('')
      expect(screen.getByRole('heading', { name: 'Part 2 of 2: AB' })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('geoSegments', 'gs.addition', 2)
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
      expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toEqual([])
    },
    FLOW_TIMEOUT,
  )
})

describe('a mistake card’s example is never this part’s answer', () => {
  it(
    'seed 1 of segment addition: the slip x = 19 is named, with an example from another problem',
    async () => {
      const { a, path } = load('geoSegments', 'gs.addition', 1)
      expect(a.stages[0]!.answerText).toBe('6')
      const pattern = ERROR_PATTERNS.geo_part_equals_whole
      renderAt(path)
      await screen.findByRole('heading', { name: 'Part 1 of 2: x' })
      type('x', '19')
      click('Check x')
      expect(await screen.findByText(pattern.title, { exact: false })).toBeTruthy()
      // The example is shown, and nothing on the page states x = 6.
      expect(document.body.textContent).toContain('35/6')
      expect(document.body.textContent).not.toMatch(/x\s*=\s*6(?![\d/])/)
    },
    FLOW_TIMEOUT,
  )
})
