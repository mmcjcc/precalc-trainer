/**
 * Shared instance builder for the atomic-structure templates.
 *
 * A template picks a scenario (the trap it is built around) with the seeded rng, then draws a
 * question. A draw returns null when the numbers do not show the trap (or, for the isotope
 * averages, when the sig-fig engine reports any issue with the task); the template then draws again
 * from the SAME rng stream, so a seed stays fully deterministic. The answer key, the "show the
 * answer" text and the worked explanation all come from the ENGINE.
 */
import type { Rng } from '@/content/rng'
import { makeRng } from '@/content/rng'
import type { AnswerSpec, AtomPeriodicEntry, DifficultyKnobs, ProblemInstance, RuleCardId, TemplateDef } from '@/content/types'
import {
  evaluateSigFigTask,
  explainAbundance,
  explainAverageMass,
  explainNotation,
  explainParticles,
  hyphenName,
  nuclearSymbolText,
  particleCounts,
  solveAbundance,
} from '@/engine'
import type { AtomQuestion, CalcPanels } from '@/shared/types'
import { elementByZ } from '@/engine/chem/elements'
import { pickWeighted, type Weighted } from '../sigFigs/numbers'

export const AT_MODULE_ID = 'atoms' as const

export interface AtomDraft {
  question: AtomQuestion
  prompt: string
  context: string
  latex?: string
  periodic?: AtomPeriodicEntry[]
  unit: string
  trap: string
  nudge: string
  ruleCards: RuleCardId[]
  params?: Record<string, number | string | boolean>
}

export interface AtomScenario {
  id: string
  weight: number
  /** A usable draft, or null to draw again. */
  draw: (rng: Rng) => AtomDraft | null
}

export interface AtomTemplateSpec {
  id: string
  title: string
  description: string
  version: number
  instructions: string
  scenarios: AtomScenario[]
  /** Hand-checked draft used only if every draw fails (never seen in the tested seed range). */
  fallback: AtomDraft
}

const MAX_DRAWS = 400

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

export function periodicEntry(z: number): AtomPeriodicEntry {
  const el = elementByZ(z)
  if (!el) throw new Error(`atoms: no element ${z}`)
  return { z: el.z, symbol: el.symbol, name: el.name }
}

/** Neighbors on the periodic table from lo to hi (clipped to the table). */
export function periodicStrip(lo: number, hi: number): AtomPeriodicEntry[] {
  const out: AtomPeriodicEntry[] = []
  for (let z = Math.max(1, lo); z <= Math.min(92, hi); z++) out.push(periodicEntry(z))
  return out
}

/** The answer key (per box), the pretty answer and the worked explanation, all from the engine. */
export function answerKey(q: AtomQuestion): { expected: string[]; expectedDisplay: string; reveal: string[] } {
  switch (q.kind) {
    case 'particles': {
      const c = particleCounts(q.particle)
      return {
        expected: [String(c.protons), String(c.neutrons), String(c.electrons)],
        expectedDisplay: `${plural(c.protons, 'proton')}, ${plural(c.neutrons, 'neutron')}, ${plural(c.electrons, 'electron')}`,
        reveal: explainParticles(q),
      }
    }
    case 'notation': {
      const p = q.particle
      const charge = p.charge === 0 ? '' : `${Math.abs(p.charge) === 1 ? '' : Math.abs(p.charge)}${p.charge > 0 ? '+' : '-'}`
      return {
        expected: [p.symbol, String(p.massNumber), String(p.z), charge],
        expectedDisplay: p.charge === 0 ? `${nuclearSymbolText(p)} (${hyphenName(p)})` : nuclearSymbolText(p),
        reveal: explainNotation(q),
      }
    }
    case 'avgmass': {
      const ev = evaluateSigFigTask(q.task)
      return { expected: [ev.expected.text], expectedDisplay: `${ev.expected.display} u`, reveal: explainAverageMass(q) }
    }
    case 'abundance': {
      const { answer } = solveAbundance(q)
      return {
        expected: [answer[0], answer[1]],
        expectedDisplay: `${answer[0]}% ${q.isotopes[0].label}, ${answer[1]}% ${q.isotopes[1].label}`,
        reveal: explainAbundance(q),
      }
    }
  }
}

export function makeAtomTemplate(spec: AtomTemplateSpec): TemplateDef {
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    version: spec.version,
    knobs: [],
    generate(seed, knobs: DifficultyKnobs = {}): ProblemInstance {
      const rng = makeRng(seed)
      const options: Weighted<AtomScenario>[] = spec.scenarios.map((s) => ({ weight: s.weight, value: s }))
      const scenario = pickWeighted(rng, options)
      let draft: AtomDraft | null = null
      let draws = 0
      while (draws < MAX_DRAWS && draft === null) {
        draws++
        draft = scenario.draw(rng)
      }
      let fallback = false
      if (draft === null) {
        fallback = true
        draft = spec.fallback
      }
      const key = answerKey(draft.question)
      const ruleCards = draft.ruleCards
      const answer: Extract<AnswerSpec, { type: 'atoms' }> = {
        type: 'atoms',
        question: draft.question,
        prompt: draft.prompt,
        context: draft.context,
        periodic: draft.periodic ?? [],
        unit: draft.unit,
        expected: key.expected,
        expectedDisplay: key.expectedDisplay,
        nudge: draft.nudge,
        ruleCard: ruleCards[0]!,
        ruleCards,
        reveal: key.reveal,
        trap: draft.trap,
      }
      if (draft.latex !== undefined) answer.latex = draft.latex
      return {
        id: `${AT_MODULE_ID}/${spec.id}@${spec.version}/${(seed >>> 0).toString(36)}`,
        moduleId: AT_MODULE_ID,
        templateId: spec.id,
        skill: spec.id,
        genVersion: spec.version,
        seed,
        knobs,
        kind: 'atoms',
        title: spec.title,
        instructions: spec.instructions,
        // Plain words, NOT app syntax: the atoms flow prints answer.prompt itself.
        statementText: draft.prompt,
        vars: [],
        start: null,
        canonical: [],
        answer,
        graph: { kind: 'none' },
        calc: NO_CALC,
        params: { ...(draft.params ?? {}), scenario: scenario.id, trap: draft.trap, draws, fallback },
      }
    },
  }
}
