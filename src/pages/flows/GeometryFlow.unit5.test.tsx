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
  ['geoParallelograms', 'gq.props'],
  ['geoParallelograms', 'gq.prove'],
  ['geoParallelograms', 'gq.coords'],
  ['geoSpecialQuads', 'gs.props'],
  ['geoSpecialQuads', 'gs.classify'],
  ['geoTrapezoids', 'gz.midseg'],
  ['geoTrapezoids', 'gz.isosceles'],
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

/** The first seed from 1 whose problem passes `keep`. */
function findSeed(moduleId: ModuleId, templateId: string, keep: (a: GeometryAnswer, params: Record<string, unknown>) => boolean): number {
  for (let seed = 1; seed <= 500; seed++) {
    const p = generateProblem(moduleId, templateId, seed)
    if (p.answer.type === 'geometry' && keep(p.answer, p.params)) return seed
  }
  throw new Error(`no seed for ${templateId}`)
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

function checked(stage: GeometryAnswer['stages'][number], value: string) {
  const region = openRegion()
  if (stage.kind === 'choice') {
    const text = stage.choices?.find((choice) => choice.id === value)?.text ?? value
    const radio = within(region).getByRole('radio', { name: text })
    return radio.getAttribute('aria-checked') ?? String((radio as HTMLInputElement).checked)
  }
  return (within(region).getByRole('textbox', { name: stage.label }) as HTMLInputElement).value
}

/** Every part in order: the promised slip on its part first (named, recorded once, not finished), then the fix. */
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
      // Checking the same entry again records nothing new.
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

function expectFigure(a: GeometryAnswer) {
  if (a.figure.points.length > 0) expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
  else expect(screen.queryByRole('img')).toBeNull()
}

beforeEach(() => {
  resetStoreForTests()
})

describe.each(TEMPLATES)('GeometryFlow unit 5 %s/%s', (moduleId, templateId) => {
  it(
    'shows the figure first, names the promised mistake, then accepts the fix',
    () => {
      const { a, path } = load(moduleId, templateId)
      renderAt(path)
      expect(screen.getByText(exactText(a.prompt))).toBeTruthy()
      expectFigure(a)
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
      const picked = stage.kind === 'choice' ? (stage.choices?.[0]?.id ?? stage.answerText) : 'not yet'
      enter(stage, picked)
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [key]: picked })
      renderAt(path)
      expect(checked(stage, picked)).toBeTruthy()
      if (stage.kind !== 'choice') expect(checked(stage, picked)).toBe('not yet')
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('GeometryFlow unit 5 screens', () => {
  it(
    'one pair parallel and the other pair congruent: the slip is named, and saying the marks do not prove it finishes the part',
    () => {
      const seed = findSeed('geoParallelograms', 'gq.prove', (a, params) => a.trap === 'geo_parallel_congruent_mixed' && String(params.case).startsWith('mixed'))
      const { a, path } = load('geoParallelograms', 'gq.prove', seed)
      expect(a.stages[0]!.answerText).toBe('none')
      renderAt(path)
      expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
      expect(within(openRegion()).getByRole('radio', { name: 'Not enough information' })).toBeTruthy()
      expect(a.prompt).not.toContain('Not enough information')
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a square must be a rectangle and a rhombus: No on either part is the named slip, and Yes finishes it',
    () => {
      const seed = findSeed('geoSpecialQuads', 'gs.classify', (a) => a.stages.length === 2 && a.stages.every((s) => s.answerText === 'yes'))
      const { a, path } = load('geoSpecialQuads', 'gs.classify', seed)
      expect(a.trap).toBe('geo_square_not_rectangle')
      expect(a.trapStage).toBe('b')
      renderAt(path)
      expectFigure(a)
      expect(within(openRegion()).getByRole('radio', { name: 'Yes' })).toBeTruthy()
      expect(within(openRegion()).getByRole('radio', { name: 'No' })).toBeTruthy()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a rhombus named only a parallelogram is the most-specific slip, and the name itself is accepted next',
    () => {
      const seed = findSeed('geoSpecialQuads', 'gs.classify', (a) => a.stages.length === 1 && a.stages[0]!.answerText === 'rhombus' && a.trapAnswer === 'parallelogram')
      const { a, path } = load('geoSpecialQuads', 'gs.classify', seed)
      expect(a.trap).toBe('geo_not_most_specific')
      renderAt(path)
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'four slopes, then what they show: five parts one at a time',
    () => {
      const seed = findSeed('geoParallelograms', 'gq.coords', (a, params) => params.case === 'slopesYes' && a.stages.length === 5)
      const { a, path } = load('geoParallelograms', 'gq.coords', seed)
      expect(a.stages.map((s) => s.kind)).toEqual(['number', 'number', 'number', 'number', 'choice'])
      renderAt(path)
      expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'a midpoint is a point: the reader takes (x, y), and the subtracted midpoint is the named slip',
    () => {
      const seed = findSeed('geoParallelograms', 'gq.coords', (a) => a.trap === 'geo_midpoint_subtracted')
      const { a, path } = load('geoParallelograms', 'gq.coords', seed)
      expect(a.stages[0]!.kind).toBe('point')
      renderAt(path)
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('geoTrapezoids', 'gz.midseg', 1)
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
    'a degree sign is welcome on an angle and refused on a length',
    () => {
      const { a, path } = load('geoTrapezoids', 'gz.isosceles', 1)
      const result = a.stages.find((s) => s.id === 'result')!
      expect(result.unit).toBe('deg')
      renderAt(path)
      enter(a.stages[0]!, a.stages[0]!.answerText)
      click(`Check ${a.stages[0]!.label}`)
      enter(result, `${result.answerText}°`)
      click(`Check ${result.label}`)
      expect(finals().at(-1)).toMatchObject({ correct: true })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})
