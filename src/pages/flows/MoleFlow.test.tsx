// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { MoleAnswer, MoStage } from '@/content/types'
import { gradeMoStage, MO_KEYS, splitNumeral, stageLeaks } from '@/content/modules/moles'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const TEMPLATES: [ 'moles' | 'chemFormulas', string][] = [
  ['moles', 'mo.particles'],
  ['moles', 'mo.molarMass'],
  ['moles', 'mo.mass'],
  ['moles', 'mo.gas'],
  ['chemFormulas', 'cf.percent'],
  ['chemFormulas', 'cf.empirical'],
  ['chemFormulas', 'cf.molecular'],
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

function load(moduleId: 'moles' | 'chemFormulas', templateId: string, seed = 1) {
  const p = generateProblem(moduleId, templateId, seed)
  if (p.answer.type !== 'mole') throw new Error(`${templateId}: not a mole problem`)
  return { a: p.answer, path: problemPath(moduleId, templateId, seed) }
}

function loadTrapped(moduleId: 'moles' | 'chemFormulas', templateId: string) {
  for (let seed = 1; seed <= 40; seed++) {
    const loaded = load(moduleId, templateId, seed)
    if (loaded.a.trap) return loaded
  }
  throw new Error(`${templateId}: no promised trap in the first 40 seeds`)
}

function textbox(name: string): HTMLInputElement {
  return screen.getByRole('textbox', { name }) as HTMLInputElement
}

function radio(name: string): HTMLInputElement {
  return screen.getByRole('radio', { name: (text) => text === name }) as HTMLInputElement
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

/** Put a value into the open part the way she would: a button, the number boxes, one box, or a box per symbol. */
function enter(stage: MoStage, value: string) {
  if (stage.kind === 'choice') {
    fireEvent.click(radio(stage.choices!.find((c) => c.id === value)!.text))
  } else if (stage.kind === 'number') {
    const { coefficient, power } = splitNumeral(value)
    fireEvent.change(textbox('Your answer'), { target: { value: coefficient } })
    fireEvent.change(textbox('Power of ten'), { target: { value: power } })
  } else if (stage.kind === 'whole') {
    fireEvent.change(textbox(stage.label), { target: { value } })
  } else {
    for (const pair of value.split(';')) {
      const [symbol, n] = pair.split('=')
      fireEvent.change(textbox(`${stage.label}: ${symbol}`), { target: { value: n } })
    }
  }
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

beforeEach(() => {
  resetStoreForTests()
})

function heading(a: MoleAnswer, index: number): string {
  const stage = a.stages[index]!
  return a.stages.length > 1 ? `Part ${index + 1} of ${a.stages.length}: ${stage.label}` : stage.label
}

function walk(a: MoleAnswer) {
  const trapAt = a.stages.findIndex((stage) => stage.id === a.trapStage)
  for (let i = 0; i < a.stages.length; i++) {
    const stage = a.stages[i]!
    expect(screen.getByRole('heading', { name: heading(a, i) })).toBeTruthy()
    const checkName = `Check ${stage.label}`
    if (i === trapAt && a.trap && a.trapAnswer) {
      const before = finals().length
      enter(stage, a.trapAnswer)
      click(checkName)
      const alert = screen.getByRole('alert')
      const info = ERROR_PATTERNS[a.trap]
      expect(alert.textContent).toContain(info.title)
      expect(alert.textContent).toContain(info.lesson)
      const grade = gradeMoStage(a, stage.id, a.trapAnswer)
      if (grade.verdict !== 'mistake') throw new Error(`trap graded ${grade.verdict}`)
      expect(alert.textContent).toContain(grade.witness)
      // The card never shows this part's answer (an example that would is blanked).
      expect(stageLeaks(stage, alert.textContent ?? '')).toBe(false)
      expect(finals()).toHaveLength(before + 1)
      expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
      click(checkName)
      expect(finals()).toHaveLength(before + 1)
      expect(doneEvent()).toBeUndefined()
    }
    enter(stage, stage.answerText)
    click(checkName)
  }
  expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'The answer, worked out' })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
}

describe.each(TEMPLATES)('MoleFlow %s %s', (moduleId, templateId) => {
  it(
    'names the promised mistake, then accepts the fix and completes',
    () => {
      const { a, path } = loadTrapped(moduleId, templateId)
      renderAt(path)
      expect(screen.getByText(a.prompt)).toBeTruthy()
      for (const stage of a.stages) expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable answer records nothing',
    () => {
      const { a, path } = load(moduleId, templateId)
      renderAt(path)
      const stage = a.stages[0]!
      click(`Check ${stage.label}`)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      if (stage.kind === 'number') {
        enter(stage, 'about twelve')
        expect(screen.queryByRole('alert')).toBeNull()
        click(`Check ${stage.label}`)
        expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
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
      const key = MO_KEYS[stage.id]
      const view = renderAt(path)
      if (stage.kind === 'choice') {
        const choice = stage.choices![0]!
        enter(stage, choice.id)
        view.unmount()
        expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [key]: choice.id })
        renderAt(path)
        expect(radio(choice.text).checked).toBe(true)
      } else if (stage.kind === 'number') {
        enter(stage, '4.56 x 10^7')
        view.unmount()
        expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [key]: '4.56', [`${key}^`]: '7' })
        renderAt(path)
        expect(textbox('Your answer').value).toBe('4.56')
        expect(textbox('Power of ten').value).toBe('7')
      } else {
        enter(stage, stage.kind === 'whole' ? '9' : (stage.symbols ?? []).map((s) => `${s}=9`).join(';'))
        view.unmount()
        renderAt(path)
        const first = stage.kind === 'whole' ? textbox(stage.label) : textbox(`${stage.label}: ${stage.symbols![0]}`)
        expect(first.value).toBe('9')
      }
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('MoleFlow parts and hints', () => {
  it(
    'a finished first part is still there after a reload, and the next part is open',
    () => {
      const { a, path } = load('moles', 'mo.molarMass', 1)
      const first = a.stages[0]!
      const view = renderAt(path)
      enter(first, first.answerText)
      click(`Check ${first.label}`)
      expect(screen.getByRole('heading', { name: heading(a, 1) })).toBeTruthy()
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyStage).toBe(1)
      renderAt(path)
      expect(document.querySelector('[data-mo-entry="a"]')?.textContent).toContain(first.answerText)
      expect(screen.getByRole('heading', { name: heading(a, 1) })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('chemFormulas', 'cf.empirical', 2)
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

  it(
    'a right value with the wrong figures gets the sig-fig engine’s own slip, recorded under its sf_ id',
    () => {
      const { a, path } = load('moles', 'mo.mass', 3)
      renderAt(path)
      const stage = a.stages[0]!
      const { coefficient, power } = splitNumeral(stage.answerText)
      // One more digit than the measurements support: the same value, held to the wrong figures.
      const longer = coefficient.includes('.') ? `${coefficient}0` : `${coefficient}.0`
      enter(stage, power ? `${longer} x 10^${power}` : longer)
      click(`Check ${stage.label}`)
      const last = finals().at(-1)
      expect(last?.correct).toBe(false)
      if (last?.pattern) expect(String(last.pattern).startsWith('sf_')).toBe(true)
    },
    FLOW_TIMEOUT,
  )
})
