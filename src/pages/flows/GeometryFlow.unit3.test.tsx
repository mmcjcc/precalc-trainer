// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { GEO_KEYS, canonicalEntries, type GeometryAnswer } from '@/content/modules/geometry'
import { stageDisplay } from '@/content/modules/geometry/grade'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import type { ModuleId } from '@/shared/types'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

const TEMPLATES: readonly (readonly [ModuleId, string])[] = [
  ['geoParallel', 'gl3.pairs'],
  ['geoParallel', 'gl3.solve'],
  ['geoParallel', 'gl3.converse'],
  ['geoParallel', 'gl3.slopes'],
  ['geoPolygonAngles', 'gpa.triangle'],
  ['geoPolygonAngles', 'gpa.polygon'],
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

function exactText(text: string) {
  const want = text.replace(/\s+/g, ' ').trim()
  return (content: string) => content === want
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
type EvOf<T extends string> = Extract<ReturnType<typeof events>[number], { t: T }>
const finals = () => events('final_answer') as EvOf<'final_answer'>[]
const doneEvent = () => events('problem_done')[0] as EvOf<'problem_done'> | undefined

function openRegion(): HTMLElement {
  const regions = screen.getAllByRole('region')
  return regions[regions.length - 1]!
}

function enter(stage: GeometryAnswer['stages'][number], value: string) {
  const region = openRegion()
  if (stage.kind === 'choice') {
    const text = stage.choices?.find((choice) => choice.id === value)?.text ?? value
    fireEvent.click(within(region).getByRole('radio', { name: text }))
    return
  }
  fireEvent.change(within(region).getByRole('textbox', { name: stage.label }), { target: { value } })
}

function walk(a: GeometryAnswer) {
  const right = canonicalEntries(a)
  const trapAt = a.stages.findIndex((stage) => stage.id === a.trapStage)
  for (let i = 0; i < a.stages.length; i++) {
    const stage = a.stages[i]!
    const heading = a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${stage.label}` : stage.label
    expect(within(openRegion()).getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
    const checkName = `Check ${stage.label}`
    if (i === trapAt) {
      const before = finals().length
      enter(stage, a.trapAnswer)
      click(checkName)
      const alert = screen.getByRole('alert')
      const info = ERROR_PATTERNS[a.trap]
      expect(alert.textContent).toContain(info.title)
      expect(alert.textContent).toContain(info.lesson)
      expect(alert.textContent).toContain('Example:')
      expect(alert.textContent).not.toContain(stageDisplay(stage))
      expect(finals()).toHaveLength(before + 1)
      expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
      click(checkName)
      expect(finals()).toHaveLength(before + 1)
      expect(doneEvent()).toBeUndefined()
      enter(stage, right[GEO_KEYS[stage.id]] ?? '')
      click(checkName)
    } else {
      enter(stage, right[GEO_KEYS[stage.id]] ?? '')
      click(checkName)
    }
  }
  expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
  expect(doneEvent()).toMatchObject({ finalCorrect: false, revealed: 0 })
  expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  for (const line of a.reveal) expect(screen.getByText(line)).toBeTruthy()
}

beforeEach(() => {
  resetStoreForTests()
})

describe.each(TEMPLATES)('GeometryFlow unit 3 %s/%s', (moduleId, templateId) => {
  it(
    'shows the figure first, names the promised mistake, then accepts the fix',
    () => {
      const { a, path } = load(moduleId, templateId)
      renderAt(path)
      expect(screen.getByText(exactText(a.prompt))).toBeTruthy()
      expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
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
      const checkName = `Check ${stage.label}`
      click(checkName)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toEqual([])
      if (stage.kind !== 'choice') {
        enter(stage, '???')
        expect(screen.queryByRole('alert')).toBeNull()
        click(checkName)
        expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
        expect(useStore.getState().events).toEqual([])
      }
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a reload restores her entries',
    () => {
      const { a, path } = load(moduleId, templateId)
      const view = renderAt(path)
      const stage = a.stages[0]!
      const key = GEO_KEYS[stage.id]
      if (stage.kind === 'choice') {
        const picked = stage.choices?.[0]?.id ?? stage.answerText
        enter(stage, picked)
        const text = stage.choices?.find((choice) => choice.id === picked)?.text ?? ''
        view.unmount()
        expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [key]: picked })
        renderAt(path)
        const radio = within(openRegion()).getByRole('radio', { name: text })
        expect(radio.getAttribute('aria-checked') ?? (radio as HTMLInputElement).checked).toBeTruthy()
      } else {
        enter(stage, 'not yet')
        view.unmount()
        expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [key]: 'not yet' })
        renderAt(path)
        expect((within(openRegion()).getByRole('textbox', { name: stage.label }) as HTMLInputElement).value).toBe('not yet')
      }
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('GeometryFlow unit 3 parts', () => {
  it(
    'finding x and then the fact walks both parts',
    () => {
      const { a, path } = load('geoParallel', 'gl3.converse', 3)
      expect(a.stages.map((stage) => stage.kind)).toEqual(['number', 'choice'])
      renderAt(path)
      expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('geoParallel', 'gl3.solve', 1)
      renderAt(path)
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      click('Nudge me')
      expect(screen.getByText(a.stages[0]!.nudge)).toBeTruthy()
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final?.revealed).toBe(true)
      expect(screen.getByText(a.stages[0]!.reveal[0]!)).toBeTruthy()
      expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'an unreadable line records nothing',
    () => {
      const { a, path } = load('geoParallel', 'gl3.slopes', 2)
      expect(a.stages[0]!.kind).toBe('line')
      renderAt(path)
      enter(a.stages[0]!, 'banana')
      click(`Check ${a.stages[0]!.label}`)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(useStore.getState().events).toEqual([])
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})
