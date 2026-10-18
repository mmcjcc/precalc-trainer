/**
 * Catalog examples, rule cards, hints and nudges stay on screen while she can still answer.
 * None of them may contain an answer this template can generate for that part.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { PeriodicAnswer } from '@/content/types'
import { answerLeaks } from './facts'
import { exampleShowsAnswer } from './grade'
import { PT_RULES } from './rules'

const HEAVY = 120_000
const TEMPLATES = ['pt.locate', 'pt.valence', 'pt.trends', 'pt.ions', 'pt.why'] as const

function answerOf(templateId: string, seed: number): PeriodicAnswer {
  const p = generateProblem('periodic', templateId, seed)
  if (p.answer.type !== 'periodic') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

function tail(example: string): string {
  return example.split(/=|→/).pop()!.trim()
}

describe('examples on the cards never coincide with a generated answer', () => {
  it(
    'no hint, nudge, witness, catalog card or rule card contains the part’s answer, over 2000 seeds',
    () => {
      const clashes: string[] = []
      for (const templateId of TEMPLATES) {
        for (let seed = 1; seed <= 2000; seed++) {
          const answer = answerOf(templateId, seed)
          for (const stage of answer.stages) {
            const answers = [stage.answerText, ...(stage.accept ?? [])]
            const surfaces: [string, string][] = [
              ['hint', stage.hint],
              ['nudge', stage.nudge],
            ]
            if (!answer.prompt.startsWith('Which is larger')) surfaces.push(['prompt', answer.prompt])
            for (const trap of stage.traps) {
              const info = ERROR_PATTERNS[trap.id]
              surfaces.push([`${trap.id} witness`, trap.witness])
              surfaces.push([`${trap.id} catalog`, `${info.title} ${info.lesson} ${info.example}`])
              for (const piece of [info.example, tail(info.example)]) {
                for (const text of answers) {
                  if (exampleShowsAnswer(piece, text)) clashes.push(`${templateId}/${seed} ${stage.id}=${text}: ${trap.id} "${piece}"`)
                }
              }
            }
            for (const id of new Set([stage.ruleCard, ...answer.ruleCards])) {
              const card = PT_RULES.find((item) => item.id === id)
              const blob = `${card?.title ?? ''} ${card?.body ?? ''} ${card?.example ?? ''}`
              surfaces.push([id, blob])
              const example = card?.example ?? ''
              for (const piece of [example, tail(example)]) {
                for (const text of answers) {
                  if (piece && exampleShowsAnswer(piece, text)) clashes.push(`${templateId}/${seed} ${stage.id}=${text}: rule ${id} "${piece}"`)
                }
              }
            }
            for (const [name, text] of surfaces) {
              for (const value of answers) {
                if (answerLeaks(text, value)) clashes.push(`${templateId}/${seed} ${stage.id}=${value}: ${name}`)
              }
            }
          }
        }
      }
      expect(clashes.slice(0, 12)).toEqual([])
    },
    HEAVY,
  )
})
