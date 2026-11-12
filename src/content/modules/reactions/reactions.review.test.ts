/**
 * Catalog cards, rule cards, hints and nudges stay on screen while she can still answer. None of
 * them may single out an answer this template can generate for that part. A surface that lists
 * EVERY option of a choice part (the five reaction types together) singles out none; everything
 * else must be clean outright. The minted rx_ catalog examples are held to the strict rule without
 * the flow's blanking; a reused nm_ example the flow blanks when it shows the answer.
 */
import { describe, expect, it } from 'vitest'
import { ERROR_PATTERNS } from '@/engine'
import type { ReactionsAnswer } from '@/content/types'
import { RX_TEMPLATES } from './generate'
import { singlesOut } from './grade'
import { RX_RULES } from './rules'

const HEAVY = 120_000

function tail(example: string): string {
  return example.split(/=|→/).pop()!.trim()
}

describe('surfaces she sees while answering never single out an answer', () => {
  it.each(RX_TEMPLATES.map((t) => t.id))(
    '%s: no hint, nudge, prompt, instructions, witness, catalog title+lesson, rx_ example or rule card does, over 1000 seeds',
    (templateId) => {
      const template = RX_TEMPLATES.find((t) => t.id === templateId)!
      const clashes: string[] = []
      for (let seed = 1; seed <= 1000; seed++) {
        const p = template.generate(seed, {})
        const answer = p.answer as ReactionsAnswer
        for (const stage of answer.stages) {
          const answers = [stage.answerText, ...(stage.accept ?? [])]
          const surfaces: [string, string][] = [
            ['hint', stage.hint],
            ['nudge', stage.nudge],
            ['prompt', answer.prompt],
            ['instructions', p.instructions],
          ]
          for (const trap of stage.traps) {
            const info = ERROR_PATTERNS[trap.id]
            surfaces.push([`${trap.id} witness`, trap.witness])
            surfaces.push([`${trap.id} catalog`, `${info.title} ${info.lesson}`])
            if (trap.id.startsWith('rx_')) {
              for (const piece of [info.example, tail(info.example)]) surfaces.push([`${trap.id} example`, piece])
            }
          }
          for (const id of new Set([stage.ruleCard, ...answer.ruleCards])) {
            const card = RX_RULES.find((item) => item.id === id)
            surfaces.push([id, `${card?.title ?? ''} ${card?.body ?? ''} ${card?.example ?? ''}`])
          }
          for (const [name, text] of surfaces) {
            for (const value of answers) {
              if (singlesOut(stage, text, value)) clashes.push(`${templateId}/${seed} ${stage.id}=${value}: ${name}`)
            }
          }
        }
      }
      expect(clashes.slice(0, 12)).toEqual([])
    },
    HEAVY,
  )
})
