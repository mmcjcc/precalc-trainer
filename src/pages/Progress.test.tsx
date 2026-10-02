// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ERROR_PATTERNS } from '@/engine'
import {
  emptyWeeklySkill,
  isoWeekKey,
  patternCounts,
  resetStoreForTests,
  useStore,
  type Ev,
  type Weekly,
} from '@/store'
import { ProgressPage } from './Progress'

function rejected(at: number, skill: string, pattern: string): Ev {
  return { t: 'step_rejected', at, attemptId: `a-${skill}-${at}`, skill, stepIdx: 0, pattern }
}

beforeEach(() => {
  resetStoreForTests()
})

describe('Progress grouped by class', () => {
  it('keeps each class’s mistakes in that class, and unplaced skills under Other', () => {
    const now = Date.now()
    const events: Ev[] = [
      rejected(now, 'ineq.linear', 'no_sign_flip'),
      rejected(now - 1, 'light.energy', 'no_sign_flip'),
      rejected(now, 'ineq.any', 'dropped_union'),
      { t: 'drill_answer', at: now, skill: 'powers-roots', correct: true, kind: 'legal' },
      {
        t: 'problem_done',
        at: now,
        attemptId: 'done',
        skill: 'ineq.linear',
        moduleId: 'inequalities',
        steps: 2,
        firstTryRate: 0.5,
        hints: 0,
        revealed: 0,
        finalCorrect: true,
        mode: 'normal',
        secs: 30,
      },
    ]
    const weekly: Weekly = {
      [isoWeekKey(now)]: {
        'sf.mixed': { ...emptyWeeklySkill(), patterns: { endpoint_type: 4 } },
      },
      '2020-W01': {
        'ineq.linear': { ...emptyWeeklySkill(), patterns: { no_sign_flip: 2 } },
      },
    }
    useStore.setState({ events, weekly })
    render(<ProgressPage />)

    const skills = screen.getByRole('region', { name: 'By problem type' })
    const skillHeadings = within(skills)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(skillHeadings).toEqual(['Honors Precalculus', 'Chemistry', 'Other'])

    const precalcSkills = within(skills).getByRole('heading', { name: 'Honors Precalculus' }).closest('section')!
    expect(within(precalcSkills).getByRole('rowheader', { name: 'Linear inequality' })).toBeTruthy()
    expect(within(precalcSkills).queryByRole('rowheader', { name: 'Energy of a photon' })).toBeNull()
    expect(within(precalcSkills).queryByRole('rowheader', { name: 'powers-roots' })).toBeNull()

    const chemistrySkills = within(skills).getByRole('heading', { name: 'Chemistry' }).closest('section')!
    expect(within(chemistrySkills).getByRole('rowheader', { name: 'Energy of a photon' })).toBeTruthy()
    expect(within(chemistrySkills).getByText('Significant figures')).toBeTruthy()
    expect(within(chemistrySkills).queryByRole('rowheader', { name: 'Linear inequality' })).toBeNull()

    const otherSkills = within(skills).getByRole('heading', { name: 'Other' }).closest('section')!
    expect(within(otherSkills).getByRole('rowheader', { name: 'ineq.any' })).toBeTruthy()
    expect(within(otherSkills).getByRole('rowheader', { name: 'powers-roots' })).toBeTruthy()

    const patterns = screen.getByRole('region', { name: 'Error patterns' })
    const patternHeadings = within(patterns)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(patternHeadings).toEqual(['Honors Precalculus', 'Chemistry', 'Other'])

    function cells(region: HTMLElement, title: string): string[] {
      const row = within(region).getByRole('rowheader', { name: title }).closest('tr')!
      return within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? '')
    }

    const precalcPatterns = within(patterns).getByRole('heading', { name: 'Honors Precalculus' }).closest('section')!
    expect(cells(precalcPatterns, ERROR_PATTERNS.no_sign_flip.title)).toEqual(['1', '2'])

    const chemistryPatterns = within(patterns).getByRole('heading', { name: 'Chemistry' }).closest('section')!
    // Same pattern name as precalculus, counted on its own. The weekly bucket is this ISO week and still counts as before.
    expect(cells(chemistryPatterns, ERROR_PATTERNS.no_sign_flip.title)).toEqual(['1', '0'])
    expect(cells(chemistryPatterns, ERROR_PATTERNS.endpoint_type.title)).toEqual(['0', '4'])

    const otherPatterns = within(patterns).getByRole('heading', { name: 'Other' }).closest('section')!
    expect(cells(otherPatterns, ERROR_PATTERNS.dropped_union.title)).toEqual(['1', '0'])

    const shown = new Map<string, { thisWeek: number; before: number }>()
    for (const region of [precalcPatterns, chemistryPatterns, otherPatterns]) {
      for (const row of within(region).getAllByRole('row')) {
        const name = within(row).queryByRole('rowheader')?.textContent
        if (!name) continue
        const [thisWeek, before] = within(row)
          .getAllByRole('cell')
          .map((cell) => Number(cell.textContent))
        const prev = shown.get(name) ?? { thisWeek: 0, before: 0 }
        shown.set(name, { thisWeek: prev.thisWeek + (thisWeek ?? 0), before: prev.before + (before ?? 0) })
      }
    }
    for (const count of patternCounts(events, weekly, now)) {
      const title = count.pattern in ERROR_PATTERNS ? ERROR_PATTERNS[count.pattern as keyof typeof ERROR_PATTERNS].title : count.pattern
      expect(shown.get(title)).toEqual({ thisWeek: count.thisWeek, before: count.before })
    }

    const habits = screen.getByRole('region', { name: 'Habits' })
    const finished = within(habits).getByText('Finished').closest('div')!
    expect(within(finished).getByText('1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download backup (.json)' })).toBeTruthy()
    expect(screen.getByText('1 of 1 right (100%)')).toBeTruthy()
  })

  it('still says when no mistakes have been logged', () => {
    render(<ProgressPage />)
    expect(screen.getByText(/No mistakes logged yet/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Other' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Honors Precalculus' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Chemistry' })).toBeTruthy()
  })
})
