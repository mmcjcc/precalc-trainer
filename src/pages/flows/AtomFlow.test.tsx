// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { resetStoreForTests, useStore } from '@/store'
import { problemPath } from '@/problem/url'
import ProblemPage from '../Problem'

// function-plot needs a real SVG layout engine; nothing here draws a graph anyway.
vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const TEMPLATES = ['atom.particles', 'atom.notation', 'atom.avgmass', 'atom.abundance'] as const
/** Fixed seeds with known content (asserted below): ²³₁₁Na⁺, 11 p / 12 n / 10 e, rubidium, copper. */
const SEED = { 'atom.particles': 12, 'atom.notation': 7, 'atom.avgmass': 9, 'atom.abundance': 8 } as const

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

function atomAnswer(templateId: keyof typeof SEED) {
  const inst = generateProblem('atoms', templateId, SEED[templateId], {})
  if (inst.answer.type !== 'atoms') throw new Error('expected an atoms answer')
  return inst.answer
}

const path = (templateId: keyof typeof SEED) => problemPath('atoms', templateId, SEED[templateId])

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

const events = (t: string) => useStore.getState().events.filter((e) => e.t === t)
const finals = () => events('final_answer') as Extract<ReturnType<typeof events>[number], { t: 'final_answer' }>[]
const doneEvent = () => events('problem_done')[0] as Extract<ReturnType<typeof events>[number], { t: 'problem_done' }> | undefined
const inputValue = (label: string | RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value

beforeEach(() => {
  resetStoreForTests()
})

describe('AtomFlow: every template renders', { timeout: 20_000 }, () => {
  it.each(TEMPLATES)('%s shows the prompt and the answer card, with no graph or calculator', (templateId) => {
    const answer = atomAnswer(templateId)
    const view = renderAt(path(templateId))
    expect(screen.getByText(answer.prompt)).toBeTruthy()
    if (answer.context) expect(screen.getByText(answer.context)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Final answer' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Hints' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Graph it' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Calculator' })).toBeNull()
    expect(screen.getByText(/stage 0 of 1 · give the answer/)).toBeTruthy()
    for (const el of document.querySelectorAll('input')) expect(el.type).not.toBe('number')
    view.unmount()
  })
})

describe('AtomFlow: count the particles', { timeout: 20_000 }, () => {
  it('wrong then right: names each mistake per box, records them, completes, and a reload keeps her entries', () => {
    const answer = atomAnswer('atom.particles')
    expect(answer.question).toEqual({ kind: 'particles', particle: { symbol: 'Na', z: 11, massNumber: 23, charge: 1 }, shown: 'symbol' })
    const view = renderAt(path('atom.particles'))
    expect(screen.getByLabelText('Nuclear symbol Na: mass number 23, atomic number 11, charge 1 plus')).toBeTruthy()

    // An empty box is not an answer: located, not recorded.
    type('Protons', '11')
    type('Neutrons', '23')
    click('Check answer')
    expect(screen.getByRole('alert').textContent).toBe('Type the number of electrons.')
    expect(finals()).toHaveLength(0)

    type('Electrons', '12')
    click('Check answer')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Neutrons = mass number − atomic number')
    expect(alert.textContent).toContain('Extra electrons make it negative')
    expect(alert.textContent).toContain('23 is the mass number')
    expect(alert.textContent).toContain('Example:')
    expect(finals()).toMatchObject([
      { correct: false, pattern: 'at_neutrons_as_mass_number', via: 'text' },
      { correct: false, pattern: 'at_charge_sign_flipped', via: 'text' },
    ])
    // Per-box marks: protons right, the other two wrong.
    expect((screen.getByLabelText('Protons') as HTMLInputElement).getAttribute('aria-invalid')).toBeNull()
    expect((screen.getByLabelText('Neutrons') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true')

    // Re-checking the same entry is not a second try.
    click('Check answer')
    expect(finals()).toHaveLength(2)

    // After a named mistake, rung 2 shows that lesson as the rule card.
    click('Nudge me')
    expect(screen.getByText(answer.nudge)).toBeTruthy()
    click('Show the rule')
    const hints = screen.getByRole('heading', { name: 'Hints' }).closest('section')!
    expect(within(hints).getByText('Neutrons = mass number − atomic number')).toBeTruthy()

    // Reload: her boxes come back.
    view.unmount()
    expect(useStore.getState().attempt?.final?.atEntries).toMatchObject({ protons: '11', neutrons: '23', electrons: '12' })
    renderAt(path('atom.particles'))
    expect([inputValue('Protons'), inputValue('Neutrons'), inputValue('Electrons')]).toEqual(['11', '23', '12'])

    type('Neutrons', '12')
    type('Electrons', '10')
    click('Check answer')
    expect(finals()).toMatchObject([{ correct: false }, { correct: false }, { correct: true }])
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(doneEvent()).toMatchObject({ finalCorrect: false, firstTryRate: 0, revealed: 0 })
    for (const line of answer.reveal) expect(screen.getByText(line)).toBeTruthy()
    expect((screen.getByLabelText('Protons') as HTMLInputElement).disabled).toBe(true)
  })

  it('a right first answer completes with first-try credit', () => {
    renderAt(path('atom.particles'))
    type('Protons', '11')
    type('Neutrons', '12')
    type('Electrons', '10')
    click('Check answer')
    expect(screen.getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    expect(finals()).toMatchObject([{ correct: true }])
    expect(doneEvent()).toMatchObject({ finalCorrect: true, firstTryRate: 1, revealed: 0, hints: 0 })
  })

  it('a wrong count with no named mistake gets the plain message and no pattern', () => {
    renderAt(path('atom.particles'))
    type('Protons', '11')
    type('Neutrons', '14')
    type('Electrons', '10')
    click('Check answer')
    expect(screen.getByRole('alert').textContent).toContain('Neutrons = mass number − atomic number: the top number minus the bottom number.')
    expect(finals()).toMatchObject([{ correct: false }])
    expect(finals()[0]!.pattern).toBeUndefined()
  })

  it('hint rung 3 shows the worked explanation and flags the answer as shown', () => {
    const answer = atomAnswer('atom.particles')
    renderAt(path('atom.particles'))
    click('Nudge me')
    click('Show the rule')
    click(/^Explain the answer/)
    for (const line of answer.reveal) expect(screen.getByText(line)).toBeTruthy()
    expect(useStore.getState().attempt?.final).toMatchObject({ revealed: true, firstCorrect: false })
    type('Protons', '11')
    type('Neutrons', '12')
    type('Electrons', '10')
    click('Check answer')
    expect(doneEvent()).toMatchObject({ finalCorrect: true, revealed: 1, firstTryRate: 0, hints: 3 })
  })
})

describe('AtomFlow: write the symbol', { timeout: 20_000 }, () => {
  it('wrong, then a letter-case slip, then right; the preview reads back her symbol; a reload keeps her entries', () => {
    const answer = atomAnswer('atom.notation')
    expect(answer.question).toEqual({ kind: 'notation', particle: { symbol: 'Na', z: 11, massNumber: 23, charge: 1 } })
    const view = renderAt(path('atom.notation'))
    const table = screen.getByRole('list', { name: 'Periodic table' })
    expect(within(table).getByLabelText('neon, symbol Ne, atomic number 10')).toBeTruthy()
    expect(within(table).getByLabelText('sodium, symbol Na, atomic number 11')).toBeTruthy()

    type('Element symbol', 'Ne')
    type('Mass number (A)', '21')
    type('Atomic number (Z)', '10')
    type('Charge', '-')
    expect(screen.getByText('reads as')).toBeTruthy()
    click('Check answer')
    expect(finals().map((f) => f.pattern)).toEqual(['at_element_from_electrons', 'at_mass_protons_electrons', 'at_charge_sign_flipped'])
    expect(screen.getByRole('alert').textContent).toContain('The protons pick the element')

    view.unmount()
    expect(useStore.getState().attempt?.final?.atEntries).toMatchObject({ symbol: 'Ne', massNumber: '21', atomicNumber: '10', charge: '-' })
    renderAt(path('atom.notation'))
    expect([inputValue('Element symbol'), inputValue('Mass number (A)'), inputValue('Atomic number (Z)'), inputValue('Charge')]).toEqual(['Ne', '21', '10', '-'])

    type('Element symbol', 'NA')
    type('Mass number (A)', '23')
    type('Atomic number (Z)', '11')
    type('Charge', '+')
    click('Check answer')
    expect(finals().slice(3)).toMatchObject([{ correct: false, pattern: 'at_symbol_case' }])
    expect(screen.getByRole('alert').textContent).toContain('capital letter followed by a lowercase one: Na')

    type('Element symbol', 'Na')
    click('Check answer')
    expect(finals().at(-1)).toMatchObject({ correct: true })
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    expect(screen.getByText('Right: ²³₁₁Na⁺, which is sodium-23 with a 1+ charge.')).toBeTruthy()
  })
})

describe('AtomFlow: average atomic mass', { timeout: 20_000 }, () => {
  it('shows the isotope table, names the unweighted average, keeps the entry over a reload, then completes', () => {
    const answer = atomAnswer('atom.avgmass')
    expect(answer.question.kind === 'avgmass' && answer.question.symbol).toBe('Rb')
    expect(answer.expected).toEqual(['85.47'])
    const view = renderAt(path('atom.avgmass'))
    const table = screen.getByRole('table', { name: 'Natural isotopes of rubidium' })
    expect(within(table).getByRole('rowheader', { name: 'rubidium-85' })).toBeTruthy()
    expect(within(table).getByText('84.911790')).toBeTruthy()
    expect(within(table).getByText('72.17%')).toBeTruthy()

    type('Your answer', '85.91')
    expect(screen.getByText('reads as 85.91 — 4 significant figures')).toBeTruthy()
    click('Check answer')
    expect(screen.getByRole('alert').textContent).toContain('Weigh each isotope by how common it is')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'at_unweighted_average', via: 'text' }])

    view.unmount()
    expect(useStore.getState().attempt?.final?.sfText).toBe('85.91')
    renderAt(path('atom.avgmass'))
    expect(inputValue('Your answer')).toBe('85.91')

    type('Your answer', '85.47')
    click('Check answer')
    expect(finals()).toMatchObject([{ correct: false }, { correct: true }])
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
    for (const line of answer.reveal) expect(screen.getByText(line)).toBeTruthy()
  })

  it('a figure slip comes from the sig-fig grader', () => {
    renderAt(path('atom.avgmass'))
    type('Your answer', '85.470')
    click('Check answer')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'sf_extra_zeros' }])
    expect(screen.getByRole('alert').textContent).toContain('Extra zeros claim extra precision')
  })
})

describe('AtomFlow: percent abundance', { timeout: 20_000 }, () => {
  it('50/50, then swapped, a reload, then right', () => {
    const answer = atomAnswer('atom.abundance')
    expect(answer.expected).toEqual(['69.15', '30.85'])
    const view = renderAt(path('atom.abundance'))
    expect(screen.getByRole('table', { name: /Isotopes of copper/ })).toBeTruthy()

    type('copper-63 abundance', '50')
    type('copper-65 abundance', '50')
    click('Check answer')
    expect(screen.getByRole('alert').textContent).toContain('The average tells you it is not 50/50')
    expect(finals()).toMatchObject([{ correct: false, pattern: 'at_assumed_even_split' }])

    type('copper-63 abundance', '30.85')
    type('copper-65 abundance', '69.15')
    click('Check answer')
    expect(finals().at(-1)).toMatchObject({ correct: false, pattern: 'at_abundance_swapped' })

    view.unmount()
    expect(useStore.getState().attempt?.final?.atEntries).toMatchObject({ abundance1: '30.85', abundance2: '69.15' })
    renderAt(path('atom.abundance'))
    expect([inputValue('copper-63 abundance'), inputValue('copper-65 abundance')]).toEqual(['30.85', '69.15'])

    type('copper-63 abundance', '69.15')
    type('copper-65 abundance', '31.85')
    click('Check answer')
    expect(finals().at(-1)).toMatchObject({ correct: false, pattern: 'at_abundance_sum' })

    type('copper-65 abundance', '30.85%')
    click('Check answer')
    expect(finals().at(-1)).toMatchObject({ correct: true })
    expect(finals()).toHaveLength(4)
    expect(screen.getByRole('heading', { name: /Problem finished/ })).toBeTruthy()
  })
})
