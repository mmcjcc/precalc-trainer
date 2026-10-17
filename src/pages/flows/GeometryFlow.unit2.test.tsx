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

const TEMPLATES: readonly (readonly [ModuleId, string])[] = [
  ['geoLogic', 'gl.related'],
  ['geoLogic', 'gl.truth'],
  ['geoLogic', 'gl.laws'],
  ['geoProof', 'gp.reason'],
  ['geoProof', 'gp.algebraic'],
  ['geoProof', 'gp.twocolumn'],
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

/** Testing Library collapses whitespace in the node but not in a string matcher, so a prompt with a newline would miss. */
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

function choose(stage: GeometryAnswer['stages'][number], id: string) {
  const region = openRegion()
  if (stage.kind === 'choice') {
    const text = stage.choices?.find((choice) => choice.id === id)?.text ?? id
    fireEvent.click(within(region).getByRole('radio', { name: text }))
    return
  }
  fireEvent.click(within(region).getByRole('radio', { name: reasonLabel(id) }))
}

function walk(a: GeometryAnswer) {
  const right = canonicalEntries(a)
  const trapAt = a.stages.findIndex((stage) => stage.id === a.trapStage)
  for (let i = 0; i < a.stages.length; i++) {
    const stage = a.stages[i]!
    const heading = a.stages.length > 1 ? `Part ${i + 1} of ${a.stages.length}: ${stage.label}` : stage.label
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
    const checkName = `Check ${stage.label}`
    if (i === trapAt) {
      const before = finals().length
      choose(stage, a.trapAnswer)
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
      choose(stage, right[GEO_KEYS[stage.id]] ?? '')
      click(checkName)
    } else {
      choose(stage, right[GEO_KEYS[stage.id]] ?? '')
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

describe.each(TEMPLATES)('GeometryFlow unit 2 %s/%s', (moduleId, templateId) => {
  it(
    'names the promised mistake, then accepts the fix, and records both',
    () => {
      const { a, path } = load(moduleId, templateId)
      renderAt(path)
      expect(screen.getByText(exactText(a.prompt))).toBeTruthy()
      if (a.figure.points.length === 0) expect(screen.queryByRole('img')).toBeNull()
      else expect(screen.getByRole('img', { name: a.figure.ariaLabel })).toBeTruthy()
      for (const stage of a.stages) expect(screen.queryByText(stage.reveal[0]!)).toBeNull()
      walk(a)
    },
    FLOW_TIMEOUT,
  )
})

describe('GeometryFlow unit 2 choices and reasons', () => {
  it(
    'a reload restores the choice she had made',
    () => {
      const { a, path } = load('geoLogic', 'gl.laws', 1)
      const view = renderAt(path)
      const stage = a.stages[0]!
      choose(stage, a.trapAnswer)
      const text = stage.choices?.find((choice) => choice.id === a.trapAnswer)?.text ?? ''
      view.unmount()
      expect(useStore.getState().attempt?.final?.polyEntries).toEqual({ [GEO_KEYS[stage.id]]: a.trapAnswer })
      renderAt(path)
      expect(within(openRegion()).getByRole('radio', { name: text }).getAttribute('aria-checked') ?? (within(openRegion()).getByRole('radio', { name: text }) as HTMLInputElement).checked).toBeTruthy()
      expect(doneEvent()).toBeUndefined()
    },
    FLOW_TIMEOUT,
  )

  it(
    'the reason list filters, moves by keyboard, and keeps a 44 px target',
    () => {
      const { path } = load('geoProof', 'gp.reason', 1)
      renderAt(path)
      const search = screen.getByRole('searchbox', { name: 'Search reasons' })
      fireEvent.change(search, { target: { value: 'symmetric' } })
      expect(screen.queryByRole('radio', { name: 'Division property of equality' })).toBeNull()
      const radios = screen.getAllByRole('radio')
      expect(radios.map((radio) => radio.textContent)).toEqual(['Symmetric property of equality', 'Symmetric property of congruence'])
      for (const radio of radios) expect(radio.className).toContain('min-h-11')
      radios[0]!.focus()
      fireEvent.keyDown(radios[0]!, { key: 'ArrowDown' })
      expect(radios[1]!.getAttribute('aria-checked')).toBe('true')
      expect(document.activeElement).toBe(radios[1])
      fireEvent.keyDown(radios[1]!, { key: 'ArrowUp' })
      expect(radios[0]!.getAttribute('aria-checked')).toBe('true')
      fireEvent.change(search, { target: { value: '' } })
      fireEvent.keyDown(search, { key: 'ArrowDown' })
      expect(screen.getByRole('radio', { name: 'Given' }).getAttribute('aria-checked')).toBe('true')
    },
    FLOW_TIMEOUT,
  )

  it(
    'choice targets are 44 px, a plain wrong pick is not a named mistake, and the third hint shows the answer',
    () => {
      const { a, path } = load('geoLogic', 'gl.related', 1)
      renderAt(path)
      const region = openRegion()
      const radios = within(region).getAllByRole('radio')
      expect(radios.length).toBeGreaterThan(1)
      for (const radio of radios) expect(radio.closest('label')!.className).toContain('min-h-11')
      const plain = a.stages[0]!.choices?.find((choice) => !choice.trap && choice.id !== a.stages[0]!.answerText)
      expect(plain).toBeTruthy()
      fireEvent.click(within(region).getByRole('radio', { name: plain!.text }))
      click(`Check ${a.stages[0]!.label}`)
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain('That choice does not answer this part.')
      expect(alert.textContent).not.toContain(ERROR_PATTERNS[a.trap].title)
      expect(finals()[0]).toMatchObject({ correct: false, via: 'text' })
      expect(finals()[0]?.pattern).toBeUndefined()
      click('Nudge me')
      click('Show the rule')
      expect(useStore.getState().attempt?.final?.revealed).toBeUndefined()
      expect(screen.queryByText(a.stages[0]!.reveal[0]!)).toBeNull()
      click(/Explain the answer/)
      expect(useStore.getState().attempt?.final?.revealed).toBe(true)
      expect(screen.getByText(a.stages[0]!.reveal[0]!)).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )

  it(
    'an everyday statement and an algebraic proof have no figure, and the lines are on screen',
    () => {
      const everyday = load('geoLogic', 'gl.related', 17)
      const first = renderAt(everyday.path)
      expect(everyday.a.figure.points).toEqual([])
      expect(screen.queryByRole('img')).toBeNull()
      expect(screen.getByText(exactText(everyday.a.prompt))).toBeTruthy()
      first.unmount()
      resetStoreForTests()

      const algebra = load('geoProof', 'gp.algebraic', 1)
      renderAt(algebra.path)
      expect(algebra.a.figure.points).toEqual([])
      expect(screen.queryByRole('img')).toBeNull()
      for (const line of algebra.a.lines ?? []) expect(screen.getByText(exactText(line))).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})

describe('GeometryFlow unit 2 proof rows that accept two reasons', () => {
  it(
    'a chain row in a two-column proof takes substitution as correct, and the worked answer names both',
    () => {
      const { p, a, path } = load('geoProof', 'gp.twocolumn', 8)
      expect(p.params.skeleton).toBe('right-angles')
      const at = a.stages.findIndex((stage) => stage.kind === 'reason' && stage.answerText === 'eq-trans')
      expect(at).toBeGreaterThan(0)
      expect(a.stages[at]!.accept).toEqual(['eq-subst'])
      renderAt(path)
      const right = canonicalEntries(a)
      for (let i = 0; i < a.stages.length; i++) {
        const stage = a.stages[i]!
        choose(stage, i === at ? 'eq-subst' : (right[GEO_KEYS[stage.id]] ?? ''))
        click(`Check ${stage.label}`)
        expect(screen.queryByRole('alert')).toBeNull()
        expect(finals().at(-1)).toMatchObject({ correct: true, via: 'text' })
        expect(finals().at(-1)?.pattern).toBeUndefined()
      }
      expect(finals()).toHaveLength(a.stages.length)
      expect(doneEvent()).toMatchObject({ finalCorrect: true, revealed: 0 })
      expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
      // Her own pick stays on the checked row, and the worked line says both names are fine.
      const row = screen.getByRole('region', { name: `Part ${at + 1} of ${a.stages.length}: ${a.stages[at]!.label}` })
      expect(within(row).getByText(reasonLabel('eq-subst'))).toBeTruthy()
      const worked = a.stages[at]!.reveal[0]!
      expect(worked).toContain(reasonLabel('eq-trans'))
      expect(worked).toContain(reasonLabel('eq-subst'))
      expect(screen.getByText(worked)).toBeTruthy()
    },
    FLOW_TIMEOUT,
  )
})
