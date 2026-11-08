/**
 * Catalog cards, rule cards, hints and nudges stay on screen while she can still answer.
 * None of them may single out an answer this template can generate for that part. A surface
 * that lists EVERY option of a closed set (the five shapes with their angles, the three bands,
 * polar beside nonpolar) singles out none — the brief's "a card that lists every option" rule;
 * everything else must be clean outright. Minted cb_ catalog examples must be clean without
 * the flow's blanking.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { CovalentBondingAnswer } from '@/content/types'
import { answerLeaks } from './facts'
import { CB_RULES } from './rules'

const HEAVY = 120_000
const TEMPLATES = ['cb.electrons', 'cb.dots', 'cb.shape', 'cb.polarity', 'cb.forces'] as const
const ANGLES = ['180', '120', '109.5', '107', '104.5']

function answerOf(templateId: string, seed: number): CovalentBondingAnswer {
  const p = generateProblem('covalentBonding', templateId, seed)
  if (p.answer.type !== 'covalentBonding') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

type Stage = CovalentBondingAnswer['stages'][number]

/** True when the surface leaks the answer AND does not show the part's whole option set. */
function singlesOut(stage: Stage, surface: string, answer: string): boolean {
  if (!answerLeaks(surface, answer)) return false
  const options = stage.kind === 'choice' ? (stage.choices ?? []).map((c) => c.text) : stage.check.kind === 'angle' ? ANGLES : []
  return !(options.length >= 2 && options.every((option) => answerLeaks(surface, option)))
}

function tail(example: string): string {
  return example.split(/=|→/).pop()!.trim()
}

describe('surfaces she sees while answering never single out an answer', () => {
  it(
    'no hint, nudge, prompt, witness, catalog title+lesson, catalog example or rule card does, over 1000 seeds',
    () => {
      const clashes: string[] = []
      for (const templateId of TEMPLATES) {
        for (let seed = 1; seed <= 1000; seed++) {
          const answer = answerOf(templateId, seed)
          for (const stage of answer.stages) {
            const answers = [stage.answerText, ...(stage.accept ?? [])]
            const surfaces: [string, string][] = [
              ['hint', stage.hint],
              ['nudge', stage.nudge],
              ['prompt', answer.prompt],
            ]
            for (const trap of stage.traps) {
              const info = ERROR_PATTERNS[trap.id]
              surfaces.push([`${trap.id} witness`, trap.witness])
              // Title and lesson are always shown with the caught monster.
              surfaces.push([`${trap.id} catalog`, `${info.title} ${info.lesson}`])
              // All cb_ ids are minted here, so their wrong → right examples are held to the
              // strict rule: clean (or a complete listing) without the flow's blanking.
              for (const piece of [info.example, tail(info.example)]) {
                for (const text of answers) {
                  if (singlesOut(stage, piece, text)) clashes.push(`${templateId}/${seed} ${stage.id}=${text}: ${trap.id} example "${piece}"`)
                }
              }
            }
            for (const id of new Set([stage.ruleCard, ...answer.ruleCards])) {
              const card = CB_RULES.find((item) => item.id === id)
              // The whole card is what she sees on the ladder, so the complete-listing rule
              // applies to the card as one surface.
              surfaces.push([id, `${card?.title ?? ''} ${card?.body ?? ''} ${card?.example ?? ''}`])
            }
            for (const [name, text] of surfaces) {
              for (const value of answers) {
                if (singlesOut(stage, text, value)) clashes.push(`${templateId}/${seed} ${stage.id}=${value}: ${name}`)
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
