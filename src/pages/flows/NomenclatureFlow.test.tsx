// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { NmStage, NomenclatureAnswer } from '@/content/types'
import { gradeNmStage, NM_KEYS, NM_TEMPLATES, nmShown } from '@/content/modules/nomenclature'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

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

interface Loaded {
  a: NomenclatureAnswer
  path: string
  seed: number
}

function load(moduleId: string, templateId: string, seed = 1): Loaded {
  const p = generateProblem(moduleId as never, templateId, seed)
  if (p.answer.type !== 'nomenclature') throw new Error(`${templateId}: not nomenclature`)
  return { a: p.answer, path: problemPath(moduleId as never, templateId, seed), seed }
}

/** The first seed whose problem matches (problems are drawn from the seed, so the tests look for one). */
function loadWhere(moduleId: string, templateId: string, match: (a: NomenclatureAnswer) => boolean, max = 600): Loaded {
  for (let seed = 1; seed <= max; seed++) {
    const loaded = load(moduleId, templateId, seed)
    if (match(loaded.a)) return loaded
  }
  throw new Error(`${templateId}: no seed up to ${max} matches`)
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined

function heading(a: NomenclatureAnswer, index: number): string {
  const stage = a.stages[index]!
  return a.stages.length > 1 ? `Part ${index + 1} of ${a.stages.length}: ${stage.label}` : stage.label
}

const checkName = (stage: NmStage) => `Check ${stage.label.toLowerCase()}`

function field(stage: NmStage): HTMLInputElement {
  return screen.getByRole('textbox', { name: stage.label }) as HTMLInputElement
}

function enter(stage: NmStage, value: string) {
  if (stage.kind === 'choice') {
    const text = stage.choices?.find((c) => c.id === value)?.text ?? value
    fireEvent.click(screen.getByRole('radio', { name: (name) => name === text }))
  } else fireEvent.change(field(stage), { target: { value } })
}

function check(stage: NmStage) {
  fireEvent.click(screen.getByRole('button', { name: checkName(stage) }))
}

beforeEach(() => {
  resetStoreForTests()
})

/** Answer every part; at the promised part, first the promised slip, then the fix. */
function walk(a: NomenclatureAnswer) {
  for (let i = 0; i < a.stages.length; i++) {
    const stage = a.stages[i]!
    expect(screen.getByRole('heading', { name: heading(a, i) })).toBeTruthy()
    if (stage.id === a.trapStage && a.trap && a.trapAnswer !== undefined) {
      const before = finals().length
      enter(stage, a.trapAnswer)
      check(stage)
      const alert = screen.getByRole('alert')
      const shown = nmShown(stage, gradeNmStage(a, stage.id, a.trapAnswer), a.trapAnswer)
      if (shown.kind !== 'mistake') throw new Error('the promised trap is not shown as a mistake')
      expect(alert.textContent).toContain(shown.title)
      expect(alert.textContent).toContain(shown.witness)
      if (shown.lesson) expect(alert.textContent).toContain(shown.lesson)
      if (shown.example) expect(alert.textContent).toContain('Example:')
      expect(finals()).toHaveLength(before + 1)
      expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
      // The same answer checked again is not a second attempt.
      check(stage)
      expect(finals()).toHaveLength(before + 1)
      expect(doneEvent()).toBeUndefined()
    }
    enter(stage, stage.answerText)
    check(stage)
  }
  expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  expect(screen.getByRole('heading', { name: /Problem (finished|complete)/ })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getAllByText(line).length).toBeGreaterThan(0)
}

describe.each(NM_TEMPLATES)('NomenclatureFlow $templateId', ({ moduleId, templateId }) => {
  it(
    'names the promised mistake, then accepts the fix, records both and completes',
    () => {
      const { a, path } = loadWhere(moduleId, templateId, (x) => Boolean(x.trap))
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      for (const stage of a.stages) for (const line of stage.reveal) expect(screen.queryByText(line)).toBeNull()
      walk(a)
      expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer, or a capital-letter slip, records nothing',
    () => {
      const { a, path } = load(moduleId, templateId)
      renderAt(path)
      const stage = a.stages[0]!
      check(stage)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      if (stage.kind !== 'choice') {
        expect(field(stage).getAttribute('aria-invalid')).toBe('true')
        enter(stage, '???')
        expect(screen.queryByRole('alert')).toBeNull()
        check(stage)
        expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
        if (stage.kind !== 'name') {
          enter(stage, stage.answerText.toLowerCase())
          check(stage)
          expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
          expect(screen.getByRole('alert').textContent).toMatch(/capital|lowercase/)
        }
      }
      expect(useStore.getState().events).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries',
    () => {
      const { a, path } = load(moduleId, templateId)
      const stage = a.stages[0]!
      const view = renderAt(path)
      if (stage.kind === 'choice') {
        enter(stage, 'hydrate')
        view.unmount()
        expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [NM_KEYS[stage.id]]: 'hydrate' })
        renderAt(path)
        expect((screen.getByRole('radio', { name: (n) => n === 'hydrate' }) as HTMLInputElement).checked).toBe(true)
      } else {
        enter(stage, 'not yet')
        view.unmount()
        expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [NM_KEYS[stage.id]]: 'not yet' })
        renderAt(path)
        expect(field(stage).value).toBe('not yet')
      }
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('NomenclatureFlow screen', () => {
  it(
    'draws a formula as she types it, and points at a capital-letter slip without counting it',
    () => {
      const { a, path } = loadWhere('ionicNames', 'nm.ionicFromName', (x) => /\(/.test(x.stages[0]!.answerText))
      renderAt(path)
      const stage = a.stages[0]!
      expect(screen.getByText(/What you type shows here/)).toBeTruthy()
      enter(stage, stage.answerText)
      const reads = document.getElementById(`nm-${stage.id}-reads`)!
      expect(reads.textContent).toMatch(/reads as/)
      expect(within(reads).getByLabelText(/₂|₃|₄/)).toBeTruthy()
      const lower = stage.answerText.charAt(0).toLowerCase() + stage.answerText.slice(1)
      enter(stage, lower)
      check(stage)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      const mark = document.querySelector('mark')
      expect(mark?.textContent).toBe(lower.charAt(0))
      expect(useStore.getState().events).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'a note about her text never names the answer: the case note’s “CO is carbon and oxygen” is not shown for carbon monoxide',
    () => {
      const { a, path } = loadWhere('molecularAcids', 'nm.molecular', (x) => x.stages[0]!.answerText === 'CO', 3000)
      renderAt(path)
      const stage = a.stages[0]!
      enter(stage, 'co')
      const reads = document.getElementById(`nm-${stage.id}-reads`)!
      expect(reads.textContent).toMatch(/capital/)
      expect(reads.textContent).not.toMatch(/\bCO\b/)
      check(stage)
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(NOT_AN_ATTEMPT)
      expect(alert.textContent).not.toMatch(/\bCO\b/)
      expect(useStore.getState().events).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'grades on screen every spelling the engine accepts',
    () => {
      const cases: { moduleId: string; templateId: string; match: (a: NomenclatureAnswer) => boolean; typed: (a: NomenclatureAnswer) => string }[] = [
        { moduleId: 'ionicNames', templateId: 'nm.ionicName', match: (a) => /aluminum/.test(a.stages[0]!.answerText), typed: (a) => a.stages[0]!.answerText.replace('aluminum', 'aluminium').toUpperCase() },
        { moduleId: 'ionicNames', templateId: 'nm.ionicName', match: (a) => /sulf/.test(a.stages[0]!.answerText), typed: (a) => a.stages[0]!.answerText.replace(/sulf/g, 'sulph') },
        { moduleId: 'ionicNames', templateId: 'nm.ionicName', match: (a) => /hydrogen carbonate/.test(a.stages[0]!.answerText), typed: (a) => a.stages[0]!.answerText.replace('hydrogen carbonate', 'bicarbonate') },
        { moduleId: 'ionicNames', templateId: 'nm.ionicName', match: (a) => /^nickel\(II\)/.test(a.stages[0]!.answerText), typed: (a) => a.stages[0]!.answerText.replace('nickel(II)', 'nickel') },
        { moduleId: 'ionicNames', templateId: 'nm.ionicName', match: (a) => /\(I+V?\)/.test(a.stages[0]!.answerText), typed: (a) => a.stages[0]!.answerText.replace('(', ' ( ') },
        { moduleId: 'molecularAcids', templateId: 'nm.molecular', match: (a) => a.stages[0]!.answerText.endsWith('monoxide'), typed: (a) => a.stages[0]!.answerText.replace('monoxide', 'monooxide') },
        { moduleId: 'molecularAcids', templateId: 'nm.molecular', match: (a) => a.stages[0]!.answerText.endsWith('pentoxide'), typed: (a) => a.stages[0]!.answerText.replace('pentoxide', 'pentaoxide') },
        { moduleId: 'molecularAcids', templateId: 'nm.acid', match: (a) => a.stages[0]!.answerText === 'HCl(aq)', typed: () => 'HCl' },
        { moduleId: 'molecularAcids', templateId: 'nm.acid', match: (a) => /\(aq\)$/.test(a.stages[0]!.answerText) && a.given === 'name', typed: (a) => a.stages[0]!.answerText },
        { moduleId: 'molecularAcids', templateId: 'nm.hydrate', match: (a) => a.stages[0]!.kind === 'formula', typed: (a) => a.stages[0]!.answerText.replace('·', '*') },
        { moduleId: 'molecularAcids', templateId: 'nm.hydrate', match: (a) => a.stages[0]!.kind === 'formula', typed: (a) => a.stages[0]!.answerText.replace('·', '.') },
        { moduleId: 'ionicNames', templateId: 'nm.ion', match: (a) => a.stages[0]!.answerText === 'SO4^2-', typed: () => 'SO4 2-' },
        { moduleId: 'ionicNames', templateId: 'nm.ion', match: (a) => a.stages[0]!.answerText === 'SO4^2-', typed: () => 'SO42-' },
      ]
      for (const c of cases) {
        resetStoreForTests()
        const { a, path } = loadWhere(c.moduleId, c.templateId, c.match, 2000)
        const view = renderAt(path)
        const stage = a.stages[0]!
        const typed = c.typed(a)
        enter(stage, typed)
        check(stage)
        expect(finals().at(-1), `${c.templateId} ${typed}`).toMatchObject({ correct: true })
        expect(screen.getByRole('heading', { name: /Problem (finished|complete)/ }), typed).toBeTruthy()
        view.unmount()
      }
    },
    FLOW_TIMEOUT,
  )

  it(
    'a finished first part stays after a reload, and the next part is open',
    () => {
      const { a, path } = loadWhere('ionicNames', 'nm.ionicFormula', (x) => x.stages.length === 3)
      const view = renderAt(path)
      const first = a.stages[0]!
      enter(first, first.answerText)
      check(first)
      expect(screen.getByRole('heading', { name: heading(a, 1) })).toBeTruthy()
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
      renderAt(path)
      expect(screen.getByRole('heading', { name: heading(a, 0) }).closest('section')?.textContent).toMatch(/Correct/)
      expect(field(a.stages[1]!).value).toBe('')
      expect(screen.getByRole('heading', { name: heading(a, 1) })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint shows the worked explanation and marks the answer shown; the ion table opens',
    () => {
      const { a, path } = load('molecularAcids', 'nm.acid', 2)
      renderAt(path)
      const stage = a.stages[0]!
      for (const line of stage.reveal) expect(screen.queryByText(line)).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Nudge me' }))
      expect(screen.getByText(stage.nudge)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Show the rule' }))
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      fireEvent.click(screen.getByRole('button', { name: /Explain the answer/ }))
      expect(useStore.getState().attempt?.final?.revealed).toBe(true)
      expect(useStore.getState().attempt?.final?.firstCorrect).toBe(false)
      for (const line of stage.reveal) expect(screen.getAllByText(line).length).toBeGreaterThan(0)
      expect(finals()).toEqual([])
      const table = screen.getByText('Polyatomic ion table').closest('details')!
      fireEvent.click(screen.getByText('Polyatomic ion table'))
      expect(within(table).getByText('sulfate')).toBeTruthy()
      expect(within(table).getByText('SO₄²⁻')).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})
