/**
 * Grades one part of a periodic-table problem. A named mistake is whatever that slip produces
 * for THIS problem, compared exactly. A candidate equal to the right answer is never used.
 */
import type { PeriodicAnswer, PtCheck, PtDirection, PtStageId } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'
import { elementBySymbol, elementByZ, ELEMENTS, type ElementInfo } from '@/engine/chem/elements'
import {
  answerLeaks,
  blockOf,
  classOf,
  configurationOf,
  directed,
  familyOf,
  formatSymbols,
  IONIZATION_EXCEPTION_PAIRS,
  ionLabel,
  isoOrder,
  largerIsAtom,
  listTokens,
  orderByData,
  orderByTrend,
  parseConfiguration,
  parseList,
  parseSpecies,
  sameSet,
  sameSpecies,
  speciesKey,
  speciesLabel,
  strictDataOrder,
  symbolOf,
  trendAllowed,
  valenceFromGroup,
  valenceOf,
  type BlockName,
  type Species,
} from './facts'
import { PT_RULES, WHY_TEXT } from './rules'

export const PT_KEYS: Record<PtStageId, string> = { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e' }

export const PT_MISTAKE_IDS = [
  'pt_trend_reversed',
  'pt_radius_like_ionization',
  'pt_group_number_valence',
  'pt_hydrogen_metal',
  'pt_helium_p_block',
  'pt_cation_larger',
  'pt_anion_smaller',
  'pt_isoelectronic_electron_count',
  'pt_period_as_valence',
  'pt_f_as_d_block',
  'pt_helium_octet',
  'pt_valence_is_atomic_number',
  'pt_valence_is_period',
  'pt_alkaline_called_alkali',
  'pt_alkali_called_alkaline',
  'pt_metalloid_called_metal',
  'pt_metal_called_metalloid',
  'pt_why_shells_across_period',
  'pt_why_shielding_same_shell',
  'pt_why_protons_down_group',
] as const satisfies readonly ErrorPatternId[]

export type PtMistakeId = (typeof PT_MISTAKE_IDS)[number]

export type PtGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }
  | { verdict: 'mistake'; mistake: PtMistakeId; witness: string; message: string }

export interface PtTrap {
  id: PtMistakeId
  text: string
  witness: string
}

const CORRECT = "That's right."
const WRONG = "That doesn't match this problem."
const WHOLE = 'Type a whole number.'
const LIST = 'List every symbol in the question, separated by commas.'
const CHOOSE = 'Choose one.'
const UNKNOWN = "One of those symbols isn't an element, so this doesn't count yet."
const BLOCK_MSG = 'Type one block letter.'

const NONE = new Set(['none', 'no group', 'no column', 'ungrouped'])

export function exampleShowsAnswer(example: string, answerText: string): boolean {
  return answerLeaks(example, answerText)
}

export function ptWork(answer: PeriodicAnswer, entries: Record<string, string> | undefined): string[] {
  if (!entries) return []
  const lines: string[] = []
  for (const stage of answer.stages) {
    const value = entries[PT_KEYS[stage.id]]?.trim()
    if (value) lines.push(`${stage.label}: ${value}`)
  }
  return lines
}

function phrase(text: string): string {
  return text.trim().toLowerCase().replace(/−/g, '-').replace(/\./g, '').replace(/\s+/g, ' ')
}

function parseWhole(text: string): number | null {
  let t = phrase(text)
  t = t.replace(/^(period|group|row|column|valence|electrons)\s*[:=]?\s*/, '')
  t = t.replace(/\s*electrons$/, '')
  t = t.replace(/(st|nd|rd|th)$/, '')
  if (!/^[+-]?\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isInteger(n) ? n : null
}

function canonNumber(text: string, allowNone: boolean): string | null {
  if (allowNone && NONE.has(phrase(text))) return 'none'
  const n = parseWhole(text)
  return n == null ? null : String(n)
}

function parseBlock(text: string): BlockName | null {
  const t = text.trim().toLowerCase().replace(/block/g, '').replace(/[^a-z]/g, '')
  if (t === 's' || t === 'p' || t === 'd' || t === 'f') return t
  return null
}

function matchChoice(stage: PeriodicAnswer['stages'][number], text: string): string | null {
  const raw = text.trim()
  if (!raw) return null
  const choices = stage.choices ?? []
  const exact = choices.find((choice) => choice.id === raw || choice.text === raw)
  if (exact) return exact.id
  const lower = raw.toLowerCase()
  const folded = choices.find((choice) => choice.id.toLowerCase() === lower || choice.text.toLowerCase() === lower)
  if (folded) return folded.id
  const parsed = parseSpecies(raw)
  if (!parsed) return null
  const bySpecies = choices.find((choice) => {
    const choiceSpecies = parseSpecies(choice.id)
    return choiceSpecies != null && speciesKey(choiceSpecies) === speciesKey(parsed)
  })
  return bySpecies?.id ?? null
}

function correct(message = CORRECT): PtGrade {
  return { verdict: 'correct', message }
}

function wrong(): PtGrade {
  return { verdict: 'wrong', message: WRONG }
}

function invalid(message: string): PtGrade {
  return { verdict: 'invalid', message }
}

function mistake(trap: PtTrap): PtGrade {
  return { verdict: 'mistake', mistake: trap.id, witness: trap.witness, message: trap.witness }
}

function numberAnswers(stage: PeriodicAnswer['stages'][number], allowNone: boolean): Set<string> {
  const out = new Set<string>()
  const main = canonNumber(stage.answerText, allowNone)
  if (main != null) out.add(main)
  for (const alt of stage.accept ?? []) {
    const canon = canonNumber(alt, allowNone)
    if (canon != null) out.add(canon)
  }
  return out
}

function gradeNumber(stage: PeriodicAnswer['stages'][number], text: string, allowNone: boolean): PtGrade {
  const canon = canonNumber(text, allowNone)
  if (canon == null) return invalid(WHOLE)
  if (numberAnswers(stage, allowNone).has(canon)) return correct()
  for (const trap of stage.traps) {
    if (canonNumber(trap.text, allowNone) === canon) return mistake(trap as PtTrap)
  }
  return wrong()
}

function gradeBlock(stage: PeriodicAnswer['stages'][number], text: string): PtGrade {
  const canon = parseBlock(text)
  if (!canon) return invalid(BLOCK_MSG)
  const accepted = new Set<string>([parseBlock(stage.answerText) ?? ''])
  for (const alt of stage.accept ?? []) accepted.add(parseBlock(alt) ?? '')
  if (accepted.has(canon)) return correct()
  for (const trap of stage.traps) {
    if (parseBlock(trap.text) === canon) return mistake(trap as PtTrap)
  }
  return wrong()
}

function gradeChoice(stage: PeriodicAnswer['stages'][number], text: string): PtGrade {
  const id = matchChoice(stage, text)
  if (!id) return invalid(CHOOSE)
  if (id === stage.answerText || (stage.accept ?? []).includes(id)) return correct()
  for (const trap of stage.traps) {
    if (trap.text === id) return mistake(trap as PtTrap)
  }
  return wrong()
}

function expectedSpecies(stage: PeriodicAnswer['stages'][number]): Species[] | null {
  return parseList(stage.answerText)
}

function gradeRank(stage: PeriodicAnswer['stages'][number], text: string): PtGrade {
  const tokens = listTokens(text)
  if (tokens.length < 2) return invalid(LIST)
  const parsed: Species[] = []
  for (const token of tokens) {
    const sp = parseSpecies(token)
    if (!sp) {
      const letters = token.replace(/[^A-Za-z]/g, '')
      if (/^[A-Za-z]{1,2}$/.test(letters)) {
        const raw = letters.length === 1 ? letters.toUpperCase() : letters[0]!.toUpperCase() + letters[1]!.toLowerCase()
        if (!elementBySymbol(raw)) return invalid(UNKNOWN)
      }
      return invalid(LIST)
    }
    parsed.push(sp)
  }
  const expected = expectedSpecies(stage)
  if (!expected) return invalid(LIST)
  if (!sameSet(parsed, expected)) return invalid(LIST)
  if (sameSpecies(parsed, expected)) return correct()
  for (const trap of stage.traps) {
    const want = parseList(trap.text)
    if (want && sameSpecies(parsed, want)) return mistake(trap as PtTrap)
  }
  return wrong()
}

export function gradePtStage(answer: PeriodicAnswer, stageId: PtStageId, text: string): PtGrade {
  const stage = answer.stages.find((item) => item.id === stageId)
  if (!stage) return invalid(WRONG)
  switch (stage.check.kind) {
    case 'period':
    case 'valence':
    case 'valence-group':
    case 'config-valence':
    case 'config-period':
      return gradeNumber(stage, text, false)
    case 'group':
      return gradeNumber(stage, text, true)
    case 'block':
    case 'config-block':
      return gradeBlock(stage, text)
    case 'class':
    case 'family':
    case 'larger':
    case 'why':
      return gradeChoice(stage, text)
    case 'rank':
    case 'iso':
      return gradeRank(stage, text)
    default: {
      const never: never = stage.check
      return never
    }
  }
}

function elementOf(z: number): ElementInfo {
  const el = elementByZ(z)
  if (!el) throw new Error(`no element Z ${z}`)
  return el
}

function totalElectrons(config: string): number {
  let n = 0
  for (const bit of config.trim().split(/\s+/)) {
    const match = /([1-9]\d*)$/.exec(bit)
    if (match) n += Number(match[1])
  }
  return n
}

function elementForConfig(config: string): ElementInfo | null {
  const parsed = parseConfiguration(config)
  if (!parsed) return null
  for (const el of ELEMENTS) {
    if (el.z > 54) break
    if (valenceOf(el) == null) continue
    if (configurationOf(el.z).text === parsed.text) return el
  }
  return null
}

function opposite(direction: PtDirection): PtDirection {
  return direction === 'increasing' ? 'decreasing' : 'increasing'
}

/** The answer string for a check, taken from the tables and the trend rules. */
export function canonicalAnswer(check: PtCheck): string {
  switch (check.kind) {
    case 'period':
      return String(elementOf(check.z).period)
    case 'group': {
      const group = elementOf(check.z).group
      return group == null ? 'none' : String(group)
    }
    case 'block':
      return blockOf(elementOf(check.z))
    case 'class':
      return classOf(elementOf(check.z))
    case 'family': {
      const family = familyOf(elementOf(check.z))
      if (!family) throw new Error(`Z ${check.z} has no family`)
      return family
    }
    case 'valence': {
      const valence = valenceOf(elementOf(check.z))
      if (valence == null) throw new Error(`Z ${check.z} has no valence count`)
      return String(valence)
    }
    case 'valence-group': {
      const valence = valenceFromGroup(check.group)
      if (valence == null) throw new Error(`group ${check.group} has no valence count`)
      return String(valence)
    }
    case 'config-valence':
    case 'config-block':
    case 'config-period': {
      const config = parseConfiguration(check.config)
      if (!config) throw new Error(`unreadable configuration ${check.config}`)
      if (check.kind === 'config-valence') return String(config.valence)
      if (check.kind === 'config-block') return config.block
      return String(config.period)
    }
    case 'rank': {
      const increasing = check.property === 'metallic' ? orderByTrend(check.zs, 'metallic') : orderByData(check.zs, check.property)
      return formatSymbols(directed(increasing, check.direction))
    }
    case 'larger': {
      const symbol = symbolOf(check.z)
      return largerIsAtom(check.charge) ? symbol : ionLabel(symbol, check.charge)
    }
    case 'iso':
      return isoOrder(check.ions, check.direction).map(speciesLabel).join(', ')
    case 'why':
      return WHY_TEXT[check.reason]
    default: {
      const never: never = check
      return never
    }
  }
}

function addTrap(out: PtTrap[], answerText: string, id: PtMistakeId, text: string, witness: string) {
  if (!text || text === answerText) return
  if (out.some((trap) => trap.text === text)) return
  out.push({ id, text, witness })
}

function valenceTraps(out: PtTrap[], answerText: string, el: ElementInfo | null, period: number | null, total: number | null) {
  if (el?.symbol === 'He') {
    addTrap(out, answerText, 'pt_helium_octet', '8', 'You gave helium the later noble gases count. The only shell of helium holds a pair.')
  }
  if (el && el.group != null && el.group >= 13) {
    addTrap(out, answerText, 'pt_group_number_valence', String(el.group), 'You gave the column number. On that side of the table the outer shell is not the column number.')
  }
  if (period != null) {
    addTrap(out, answerText, 'pt_valence_is_period', String(period), 'You gave the row number. Valence electrons are the outer shell, not the row.')
  }
  if (total != null) {
    addTrap(out, answerText, 'pt_valence_is_atomic_number', String(total), 'You counted every electron in the atom. Valence electrons are only the outer shell.')
  }
}

/** Every named slip this check can produce, in detection order. Equals to the answer are dropped. */
export function trapsFor(check: PtCheck): PtTrap[] {
  const answerText = canonicalAnswer(check)
  const out: PtTrap[] = []
  switch (check.kind) {
    case 'period': {
      const el = elementOf(check.z)
      const valence = valenceOf(el)
      if (valence != null) {
        addTrap(out, answerText, 'pt_period_as_valence', String(valence), 'You gave the number of electrons in the outer shell. The period is the row, not that count.')
      }
      break
    }
    case 'group':
      break
    case 'block': {
      const el = elementOf(check.z)
      if (el.symbol === 'He') {
        addTrap(out, answerText, 'pt_helium_p_block', 'p', 'You put helium in the right-hand block. Its only shell is not that kind of subshell.')
      }
      if (blockOf(el) === 'f') {
        addTrap(out, answerText, 'pt_f_as_d_block', 'd', 'You called the bottom rows the middle block. Those rows are their own block.')
      }
      break
    }
    case 'class': {
      const el = elementOf(check.z)
      if (el.symbol === 'H') {
        addTrap(out, answerText, 'pt_hydrogen_metal', 'metal', 'You grouped hydrogen with the losers under it. It belongs with the right side of the staircase.')
      } else if (classOf(el) === 'metalloid') {
        addTrap(out, answerText, 'pt_metalloid_called_metal', 'metal', 'You called this staircase element a loser. The staircase elements are the in-between group.')
      } else if (classOf(el) === 'metal') {
        addTrap(out, answerText, 'pt_metal_called_metalloid', 'metalloid', 'You called this a staircase element. It sits with the losers, not on the staircase.')
      }
      break
    }
    case 'family': {
      const el = elementOf(check.z)
      if (familyOf(el) === 'alkali metals') {
        addTrap(out, answerText, 'pt_alkali_called_alkaline', 'alkaline earth metals', 'You used the second column family. This element is in the first column, under hydrogen.')
      } else if (familyOf(el) === 'alkaline earth metals') {
        addTrap(out, answerText, 'pt_alkaline_called_alkali', 'alkali metals', 'You used the first column family. This element is in the second column.')
      }
      break
    }
    case 'valence': {
      const el = elementOf(check.z)
      valenceTraps(out, answerText, el, el.period, el.z)
      break
    }
    case 'valence-group': {
      if (check.group >= 13) {
        addTrap(out, answerText, 'pt_group_number_valence', String(check.group), 'You gave the column number. On that side of the table the outer shell is not the column number.')
      }
      break
    }
    case 'config-valence': {
      const config = parseConfiguration(check.config)
      const el = elementForConfig(check.config)
      if (config) valenceTraps(out, answerText, el, config.period, totalElectrons(check.config))
      break
    }
    case 'config-block': {
      const config = parseConfiguration(check.config)
      const el = elementForConfig(check.config)
      if (el?.symbol === 'He' || config?.text === '1s2') {
        addTrap(out, answerText, 'pt_helium_p_block', 'p', 'You put helium in the right-hand block. Its only shell is not that kind of subshell.')
      }
      if (config?.block === 'f') {
        addTrap(out, answerText, 'pt_f_as_d_block', 'd', 'You called the bottom rows the middle block. Those rows are their own block.')
      }
      break
    }
    case 'config-period': {
      const config = parseConfiguration(check.config)
      if (config) {
        addTrap(out, answerText, 'pt_period_as_valence', String(config.valence), 'You gave the number of electrons in the outer shell. The period is the row, not that count.')
      }
      break
    }
    case 'rank': {
      const increasing = check.property === 'metallic' ? orderByTrend(check.zs, 'metallic') : orderByData(check.zs, check.property)
      if (check.property === 'radius' || check.property === 'ionization') {
        const other = check.property === 'radius' ? 'ionization' : 'radius'
        const otherIncreasing = strictDataOrder(check.zs, other)
        if (otherIncreasing) {
          const witness =
            check.property === 'radius'
              ? 'You ordered them the way first ionization energy runs, not the way atomic radius runs.'
              : 'You ordered them the way atomic radius runs, not the way first ionization energy runs.'
          addTrap(out, answerText, 'pt_radius_like_ionization', formatSymbols(directed(otherIncreasing, check.direction)), witness)
        }
      }
      addTrap(out, answerText, 'pt_trend_reversed', formatSymbols(directed(increasing, opposite(check.direction))), 'You listed them from the other end of the property.')
      break
    }
    case 'larger': {
      const symbol = symbolOf(check.z)
      if (check.charge > 0) {
        addTrap(out, answerText, 'pt_cation_larger', ionLabel(symbol, check.charge), 'You picked the positive ion. Losing electrons pulls the cloud in, so that ion is not the larger one.')
      } else if (check.charge < 0) {
        addTrap(out, answerText, 'pt_anion_smaller', symbol, 'You picked the atom. Gaining electrons spreads the cloud out, so the atom is not the larger one.')
      }
      break
    }
    case 'iso': {
      const reversed = isoOrder(check.ions, opposite(check.direction)).map(speciesLabel).join(', ')
      addTrap(
        out,
        answerText,
        'pt_isoelectronic_electron_count',
        reversed,
        'You ordered them by how many electrons the neutral atoms have. Every ion here has the same electron count, so the proton count is what changes the size.',
      )
      break
    }
    case 'why': {
      if (check.reason === 'protons') {
        addTrap(out, answerText, 'pt_why_shells_across_period', WHY_TEXT.shells, 'You picked a new shell. These two elements share a row, so they have the same number of shells.')
        addTrap(out, answerText, 'pt_why_shielding_same_shell', WHY_TEXT.shielding, 'You picked the inner electrons. Across one row those inner electrons do not change.')
      } else {
        addTrap(out, answerText, 'pt_why_protons_down_group', WHY_TEXT.protons, 'You picked the across-the-row pull. These two sit in one column, so that pull on one shared shell is not what changes.')
      }
      break
    }
    default: {
      const never: never = check
      return never
    }
  }
  return out
}

function cardBlob(id: string): string {
  const card = PT_RULES.find((item) => item.id === id)
  return `${card?.title ?? ''} ${card?.body ?? ''} ${card?.example ?? ''}`
}

function leak(where: string, surface: string, text: string, answer: string) {
  if (answer && answerLeaks(text, answer)) throw new Error(`${where}: ${surface} contains the answer ${answer}`)
}

/** The generator calls this for every seed. A bad problem throws instead of shipping. */
export function assertPeriodic(where: string, answer: PeriodicAnswer): void {
  if (answer.stages.length === 0) throw new Error(`${where}: no parts`)
  const ids = new Set<string>()
  for (const stage of answer.stages) {
    if (ids.has(stage.id)) throw new Error(`${where}: repeated part ${stage.id}`)
    ids.add(stage.id)
    const expected = canonicalAnswer(stage.check)
    if (stage.answerText !== expected) throw new Error(`${where}: ${stage.id} stored ${stage.answerText} but the tables say ${expected}`)
    const right = gradePtStage(answer, stage.id, stage.answerText)
    if (right.verdict !== 'correct') throw new Error(`${where}: ${stage.id} answer graded ${right.verdict}`)
    for (const alt of stage.accept ?? []) {
      const graded = gradePtStage(answer, stage.id, alt)
      if (graded.verdict !== 'correct') throw new Error(`${where}: ${stage.id} accept ${alt} graded ${graded.verdict}`)
    }
    const trapTexts = new Set<string>()
    for (const trap of stage.traps) {
      if (trap.text === stage.answerText) throw new Error(`${where}: trap ${trap.id} equals the answer`)
      if (trapTexts.has(trap.text)) throw new Error(`${where}: two traps share ${trap.text}`)
      trapTexts.add(trap.text)
      const graded = gradePtStage(answer, stage.id, trap.text)
      if (graded.verdict !== 'mistake' || graded.mistake !== trap.id) {
        throw new Error(`${where}: trap ${trap.id} (${trap.text}) graded ${graded.verdict}${graded.verdict === 'mistake' ? ` ${graded.mistake}` : ''}`)
      }
      leak(where, `${trap.id} witness`, trap.witness, stage.answerText)
      for (const alt of stage.accept ?? []) leak(where, `${trap.id} witness`, trap.witness, alt)
    }
    const surfaces = [stage.hint, stage.nudge]
    for (const surface of surfaces) {
      leak(where, stage.id, surface, stage.answerText)
      for (const alt of stage.accept ?? []) leak(where, stage.id, surface, alt)
    }
    if (!answer.prompt.startsWith('Which is larger')) {
      leak(where, 'prompt', answer.prompt, stage.answerText)
      for (const alt of stage.accept ?? []) leak(where, 'prompt', answer.prompt, alt)
    }
    for (const ruleId of new Set([stage.ruleCard, ...answer.ruleCards])) {
      const blob = cardBlob(ruleId)
      leak(where, ruleId, blob, stage.answerText)
      for (const alt of stage.accept ?? []) leak(where, ruleId, blob, alt)
    }
    if (stage.check.kind === 'rank') {
      const elements = stage.check.zs.map((z) => elementOf(z))
      if (stage.check.property !== 'ionization' && elements.some((el) => el.group === 18)) {
        throw new Error(`${where}: noble gas in a ${stage.check.property} ranking`)
      }
      if (stage.check.property === 'ionization') {
        const symbols = new Set(elements.map((el) => el.symbol))
        for (const [left, rightSymbol] of IONIZATION_EXCEPTION_PAIRS) {
          if (symbols.has(left) && symbols.has(rightSymbol)) throw new Error(`${where}: ionization exception ${left}/${rightSymbol}`)
        }
      }
      for (const el of elements) {
        if (!trendAllowed(el, stage.check.property)) throw new Error(`${where}: ${el.symbol} is not allowed in a ${stage.check.property} ranking`)
      }
      if (stage.check.property !== 'metallic') {
        const data = formatSymbols(directed(orderByData(stage.check.zs, stage.check.property), stage.check.direction))
        const trend = formatSymbols(directed(orderByTrend(stage.check.zs, stage.check.property), stage.check.direction))
        if (data !== stage.answerText || trend !== stage.answerText) throw new Error(`${where}: ranking does not match the table and the trend`)
      }
    }
  }
  if (answer.trap) {
    const stage = answer.stages.find((item) => item.id === answer.trapStage)
    if (!stage || answer.trapAnswer == null) throw new Error(`${where}: promised trap has no part`)
    const graded = gradePtStage(answer, stage.id, answer.trapAnswer)
    if (graded.verdict !== 'mistake' || graded.mistake !== answer.trap) {
      throw new Error(`${where}: promised ${answer.trap} graded ${graded.verdict}`)
    }
  }
}
