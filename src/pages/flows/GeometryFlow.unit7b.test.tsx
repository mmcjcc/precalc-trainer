// @vitest-environment jsdom
/**
 * The geometry screen with Unit 7's second half (the tangent, sine and cosine ratios, and angles of elevation and
 * depression): per template, the figure first, the promised mistake named and recorded once, then the fix; an
 * unreadable answer records nothing; a reload restores her entries. A decimal rounded to the wrong place, a fraction
 * not in lowest terms, and a radical not in simplest form are notes that record nothing. The third hint marks the
 * answer as shown. The Check button keeps the chunky class.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { GEO_KEYS, canonicalEntries, type GeometryAnswer } from '@/content/modules/geometry'
import { stageDisplay } from '@/content/modules/geometry/grade'
import { TRIG_RATIO_RULES } from '@/content/modules/geometry/unit7bRules'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import type { ModuleId } from '@/shared/types'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

const TEMPLATES: readonly (readonly [ModuleId, string])[] = [
  ['geoTrigRatios', 'tr.ratio'],
  ['geoTrigRatios', 'tr.side'],
  ['geoTrigRatios', 'tr.angle'],
  ['geoElevDepress', 'el.story'],
  ['geoElevDepress', 'el.two'],
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
function findSeed(moduleId: ModuleId, templateId: string, keep: (a: GeometryAnswer) => boolean, limit = 600): number {
  for (let seed = 1; seed <= limit; seed++) {
    const p = generateProblem(moduleId, templateId, seed)
    if (p.answer.type === 'geometry' && keep(p.answer)) return seed
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
function walk(a: GeometryAnswer) {
  const right = canonicalEntries(a)
  const trapAt = a.stages.findIndex((stage) => stage.id === a.trapStage)
  for (let i = 0; i < a.stages.length; i++) {
    const stage = a.stages[i]!
    const heading = a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${stage.label}` : stage.label
    expect(within(openRegion()).getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
    const checkName = `Check ${stage.label}`
    expect(screen.getByRole('button', { name: checkName }).className.split(/\s+/)).toContain('btn-chunky')
    const answer = right[GEO_KEYS[stage.id]] ?? ''
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
  expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
}

/** The same value, written so it is not simplest: sqrt(12) for 2√3, 2/sqrt(13) for (2√13)/13, sqrt(12)/4 for √3/2. */
function unsimplifiedOf(answer: string): string | null {
  let m = /^(\d+)√(\d+)$/.exec(answer)
  if (m) return `sqrt(${Number(m[1]) * Number(m[1]) * Number(m[2])})`
  m = /^\((\d+)√(\d+)\)\/(\d+)$/.exec(answer)
  if (m) {
    const k = Number(m[1])
    const r = Number(m[2])
    const d = Number(m[3])
    if (d === r) return `${k}/sqrt(${r})`
    return `sqrt(${k * k * r})/${d}`
  }
  m = /^√(\d+)\/(\d+)$/.exec(answer)
  if (m) return `sqrt(${4 * Number(m[1])})/${2 * Number(m[2])}`
  return null
}

beforeEach(() => {
  resetStoreForTests()
})

describe.each(TEMPLATES)('GeometryFlow unit 7b %s/%s', (moduleId, templateId) => {
  it(
    'shows the figure first, names the promised mistake, then accepts the fix',
    () => {
      const { a, path } = load(moduleId, templateId)
      renderAt(path)
      expect(screen.getByText(exactText(a.prompt))).toBeTruthy()
      expectFigure(a)
      for (const stage of a.stages) expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
      for (const choice of a.stages[0]!.choices ?? []) expect(a.prompt.toLowerCase()).not.toContain(choice.text.toLowerCase())
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
      if (stage.kind === 'choice') expect(checked(stage, picked)).toBe('true')
      else expect(checked(stage, picked)).toBe('not yet')
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('GeometryFlow unit 7b screens', () => {
  it(
    'the third hint shows the answer and marks it shown',
    () => {
      const { a, path } = load('geoTrigRatios', 'tr.side', 1)
      const stage = a.stages[0]!
      renderAt(path)
      expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
      click('Nudge me')
      expect(screen.getByText(stage.nudge)).toBeTruthy()
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
      const card = TRIG_RATIO_RULES.find((c) => c.id === stage.ruleCard)!
      expect(screen.getAllByText(card.body).length).toBeGreaterThan(0)
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final?.revealed).toBe(true)
      expect(screen.getByText(stage.reveal[0]!)).toBeTruthy()
      expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toEqual([])
    },
    FLOW_TIMEOUT,
  )

  it(
    'a decimal rounded to the wrong place is a note that records nothing, and does not show the answer',
    () => {
      const seed = findSeed('geoTrigRatios', 'tr.side', (a) => {
        const stage = a.stages[0]!
        return (stage.round ?? 0) >= 1 && stage.exact !== undefined
      })
      const { a, path } = load('geoTrigRatios', 'tr.side', seed)
      const stage = a.stages[0]!
      const places = (stage.round ?? 1) - 1
      const exact = Number(stage.exact)
      const f = 10 ** places
      const shorter = (Math.round(exact * f) / f).toFixed(places)
      expect(shorter).not.toBe(stage.answerText)
      renderAt(path)
      enter(stage, shorter)
      click(`Check ${stage.label}`)
      const alert = screen.getByRole('alert').textContent ?? ''
      expect(alert).toContain(NOT_AN_ATTEMPT)
      expect(alert).toMatch(/rounded too far/)
      expect(alert).not.toContain(stage.answerText)
      expect(useStore.getState().events).toEqual([])
      enter(stage, stage.answerText)
      click(`Check ${stage.label}`)
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'an exact fraction not in lowest terms is a note, then lowest terms completes the part',
    () => {
      const seed = findSeed('geoTrigRatios', 'tr.ratio', (a) => /^\d+\/\d+$/.test(a.stages[0]!.answerText))
      const { a, path } = load('geoTrigRatios', 'tr.ratio', seed)
      const stage = a.stages[0]!
      const [n, d] = stage.answerText.split('/').map(Number) as [number, number]
      const doubled = `${n * 2}/${d * 2}`
      renderAt(path)
      enter(stage, doubled)
      click(`Check ${stage.label}`)
      const alert = screen.getByRole('alert').textContent ?? ''
      expect(alert).toContain(NOT_AN_ATTEMPT)
      expect(alert).toMatch(/lowest terms/)
      expect(alert).not.toContain(stage.answerText)
      expect(useStore.getState().events).toEqual([])
      enter(stage, stage.answerText)
      click(`Check ${stage.label}`)
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'a radical not in simplest form is a note that records nothing, then simplest form completes the part',
    () => {
      const seed = findSeed('geoTrigRatios', 'tr.ratio', (a) => unsimplifiedOf(a.stages[0]!.answerText) !== null)
      const { a, path } = load('geoTrigRatios', 'tr.ratio', seed)
      const stage = a.stages[0]!
      const typed = unsimplifiedOf(stage.answerText)!
      renderAt(path)
      enter(stage, typed)
      click(`Check ${stage.label}`)
      const alert = screen.getByRole('alert').textContent ?? ''
      expect(alert).toContain(NOT_AN_ATTEMPT)
      expect(alert).toMatch(/simplest/)
      expect(alert).not.toContain(stage.answerText)
      expect(useStore.getState().events).toEqual([])
      enter(stage, stage.answerText.replace('√', 'sqrt'))
      click(`Check ${stage.label}`)
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})
