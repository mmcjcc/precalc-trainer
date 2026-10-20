/** Words for the rewards: catalog titles, problem-type titles, and the lines of a finished problem's XP. */
import { MODULES, allTemplates, randomSeed, type ModuleDef, type TemplateDef } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import { defaultKnobs, flagsFromKnobs, problemPath } from '@/problem/url'
import type { ErrorPatternId } from '@/shared/types'
import type { RingLevel, XpAward } from '@/store'

/** A named mistake's title from the error catalog. */
export function patternTitle(id: string): string {
  return id in ERROR_PATTERNS ? ERROR_PATTERNS[id as ErrorPatternId].title : id.replace(/_/g, ' ')
}

let byTemplate: { size: number; map: Map<string, { module: ModuleDef; template: TemplateDef }> } | null = null

/** The registered module and template of a problem type (skill = template id), or null (a drill family, a retired id). */
export function templateOfSkill(skill: string): { module: ModuleDef; template: TemplateDef } | null {
  if (!byTemplate || byTemplate.size !== MODULES.length) {
    const map = new Map<string, { module: ModuleDef; template: TemplateDef }>()
    for (const entry of allTemplates()) map.set(entry.template.id, entry)
    byTemplate = { size: MODULES.length, map }
  }
  return byTemplate.map.get(skill) ?? null
}

export function skillTitle(skill: string): string {
  return templateOfSkill(skill)?.template.title ?? skill
}

/** A fresh problem of this type at its default difficulty, or null when the type is not a registered template. */
export function practicePath(skill: string): string | null {
  const found = templateOfSkill(skill)
  if (!found) return null
  return problemPath(found.module.id, found.template.id, randomSeed(), flagsFromKnobs(defaultKnobs(found.template.knobs)))
}

export const RING_WORD: Record<RingLevel, string> = {
  new: 'New',
  practiced: 'Practiced',
  solid: 'Solid',
  mastered: 'Mastered',
}

export interface AwardLine {
  key: string
  label: string
  xp: number
  /** Paid at half (a mastered type, not due for review yet). */
  half: boolean
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/**
 * One finished problem's XP as the lines that earned it, in the order she did them: the mistakes she caught and
 * fixed, what was right the first time, the finish, the no-hints bonus, then a squashed mistake and a new mastery.
 */
export function awardLines(awards: readonly XpAward[], typeTitle: string): AwardLine[] {
  const lines: AwardLine[] = []
  const group = (key: string, label: (n: number) => string, of: readonly XpAward[]) => {
    if (of.length === 0) return
    lines.push({ key, label: label(of.length), xp: of.reduce((s, a) => s + a.xp, 0), half: of.some((a) => a.half) })
  }
  const kind = (k: XpAward['kind']) => awards.filter((a) => a.kind === k)
  const fixed = awards.filter((a) => a.kind === 'line_fixed' || a.kind === 'part_fixed')
  group('fixed', (n) => (n === 1 ? 'Caught and fixed a mistake' : `Caught and fixed ${n} mistakes`), fixed)
  group('lines', (n) => (n === 1 ? 'A line right first try' : `${n} lines right first try`), kind('line'))
  group('picked', (n) => (n === 1 ? 'A line picked right' : `${n} lines picked right`), kind('line_picked'))
  const parts = kind('part')
  for (const a of parts.filter((p) => p.part !== undefined)) group(`part ${a.part}`, () => `${a.part} right first try`, [a])
  const plain = parts.filter((p) => p.part === undefined)
  // A problem with one answer and nothing else to it: "Answer", not "part".
  const single = plain.length === 1 && kind('line').length === 0 && kind('line_picked').length === 0 && fixed.length === 0
  group('parts', (n) => (single ? 'Answer right first try' : plural(n, 'A part right first try', `${n} parts right first try`)), plain)
  group('finish', () => 'Problem finished', kind('finish'))
  group('no_hints', () => 'No hints', kind('no_hints'))
  for (const a of kind('squash')) group(`squash ${a.pattern}`, () => `Squashed: ${patternTitle(a.pattern ?? '')}`, [a])
  group('mastered', () => `Mastered: ${typeTitle}`, kind('mastered'))
  return lines
}
