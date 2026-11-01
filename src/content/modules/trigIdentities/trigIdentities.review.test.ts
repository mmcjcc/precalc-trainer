import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import { TRIG_MISTAKE_IDS } from '@/engine/trig'
import { TI_RULE_CARDS } from './index'

const SEEDS = Array.from({ length: 2000 }, (_, i) => i + 1)
const UNIT6_IDS = TRIG_MISTAKE_IDS.slice(TRIG_MISTAKE_IDS.indexOf('trig_pythag_sign'))
const UNIT6_CARDS = UNIT6_IDS.map((id) => ERROR_PATTERNS[id])

const squash = (s: string) => s.replace(/\s+/g, '')

describe('Unit 6 Fundamental trig identities — 2000-seed leak and English review', () => {
  it('UNIT6_CARDS have no ASCII digits, no generated expressions in x or θ, and no "a 8" / "an 3" English defects', () => {
    expect(UNIT6_IDS).toHaveLength(8)
    for (const card of UNIT6_CARDS) {
      const joined = `${card.title} ${card.lesson} ${card.example}`
      expect(joined, card.id).not.toMatch(/\d/)
      expect(joined, card.id).not.toContain('θ')
      expect(joined, card.id).not.toMatch(/\b(sin|cos|tan|csc|sec|cot)\s*x\b/)
      expect(joined, card.id).not.toMatch(/\b[Aa]n?\s+\d/)
    }
  })

  it('2000 seeds across ti.express, ti.simplify, and ti.verify never leak answers or walked steps and have clean English', () => {
    for (const templateId of ['ti.express', 'ti.simplify', 'ti.verify'] as const) {
      for (const seed of SEEDS) {
        const p = generateProblem('trigIdentities', templateId, seed)
        if (p.answer.type !== 'trigIdentities') continue
        const a = p.answer

        // Check English in prompt, instructions, nudge, formatHint
        for (const text of [p.title, p.instructions, a.prompt, a.nudge, a.formatHint, ...a.reveal]) {
          expect(text, `${templateId}#${seed}`).not.toMatch(/\b[Aa]n?\s+\d/)
          expect(text, `${templateId}#${seed}`).not.toContain('undefined')
          expect(text, `${templateId}#${seed}`).not.toContain('NaN')
        }

        if (a.question === 'express') {
          const finalAns = squash(a.answerText)
          const finalLatex = squash(a.answerLatex)
          // Prompt and Part 1/2/3 nudges and wrong choices never contain the final expression in θ
          expect(squash(a.prompt)).not.toContain(finalAns)
          expect(squash(a.prompt)).not.toContain(finalLatex)
          for (const stage of a.stages) {
            expect(squash(stage.ask)).not.toContain(finalAns)
            expect(squash(stage.nudge)).not.toContain(finalAns)
            expect(squash(stage.wrongNote)).not.toContain(finalAns)
            if (stage.choices) {
              const wrongChoices = stage.choices.filter((c) => c.value !== stage.answerText)
              for (const wc of wrongChoices) {
                expect(squash(wc.label)).not.toBe(squash(stage.answerText))
              }
            }
          }
        } else if (a.question === 'simplify') {
          // Prompt and step nudges never leak the final simplified answer or intermediate canonical steps
          for (const step of p.canonical) {
            expect(squash(a.prompt)).not.toContain(squash(step.text))
            expect(squash(step.nudge)).not.toContain(squash(step.text))
          }
          expect(squash(a.trapAnswer ?? '')).not.toBe(squash(a.answerText))
        } else {
          // ti.verify: intermediate canonical lines (before the target RHS) never appear in prompt or step nudges
          const intermediates = p.canonical.slice(0, -1)
          for (const step of intermediates) {
            expect(squash(a.prompt)).not.toContain(squash(step.text))
            expect(squash(step.nudge)).not.toContain(squash(step.text))
          }
          expect(squash(a.trapAnswer ?? '')).not.toBe(squash(a.answerText))
        }
      }
    }

    for (const rule of TI_RULE_CARDS) {
      expect(`${rule.title} ${rule.body} ${rule.example ?? ''}`).not.toMatch(/\b[Aa]n?\s+\d/)
    }
  }, 120_000)
})
