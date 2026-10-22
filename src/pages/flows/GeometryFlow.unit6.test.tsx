// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { GEO_KEYS, canonicalEntries, type GeometryAnswer } from '@/content/modules/geometry'
import { stageDisplay } from '@/content/modules/geometry/grade'
import { PARTS_RULES } from '@/content/modules/geometry/unit6Rules'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import type { ModuleId } from '@/shared/types'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

const TEMPLATES: readonly (readonly [ModuleId, string])[] = [
  ['geoRatios', 'gr.proportion'],
  ['geoRatios', 'gr.polygons'],
  ['geoSimilarTriangles', 'gt.prove'],
  ['geoSimilarTriangles', 'gt.solve'],
  ['geoProportionalParts', 'gp.splitter'],
  ['geoProportionalParts', 'gp.bisector'],
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

/**
 * Does the card show this answer? A word answer ("No", "Yes") is looked for as a word, past the card's own "Not quite:"
 * heading; anything else as text.
 */
function showsAnswer(text: string, display: string): boolean {
  const body = text.replace(/Not quite:/g, '')
  if (/^[A-Za-z]+$/.test(display)) return new RegExp(`(^|[^A-Za-z])${display}([^A-Za-z]|$)`).test(body)
  return body.includes(display)
}

/** Every part in order: the promised slip on its part first (named, recorded once, not finished), then the fix. */
function walk(a: GeometryAnswer, typed: Record<string, string> = {}) {
  const right = canonicalEntries(a)
  const trapAt = a.stages.findIndex((stage) => stage.id === a.trapStage)
  for (let i = 0; i < a.stages.length; i++) {
    const stage = a.stages[i]!
    const heading = a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${stage.label}` : stage.label
    expect(within(openRegion()).getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
    const checkName = `Check ${stage.label}`
    const answer = typed[stage.id] ?? right[GEO_KEYS[stage.id]] ?? ''
    if (i === trapAt) {
      const before = finals().length
      enter(stage, a.trapAnswer)
      click(checkName)
      const alert = screen.getByRole('alert')
      const info = ERROR_PATTERNS[a.trap]
      expect(alert.textContent).toContain(info.title)
      expect(alert.textContent).toContain(info.lesson)
      expect(alert.textContent).toContain('Example:')
      expect(showsAnswer(alert.textContent ?? '', stageDisplay(stage)), stageDisplay(stage)).toBe(false)
      expect(finals()).toHaveLength(before + 1)
      expect(finals()[before]).toMatchObject({ correct: false, pattern: a.trap, via: 'text' })
      // Checking the same entry again records nothing new.
      click(checkName)
      expect(finals()).toHaveLength(before + 1)
      expect(doneEvent()).toBeUndefined()
      enter(stage, answer)
      click(checkName)
    } else {
      enter(stage, answer)
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

describe.each(TEMPLATES)('GeometryFlow unit 6 %s/%s', (moduleId, templateId) => {
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

describe('GeometryFlow unit 6 screens', () => {
  it(
    'a scale factor written 2:5 is right, and so is the rest of the problem',
    () => {
      const { a, path } = load('geoRatios', 'gr.polygons', 1)
      expect(a.stages[0]!.answerText).toBe('2/5')
      renderAt(path)
      walk(a, { a: '2:5' })
    },
    FLOW_TIMEOUT,
  )

  it(
    'a story’s length with its unit is right; the other unit is a note that records nothing',
    () => {
      const { a, path } = load('geoSimilarTriangles', 'gt.solve', 1)
      const x = a.stages[1]!
      expect(x.lengthUnit).toBe('ft')
      renderAt(path)
      enter(a.stages[0]!, a.stages[0]!.answerText)
      click(`Check ${a.stages[0]!.label}`)
      const before = useStore.getState().events.length
      enter(x, `${x.answerText} m`)
      click(`Check ${x.label}`)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      expect(screen.getByRole('alert').textContent).toContain('feet')
      expect(useStore.getState().events).toHaveLength(before)
      enter(x, `${x.answerText} ft`)
      click(`Check ${x.label}`)
      expect(finals().at(-1)).toMatchObject({ correct: true })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the which-test question shows the four names as buttons and never prints one in the prompt; SSA picked as SAS is named',
    () => {
      const seed = findSeed('geoSimilarTriangles', 'gt.prove', (a) => a.trap === 'geo_ssa_as_similarity')
      const { a, path } = load('geoSimilarTriangles', 'gt.prove', seed)
      expect(a.stages[0]!.answerText).toBe('none')
      renderAt(path)
      for (const name of ['AA Similarity Postulate', 'SSS Similarity Theorem', 'SAS Similarity Theorem', 'Not enough information']) {
        expect(within(openRegion()).getByRole('radio', { name })).toBeTruthy()
        expect(a.prompt).not.toContain(name)
      }
      expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'the statement matched by position is named, then the true statement and x finish the problem',
    () => {
      const seed = findSeed('geoSimilarTriangles', 'gt.solve', (a, params) => params.case === 'reverse' && a.trap === 'geo_matched_by_position' && a.trapStage === 'a')
      const { a, path } = load('geoSimilarTriangles', 'gt.solve', seed)
      renderAt(path)
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'the converse: the picture is not to scale, and a part-over-whole pick is named',
    () => {
      const seed = findSeed('geoProportionalParts', 'gp.splitter', (_a, params) => params.case === 'converse' && params.answer === 'no')
      const { a, path } = load('geoProportionalParts', 'gp.splitter', seed)
      expect(a.prompt).toContain('not drawn to scale')
      renderAt(path)
      expect(within(openRegion()).getByRole('radio', { name: 'Yes' })).toBeTruthy()
      expect(within(openRegion()).getByRole('radio', { name: 'No' })).toBeTruthy()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('geoProportionalParts', 'gp.bisector', 1)
      renderAt(path)
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      click('Nudge me')
      expect(screen.getByText(a.stages[0]!.nudge)).toBeTruthy()
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      // The rule card names the theorem (the hints panel draws it where the screen size puts it).
      expect(screen.getAllByText(PARTS_RULES.find((c) => c.id === 'geo6-angle-bisector')!.body).length).toBeGreaterThan(0)
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
      const seed = findSeed('geoRatios', 'gr.polygons', (_a, params) => params.case === 'angle')
      const { a, path } = load('geoRatios', 'gr.polygons', seed)
      const [scale, x, angle] = a.stages as [GeometryAnswer['stages'][number], GeometryAnswer['stages'][number], GeometryAnswer['stages'][number]]
      expect(angle.unit).toBe('deg')
      renderAt(path)
      enter(scale, `${scale.answerText}°`)
      click(`Check ${scale.label}`)
      expect(screen.getByRole('alert').textContent).toContain(NOT_AN_ATTEMPT)
      enter(scale, scale.answerText)
      click(`Check ${scale.label}`)
      enter(x, x.answerText)
      click(`Check ${x.label}`)
      enter(angle, `${angle.answerText}°`)
      click(`Check ${angle.label}`)
      expect(finals().at(-1)).toMatchObject({ correct: true })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})
