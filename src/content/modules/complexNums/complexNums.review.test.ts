/** Inputs from an adversarial review (Gemini, 2026-10-15): spellings the reader used to refuse or wrongly accept. */
import { describe, expect, it } from 'vitest'
import { parseCxAnswer } from './parse'

const read = (t: string) => {
  const p = parseCxAnswer(t)
  return p.ok ? `${p.values.length}:${p.simplified ? 'simplified' : 'not simplified'}` : 'unreadable'
}

describe('answer reader, after review', () => {
  it('reads a leading plus-or-minus as 0 +- bi', () => {
    expect(read('+- 3i')).toBe('2:simplified')
    expect(read('±3i')).toBe('2:simplified')
  })
  it('reads brackets around a plus-or-minus answer', () => {
    expect(read('(2 +- 3i)')).toBe('2:simplified')
    expect(read('(3 - 2i)')).toBe('1:simplified')
  })
  it('does not call an answer with an unsimplified square root finished', () => {
    expect(read('3 + sqrt(-4)')).toBe('1:not simplified')
    expect(read('sqrt(12)')).toBe('1:not simplified')
    expect(read('i sqrt(12)')).toBe('1:not simplified')
    expect(read('2 sqrt(3)')).toBe('1:simplified')
    expect(read('4i sqrt(3)')).toBe('1:simplified')
  })
})

describe('feedback she can retry never states the answer', () => {
  it('a plain wrong answer and a named mistake leave the answer out', async () => {
    const { generateProblem } = await import('@/content')
    const { canonicalEntries, gradeCxStage } = await import('./build')
    for (const t of ['cx.arith', 'cx.divide', 'cx.powers', 'cx.quadratic', 'cx.zeros']) {
      for (let seed = 1; seed <= 40; seed++) {
        const a = generateProblem('complexNums', t, seed).answer as Parameters<typeof gradeCxStage>[0]
        const answer = canonicalEntries(a).answer!
        for (const text of ['7 + 100i', a.trapAnswer]) {
          if (!text) continue
          const g = gradeCxStage(a, 'answer', text)
          const said = g.verdict === 'mistake' ? g.witness : g.verdict === 'wrong' ? g.message : ''
          expect(said, `${t}/${seed} ${text}`).not.toMatch(/The answer is/)
          // The answer as a whole, not inside a longer number she typed ("2 + 23i" inside "22 + 23i").
          const at = said.indexOf(answer)
          const inside = at >= 0 && (/[0-9./\-−]/.test(said[at - 1] ?? '') || /[0-9]/.test(said[at + answer.length] ?? ''))
          if (answer.length > 3 && !inside) expect(said, `${t}/${seed} ${text}`).not.toContain(answer)
        }
      }
    }
  }, 120000)
})
