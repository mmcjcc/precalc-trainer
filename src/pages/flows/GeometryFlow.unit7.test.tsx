// @vitest-environment jsdom
/**
 * The geometry screen with the Unit 7 problems (right triangles): per template, the figure first, the promised mistake
 * named (title, lesson, example) and recorded once, the fix, completion with the worked lines; an unreadable answer
 * records nothing; a reload restores her entries. Plus: a rounded length with its unit, too few places, the exact
 * radical, or another unit as notes that record nothing; an unsimplified radical as a note; the four kinds of
 * triangle as buttons never printed in the prompt; the third hint; and the chunky Check button.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { GEO_KEYS, canonicalEntries, type GeometryAnswer } from '@/content/modules/geometry'
import { stageDisplay } from '@/content/modules/geometry/grade'
import { SPECIAL_RIGHT_RULES } from '@/content/modules/geometry/unit7Rules'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import type { ModuleId } from '@/shared/types'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

const TEMPLATES: readonly (readonly [ModuleId, string])[] = [
  ['geoRightSimilar', 'rs.mean'],
  ['geoRightSimilar', 'rs.altitude'],
  ['geoPythagorean', 'py.side'],
  ['geoPythagorean', 'py.classify'],
  ['geoPythagorean', 'py.apply'],
  ['geoSpecialRight', 'sp.special'],
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
  for (let seed = 1; seed <= 600; seed++) {
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

/** Does the card show this answer? A word answer is looked for as a word past the card's "Not quite:" heading. */
function showsAnswer(text: string, display: string): boolean {
  const body = text.replace(/Not quite:/g, '')
  if (/^[A-Za-z ]+$/.test(display)) return new RegExp(`(^|[^A-Za-z])${display}([^A-Za-z]|$)`, 'i').test(body)
  return new RegExp(`(^|[^0-9√.])${display.replace(/[()]/g, '\\$&')}(?![0-9√]|\\.\\d)`).test(body)
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
    // The Check button keeps the chunky class.
    expect(screen.getByRole('button', { name: checkName }).className.split(/\s+/)).toContain('btn-chunky')
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

describe.each(TEMPLATES)('GeometryFlow unit 7 %s/%s', (moduleId, templateId) => {
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

describe('GeometryFlow unit 7 screens', () => {
  it(
    'a rounded length: too few places, the exact radical, or another unit is a note that records nothing; the length with its unit is right',
    () => {
      const seed = findSeed('geoPythagorean', 'py.apply', (a) => a.stages[0]!.round === 1 && a.stages[0]!.lengthUnit === 'ft' && /sqrt/.test(a.stages[0]!.exact!))
      const { a, path } = load('geoPythagorean', 'py.apply', seed)
      const stage = a.stages[0]!
      renderAt(path)
      const check = `Check ${stage.label}`
      const exact = Number(stage.answerText)
      for (const [typed, says] of [
        [String(Math.round(exact)), /rounded too far/],
        [stage.exact!, /calculator/],
        [`${stage.answerText} m`, /feet/],
      ] as const) {
        if (typed === stage.answerText) continue
        enter(stage, typed)
        click(check)
        const alert = screen.getByRole('alert').textContent ?? ''
        expect(alert).toContain(NOT_AN_ATTEMPT)
        expect(alert).toMatch(says)
        expect(alert).not.toContain(stage.answerText)
        expect(useStore.getState().events).toEqual([])
      }
      enter(stage, `${stage.answerText} ft`)
      click(check)
      expect(finals().at(-1)).toMatchObject({ correct: true })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a radical not in simplest form is a note that records nothing, then simplest form completes the part',
    () => {
      const seed = findSeed('geoRightSimilar', 'rs.mean', (a) => /^\d+√\d+$/.test(a.stages[0]!.answerText))
      const { a, path } = load('geoRightSimilar', 'rs.mean', seed)
      const stage = a.stages[0]!
      const [k, r] = stage.answerText.split('√').map(Number) as [number, number]
      renderAt(path)
      enter(stage, `sqrt(${k * k * r})`)
      click(`Check ${stage.label}`)
      const alert = screen.getByRole('alert').textContent ?? ''
      expect(alert).toContain(NOT_AN_ATTEMPT)
      expect(alert).toMatch(/simplest radical form/)
      expect(alert).not.toContain(stage.answerText)
      expect(useStore.getState().events).toEqual([])
      enter(stage, `${k}sqrt(${r})`)
      click(`Check ${stage.label}`)
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'acute, right, obtuse and not a triangle are buttons, never printed in the prompt; the last length taken as c is named',
    () => {
      const seed = findSeed('geoPythagorean', 'py.classify', (a) => a.trap === 'geo_converse_wrong_side')
      const { a, path } = load('geoPythagorean', 'py.classify', seed)
      renderAt(path)
      for (const name of ['Acute', 'Right', 'Obtuse', 'Not a triangle']) {
        expect(within(openRegion()).getByRole('radio', { name })).toBeTruthy()
        expect(a.prompt.toLowerCase()).not.toContain(name.toLowerCase())
      }
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'lengths that make no triangle: picking a kind of triangle names the skipped Triangle Inequality',
    () => {
      const seed = findSeed('geoPythagorean', 'py.classify', (a) => a.stages[0]!.answerText === 'none')
      const { a, path } = load('geoPythagorean', 'py.classify', seed)
      expect(a.trap).toBe('geo_triangle_inequality_skipped')
      renderAt(path)
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'two parts of the altitude to the hypotenuse, the far segment named on the leg',
    () => {
      const seed = findSeed('geoRightSimilar', 'rs.altitude', (a) => a.stages.length === 2 && a.trap === 'geo_leg_far_segment')
      const { a, path } = load('geoRightSimilar', 'rs.altitude', seed)
      renderAt(path)
      expectFigure(a)
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const seed = findSeed('geoSpecialRight', 'sp.special', (_a, params) => params.case === 'tri30')
      const { a, path } = load('geoSpecialRight', 'sp.special', seed)
      renderAt(path)
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      click('Nudge me')
      expect(screen.getByText(a.stages[0]!.nudge)).toBeTruthy()
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      // The rule card names the theorem.
      expect(screen.getAllByText(SPECIAL_RIGHT_RULES.find((c) => c.id === 'geo7-30-60-90')!.body).length).toBeGreaterThan(0)
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final?.revealed).toBe(true)
      expect(screen.getByText(a.stages[0]!.reveal[0]!)).toBeTruthy()
      expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toEqual([])
    },
    FLOW_TIMEOUT,
  )
})
