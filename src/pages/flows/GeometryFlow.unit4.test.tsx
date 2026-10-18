// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { GEO_KEYS, canonicalEntries, type GeometryAnswer } from '@/content/modules/geometry'
import { stageDisplay } from '@/content/modules/geometry/grade'
import { reasonLabel } from '@/content/modules/geometry/reasons'
import { ERROR_PATTERNS } from '@/engine'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore } from '@/store'
import type { ModuleId } from '@/shared/types'
import ProblemPage from '../Problem'

const FLOW_TIMEOUT = 120_000
const NOT_AN_ATTEMPT = 'This doesn’t count as an attempt'

const TEMPLATES: readonly (readonly [ModuleId, string])[] = [
  ['geoCongruence', 'gc.parts'],
  ['geoCongruence', 'gc.which'],
  ['geoCongruence', 'gc.solve'],
  ['geoIsosceles', 'gi.solve'],
  ['geoTriangleProofs', 'gt.twocolumn'],
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
  if (stage.kind === 'reason') {
    fireEvent.click(within(region).getByRole('radio', { name: reasonLabel(value) }))
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
  if (stage.kind === 'reason') {
    const radio = within(region).getByRole('radio', { name: reasonLabel(value) })
    return radio.getAttribute('aria-checked') ?? String((radio as HTMLInputElement).checked)
  }
  return (within(region).getByRole('textbox', { name: stage.label }) as HTMLInputElement).value
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

describe.each(TEMPLATES)('GeometryFlow unit 4 %s/%s', (moduleId, templateId) => {
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
      if (stage.kind === 'number') {
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
      const picked = stage.kind === 'number' ? 'not yet' : (stage.choices?.[0]?.id ?? stage.answerText)
      enter(stage, picked)
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [key]: picked })
      renderAt(path)
      expect(checked(stage, picked)).toBeTruthy()
      if (stage.kind === 'number') expect(checked(stage, picked)).toBe('not yet')
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )
})

describe('GeometryFlow unit 4 parts', () => {
  it(
    'two sides and a stray angle are not enough, and saying so finishes the part',
    () => {
      const { a, path } = load('geoCongruence', 'gc.which', 6)
      expect(a.stages[0]!.answerText).toBe('none')
      renderAt(path)
      expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
      expect(within(openRegion()).getByRole('radio', { name: 'Not enough information' })).toBeTruthy()
      expect(within(openRegion()).getByRole('radio', { name: 'SSA' })).toBeTruthy()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    '60 on an equilateral side is the named slip, and the side itself is accepted next',
    () => {
      const { a, path } = load('geoIsosceles', 'gi.solve', 3)
      expect(a.trap).toBe('geo_equilateral_angle_for_side')
      expect(a.trapStage).toBe('result')
      renderAt(path)
      expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
      walk(a)
    },
    FLOW_TIMEOUT,
  )

  it(
    'an AAS row accepts the postulate as well as the theorem, and the worked line names both',
    () => {
      const { p, a, path } = load('geoTriangleProofs', 'gt.twocolumn', 4)
      expect(p.params.skeleton).toBe('aas-nonincluded')
      const at = a.stages.findIndex((stage) => stage.answerText === 'thm-aas')
      expect(at).toBeGreaterThan(0)
      expect(a.stages[at]!.accept).toEqual(['post-aas'])
      renderAt(path)
      const right = canonicalEntries(a)
      for (let i = 0; i < a.stages.length; i++) {
        const stage = a.stages[i]!
        enter(stage, i === at ? 'post-aas' : (right[GEO_KEYS[stage.id]] ?? ''))
        click(`Check ${stage.label}`)
        expect(screen.queryByRole('alert')).toBeNull()
        expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
      }
      expect(doneEvent()).toMatchObject({ finalCorrect: true, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
      const worked = a.stages[at]!.reveal[0]!
      expect(worked).toContain(reasonLabel('thm-aas'))
      expect(worked).toContain(reasonLabel('post-aas'))
      expect(screen.getByText(worked)).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})
