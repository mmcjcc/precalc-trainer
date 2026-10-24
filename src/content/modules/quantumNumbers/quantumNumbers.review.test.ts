/**
 * Catalog examples, rule cards, hints and nudges stay on screen while she can still answer.
 * None of them may contain an answer this template can generate for that part, nor seed 1's numbers.
 * A card body that contains every choice singles none of them out. Titles, examples, and the
 * example's tail after the arrow stay strict.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { QuantumAnswer } from '@/content/types'
import { QN_MISTAKE_IDS, exampleShowsAnswer } from './grade'
import { answerLeaks } from './facts'
import { QN_RULES } from './rules'

const SWEEP = 600_000
const TEMPLATES = ['qn.meaning', 'qn.allowed', 'qn.count', 'qn.name', 'qn.shapes', 'qn.pauli'] as const

function answerOf(templateId: string, seed: number): QuantumAnswer {
  const p = generateProblem('quantumNumbers', templateId, seed)
  if (p.answer.type !== 'quantum') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

function tail(example: string): string {
  return example.split(/→/).pop()!.trim()
}

/** A body may state the answer only when it also states every choice, so it singles none out. */
function bodyOk(body: string, answer: string, choices: readonly string[]): boolean {
  if (!answerLeaks(body, answer)) return true
  return choices.length > 0 && choices.every((choice) => answerLeaks(body, choice))
}

describe('quantum examples never contain a digit', () => {
  it('catalog cards and rule-card titles and examples stay off seed numbers', () => {
    for (const id of QN_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.title, id).not.toMatch(/\d/)
      expect(info.lesson, id).not.toMatch(/\d/)
      expect(info.example, id).not.toMatch(/\d/)
    }
    for (const card of QN_RULES) {
      expect(card.title, card.id).not.toMatch(/\d/)
      expect(card.example ?? '', card.id).not.toMatch(/\d/)
    }
  })
})

describe('examples on the cards never coincide with a generated answer', () => {
  it(
    'no hint, nudge, witness, catalog card or rule card contains the part’s answer, over 2000 seeds',
    () => {
      const clashes: string[] = []
      const cards = getModule('quantumNumbers').ruleCards
      for (const templateId of TEMPLATES) {
        for (let seed = 1; seed <= 2000; seed++) {
          const answer = answerOf(templateId, seed)
          for (const stage of answer.stages) {
            const answers = [stage.answerText, ...(stage.accept ?? [])]
            const choices = (stage.choices ?? []).map((choice) => choice.text)
            const surfaces: [string, string][] = [
              ['hint', stage.hint],
              ['nudge', stage.nudge],
              ['prompt', answer.prompt],
            ]
            if (answer.figure) surfaces.push(['figure', answer.figure.ariaLabel])
            for (const trap of stage.traps) {
              const info = ERROR_PATTERNS[trap.id]
              surfaces.push([`${trap.id} witness`, trap.witness])
              surfaces.push([`${trap.id} title`, info.title])
              surfaces.push([`${trap.id} lesson`, info.lesson])
              for (const piece of [info.example, tail(info.example)]) {
                for (const text of answers) {
                  if (exampleShowsAnswer(piece, text)) clashes.push(`${templateId}/${seed} ${stage.id}=${text}: ${trap.id} "${piece}"`)
                }
              }
            }
            for (const card of cards) {
              surfaces.push([`${card.id} title`, card.title])
              const example = card.example ?? ''
              for (const piece of [example, tail(example)]) {
                for (const text of answers) {
                  if (piece && exampleShowsAnswer(piece, text)) clashes.push(`${templateId}/${seed} ${stage.id}=${text}: rule ${card.id} "${piece}"`)
                }
              }
              for (const text of answers) {
                if (!bodyOk(card.body, text, choices)) clashes.push(`${templateId}/${seed} ${stage.id}=${text}: body ${card.id}`)
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
      expect(clashes.slice(0, 12), clashes.slice(0, 12).join('\n')).toEqual([])
    },
    SWEEP,
  )
})
