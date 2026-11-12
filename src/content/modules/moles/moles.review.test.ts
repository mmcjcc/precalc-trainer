/**
 * Everything she can read while a part is still open — hint, nudge, label, prompt, the witness of
 * every named slip, the caught monster's catalog title, lesson and example, and every rule card of
 * the problem — never singles out that part's answer, over 1000 seeds per template. Numbers are
 * compared by value; a choice is clean when the surface lists every option. Catalog and card
 * examples work only the three reserved substances.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { MoleAnswer } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { ALL_RULES, cardBlob, MO_MISTAKE_IDS, stageLeaks } from './grade'
import { DRAWABLE, show } from './facts'

const HEAVY = 120_000
const TEMPLATES = ['mo.particles', 'mo.molarMass', 'mo.mass', 'mo.gas'] as const

function answerOf(templateId: string, seed: number): MoleAnswer {
  const p = generateProblem('moles', templateId, seed)
  if (p.answer.type !== 'mole') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

function tail(example: string): string {
  return example.split(/=|→/).pop()!.trim()
}

describe('surfaces she sees while answering never single out an answer', () => {
  for (const templateId of TEMPLATES) {
    it(
      `${templateId}: no hint, nudge, label, prompt, witness, catalog title, lesson or example, or rule card does, over 1000 seeds`,
      () => {
        const clashes: string[] = []
        for (let seed = 1; seed <= 1000; seed++) {
          const answer = answerOf(templateId, seed)
          for (const stage of answer.stages) {
            const surfaces: [string, string][] = [
              ['hint', stage.hint],
              ['nudge', stage.nudge],
              ['label', stage.label],
              ['prompt', answer.prompt],
            ]
            for (const trap of stage.traps) {
              const info = ERROR_PATTERNS[trap.id]
              surfaces.push([`${trap.id} witness`, trap.witness])
              surfaces.push([`${trap.id} catalog`, `${info.title} ${info.lesson}`])
              surfaces.push([`${trap.id} example`, info.example], [`${trap.id} example tail`, tail(info.example)])
            }
            for (const id of new Set([stage.ruleCard, ...answer.ruleCards])) surfaces.push([id, cardBlob(id)])
            for (const [name, text] of surfaces) if (stageLeaks(stage, text)) clashes.push(`${templateId}/${seed} ${stage.id}=${stage.answerText}: ${name}`)
          }
        }
        expect(clashes.slice(0, 12)).toEqual([])
      },
      HEAVY,
    )
  }

  it('card and catalog examples name no substance a template can draw', () => {
    const examples = [...ALL_RULES.map((c) => c.example ?? ''), ...MO_MISTAKE_IDS.map((id) => ERROR_PATTERNS[id].example)]
    const clashes: string[] = []
    for (const example of examples) {
      for (const s of DRAWABLE) {
        const shown = show(s.key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (new RegExp(`(?<![A-Za-z0-9₀-₉(·])${shown}(?![a-z₀-₉])`).test(example)) clashes.push(`${s.key} in "${example}"`)
        if (new RegExp(`\\b${s.name.replace(/[()]/g, '\\$&')}\\b`, 'i').test(example)) clashes.push(`${s.name} in "${example}"`)
      }
    }
    expect(clashes).toEqual([])
  })
})
