/**
 * Reviewer's checks (docs/progress/chemistry-quantum.md, Review): what the first build let slip.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'

const TEMPLATES = ['qn.meaning', 'qn.allowed', 'qn.count', 'qn.name', 'qn.shapes', 'qn.pauli'] as const
const SEEDS = 300

interface Answer {
  prompt: string
  stages: { label: string; answerText: string; hint: string; choices?: { text: string }[] }[]
}
const problem = (t: string, seed: number) => generateProblem('quantumNumbers' as never, t, seed).answer as unknown as Answer

describe('reviewer: quantum numbers', () => {
  it('an allowed-set problem reads the same whatever the answer: one prompt, two parts', { timeout: 120_000 }, () => {
    const prompts = new Set<string>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const a = problem('qn.allowed', seed)
      expect(a.prompt, `seed ${seed}`).not.toMatch(/outside|range|which/i)
      expect(a.stages.length, `seed ${seed}`).toBe(2)
      prompts.add(a.prompt.replace(/[−-]?\d+(\/\d+)?/g, '#'))
      // The second part is the number out of range for a set that is not allowed, the sublevel for one that is.
      const notAllowed = a.stages[0]!.answerText === 'Not allowed'
      expect(a.stages[1]!.label, `seed ${seed}`).toBe(notAllowed ? 'Number out of range' : 'Sublevel')
    }
    expect([...prompts].length).toBeLessThanOrEqual(2)
  })

  it('names only s, p, d and f sublevels, and counts a shell as the most it can hold', { timeout: 120_000 }, () => {
    for (const t of TEMPLATES) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        // What she reads: the prompt and each part (a trap may hold "4g": the l = n slip she might type).
        const a = problem(t, seed)
        const text = JSON.stringify([a.prompt, a.stages.map((s) => [s.label, s.answerText, s.hint, (s.choices ?? []).map((c) => c.text)])])
        expect(text, `${t}/${seed}`).not.toMatch(/\b\d[ghi]\b|\b[ghi] sublevel/)
        expect(text, `${t}/${seed}`).not.toMatch(/electrons are in shell|electrons are in the/)
      }
    }
  })
})
