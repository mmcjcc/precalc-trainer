// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { gradeEgPart } from '@/content/modules/expLogGraphs'
import { gradeEmPart } from '@/content/modules/expModels'
import { anyShows } from '@/content/modules/explog/text'
import type { ExpLogPart, ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

type Module = 'expLogGraphs' | 'expModels'

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

function load(module: Module, templateId: string, seed = 1) {
  const p = generateProblem(module, templateId, seed)
  if (p.answer.type !== 'expLogGraphs' && p.answer.type !== 'expModels') throw new Error(`${templateId}: not a second-half problem`)
  return { p, a: p.answer, path: problemPath(module, templateId, seed) }
}

function grade(p: ProblemInstance, stage: string, text: string) {
  if (p.answer.type === 'expLogGraphs') return gradeEgPart(p.answer, stage, text)
  if (p.answer.type === 'expModels') return gradeEmPart(p.answer, stage, text)
  throw new Error('not a second-half problem')
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const field = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLInputElement

/** Type into a box, or pick a radio for a choice part. */
function enter(part: ExpLogPart, value: string) {
  if (part.kind === 'choice') {
    const label = part.choices?.find((c) => c.value === value)?.label ?? value
    fireEvent.click(screen.getByRole('radio', { name: label }))
  } else {
    fireEvent.change(field(part.label), { target: { value } })
  }
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const formulaGraph = () => screen.queryAllByRole('img', { name: /^Graph of/ })

beforeEach(() => {
  resetStoreForTests()
})

const TEMPLATES = [
  ['expLogGraphs', 'eg.features'],
  ['expLogGraphs', 'eg.match'],
  ['expLogGraphs', 'eg.inverse'],
  ['expModels', 'em.interest'],
  ['expModels', 'em.halflife'],
  ['expModels', 'em.growth'],
] as const

describe.each(TEMPLATES)('%s %s on the screen', (module, templateId) => {
  it(
    'names the promised mistake, then takes the fix, records both, and completes',
    () => {
      const { p, a, path } = load(module, templateId)
      renderAt(path)
      expect(screen.getByText(p.instructions)).toBeTruthy()
      expect(screen.getAllByText(a.prompt).length).toBeGreaterThan(0)
      expect(screen.queryByRole('heading', { name: 'The answer, worked out' })).toBeNull()
      if (a.type === 'expLogGraphs' && a.question === 'match' && a.matchMode === 'graph') {
        // The four graphs are the question, so they are on screen, but none announces its formula.
        for (const l of ['A', 'B', 'C', 'D']) expect(screen.getByRole('img', { name: `Graph ${l}` })).toBeTruthy()
      }
      expect(formulaGraph(), 'no graph of f before she finishes').toEqual([])
      let named = false
      for (const [i, part] of a.stages.entries()) {
        expect(screen.getByRole('heading', { name: a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${part.label}` : part.label })).toBeTruthy()
        // The next part is not on the page yet.
        const next = a.stages[i + 1]
        if (next) expect(screen.queryByRole('heading', { name: new RegExp(`^Part ${i + 2} of`) })).toBeNull()
        if (part.id === a.trapStage) {
          const before = finals().length
          enter(part, a.trapAnswer)
          click('Check')
          const alert = screen.getByRole('alert')
          const info = ERROR_PATTERNS[a.trap]
          expect(alert.textContent).toContain(info.title)
          expect(alert.textContent).toContain(info.lesson)
          expect(alert.textContent).toContain('Example:')
          const g = grade(p, part.id, a.trapAnswer)
          if (g.verdict !== 'mistake') throw new Error(`trap graded ${g.verdict}`)
          expect(alert.textContent).toContain(g.witness)
          if (part.kind !== 'choice') expect(anyShows([alert.textContent ?? ''], [part.answerText]), 'the note names the answer').toBe(false)
          expect(finals()).toHaveLength(before + 1)
          expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
          // The same answer again is the same attempt.
          click('Check')
          expect(finals()).toHaveLength(before + 1)
          expect(doneEvent()).toBeUndefined()
          named = true
        }
        enter(part, part.answerText)
        click('Check')
        expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
      }
      expect(named).toBe(true)
      expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
      for (const line of a.reveal) expect(screen.getAllByText(line).length).toBeGreaterThan(0)
      if (a.type === 'expLogGraphs' && a.question !== 'match') expect(formulaGraph().length, 'the graph of f, once she is done').toBeGreaterThan(0)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer records nothing',
    () => {
      const { a, path } = load(module, templateId)
      const part = a.stages[0]!
      renderAt(path)
      click('Check')
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toEqual([])
      if (part.kind !== 'choice') {
        expect(field(part.label).getAttribute('aria-invalid')).toBe('true')
        fireEvent.change(field(part.label), { target: { value: '???' } })
        expect(screen.queryByRole('alert')).toBeNull()
        click('Check')
        expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      }
      expect(useStore.getState().events).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries and the part she is on',
    () => {
      const { a, path } = load(module, templateId)
      const part = a.stages[0]!
      const view = renderAt(path)
      const draft = part.kind === 'choice' ? part.choices![0]!.value : 'not yet'
      enter(part, draft)
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [part.id]: draft })
      const again = renderAt(path)
      if (part.kind === 'choice') expect((screen.getByRole('radio', { name: part.choices![0]!.label }) as HTMLInputElement).checked).toBe(true)
      else expect(field(part.label).value).toBe(draft)
      const second = a.stages[1]
      if (second) {
        enter(part, part.answerText)
        click('Check')
        again.unmount()
        expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
        renderAt(path)
        if (part.kind !== 'choice') {
          expect(field(part.label).value).toBe(part.answerText)
          expect(field(part.label).disabled).toBe(true)
        }
        if (second.kind !== 'choice') expect(field(second.label).value).toBe('')
        expect(screen.queryByRole('heading', { name: /^Part 3 of/ })).toBeNull()
      }
      expect(formulaGraph()).toEqual([])
    },
    FLOW_TIMEOUT,
  )
})

describe('hints on these screens', () => {
  it(
    'the first two rungs never show the answer; the third shows it and marks it shown',
    () => {
      const { a, path } = load('expModels', 'em.interest', 2)
      const part = a.stages[0]!
      renderAt(path)
      const hints = () => screen.getByRole('heading', { name: 'Hints' }).closest('section')!
      click('Nudge me')
      expect(screen.getByText(part.nudge)).toBeTruthy()
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(anyShows([hints().textContent ?? ''], [part.answerText, part.answerText.replace(/,/g, '')])).toBe(false)
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final).toMatchObject({ revealed: true, firstCorrect: false })
      for (const line of part.reveal) expect(screen.getAllByText(line).length).toBeGreaterThan(0)
      expect(finals()).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'a features problem has its own ladder per part: the domain nudge, then the range nudge',
    () => {
      const { a, path } = load('expLogGraphs', 'eg.features', 2)
      renderAt(path)
      click('Nudge me')
      expect(screen.getByText(a.stages[0]!.nudge)).toBeTruthy()
      enter(a.stages[0]!, a.stages[0]!.answerText)
      click('Check')
      expect(screen.queryByText(a.stages[0]!.nudge)).toBeNull()
      click('Nudge me')
      expect(screen.getByText(a.stages[1]!.nudge)).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})
