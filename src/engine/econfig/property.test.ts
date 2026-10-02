/**
 * Seeded property loops for the electron-configuration core.
 *
 * - every species (36 atoms, 27 ions): the electron count is Z minus the charge; the right answer grades
 *   correct in full form and in shorthand, in filling order and in shell order, in every way of writing the
 *   counts; every listed mistake candidate differs from the right answer and grades as its own kind;
 * - 1,500 seeded draws: a species, a form, a random ORDER of its subshells and a random way of writing them
 *   grade correct, and the parser reads back Z minus the charge electrons;
 * - 3,000 seeded mutations of a right answer: the grader says correct exactly when the subshells are the
 *   right ones (an oracle that compares occupancies), is never invalid or unsupported, and the first rule
 *   that applies (nonexistent, overfilled, the count) is the mistake it names.
 */
import { describe, expect, it } from 'vitest'
import { configurationMistakes, gradeConfiguration } from './grade'
import {
  aufbau,
  econfigAtoms,
  econfigIons,
  electronConfiguration,
  nobleGasShorthand,
  occupancyOf,
  sameConfiguration,
  speciesText,
  SUBSHELL_CAPACITY,
  subshellExists,
  superscriptNumber,
  totalElectrons,
} from './model'
import { parseConfiguration } from './parse'
import { configurationText, termsText } from './text'
import type { EconfigGrade, EconfigSpecies, SubshellCount, SubshellLetter } from './types'

type Rand = () => number

/** Each loop takes 1 to 3 s alone; under a full parallel run on the dev box they can take several times that. */
const SWEEP_TIMEOUT = 120_000

function mulberry32(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function int(r: Rand, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1))
}

function pick<T>(r: Rand, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]!
}

function shuffled<T>(r: Rand, xs: readonly T[]): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(r, 0, i)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

const ALL: EconfigSpecies[] = [...econfigAtoms(), ...econfigIons()]

const STYLES = ['plain', 'caret', 'braces', 'superscript', 'upper', 'commas', 'squeezed'] as const

/** One subshell written the way a style says. */
function term(t: SubshellCount, style: (typeof STYLES)[number]): string {
  const name = `${t.n}${t.l}`
  if (style === 'caret') return `${name}^${t.count}`
  if (style === 'braces') return `${name}^{${t.count}}`
  if (style === 'superscript') return `${name}${superscriptNumber(t.count)}`
  if (style === 'upper') return `${t.n}${t.l.toUpperCase()}${t.count}`
  return `${name}${t.count}`
}

function written(core: string | null, terms: readonly SubshellCount[], style: (typeof STYLES)[number]): string {
  const glue = style === 'commas' ? ', ' : style === 'squeezed' ? '' : ' '
  const body = terms.map((t) => term(t, style)).join(glue)
  if (!core) return body
  const bracket = style === 'upper' ? `[${core.toUpperCase()}]` : `[${core}]`
  return body === '' ? bracket : `${bracket}${style === 'squeezed' ? '' : ' '}${body}`
}

const verdictOf = (g: EconfigGrade) => (g.verdict === 'mistake' ? g.mistake : g.verdict)

/** The filling order typed by hand, as far as the mutations reach (the test's own copy, not the engine's). */
const HAND_ORDER = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d']
const HAND_CAPACITY: Record<string, number> = { s: 2, p: 6, d: 10 }

/** True when no subshell holds electrons while an earlier one still has room (plain aufbau shape). */
function inOrderWithoutGaps(terms: readonly SubshellCount[]): boolean {
  const count = (name: string) => terms.find((t) => `${t.n}${t.l}` === name)?.count ?? 0
  let roomEarlier = false
  for (const name of HAND_ORDER) {
    if (roomEarlier && count(name) > 0) return false
    if (count(name) < HAND_CAPACITY[name[1]!]!) roomEarlier = true
  }
  return true
}

describe('every species', () => {
  it('holds Z minus the charge electrons, as data and as parsed text', () => {
    for (const sp of ALL) {
      const want = sp.z - sp.charge
      expect(totalElectrons(electronConfiguration(sp)), speciesText(sp)).toBe(want)
      const full = parseConfiguration(configurationText(sp))
      expect(full.ok && totalElectrons(full.value.terms)).toBe(want)
      const short = parseConfiguration(configurationText(sp, { form: 'shorthand' }))
      expect(short.ok && (short.value.core?.z ?? 0) + totalElectrons(short.value.terms)).toBe(want)
    }
  })

  it('grades correct in full form and in shorthand, in both orders, however the counts are written', () => {
    let graded = 0
    for (const sp of ALL)
      for (const form of ['full', 'shorthand'] as const)
        for (const order of ['filling', 'shell'] as const) {
          const text = configurationText(sp, { form, order })
          expect(verdictOf(gradeConfiguration(sp, text, { form })), `${speciesText(sp)} ${form} ${order}: ${text}`).toBe('correct')
          expect(verdictOf(gradeConfiguration(sp, text)), `${speciesText(sp)} either: ${text}`).toBe('correct')
          const { core, rest } = form === 'shorthand' ? nobleGasShorthand(sp, order) : { core: null, rest: electronConfiguration(sp, order) }
          for (const style of STYLES) {
            const typed = written(core?.symbol ?? null, rest, style)
            expect(verdictOf(gradeConfiguration(sp, typed, { form })), `${speciesText(sp)} ${form} ${order} ${style}: ${typed}`).toBe('correct')
            graded++
          }
        }
    expect(graded).toBe(ALL.length * 2 * 2 * STYLES.length)
  }, SWEEP_TIMEOUT)

  it('every listed mistake candidate differs from the right answer and grades as its own kind', () => {
    let candidates = 0
    const kinds = new Set<string>()
    for (const sp of ALL)
      for (const form of ['full', 'shorthand'] as const) {
        const right = occupancyOf(electronConfiguration(sp))
        const list = configurationMistakes(sp, form)!
        expect(new Set(list.map((c) => c.text)).size, `${speciesText(sp)} ${form}: distinct texts`).toBe(list.length)
        for (const c of list) {
          candidates++
          kinds.add(c.kind)
          expect(c.text, `${speciesText(sp)} ${form} ${c.kind}`).not.toBe(configurationText(sp, { form }))
          const parsed = parseConfiguration(c.text)
          expect(parsed.ok, c.text).toBe(true)
          if (parsed.ok) {
            const core = parsed.value.core
            const expanded = [...(core && core.z <= 36 ? aufbau(core.z) : []), ...parsed.value.terms]
            // Not the right configuration: other subshells, or the right subshells behind the wrong brackets.
            const sameSubshells = sameConfiguration(expanded, [...right].map(([key, count]) => ({ n: Number(key[0]), l: key[1] as SubshellLetter, count })))
            if (sameSubshells) expect(['core_wrong', 'core_not_earlier'], `${speciesText(sp)} ${c.text}`).toContain(c.kind)
          }
          const g = gradeConfiguration(sp, c.text, { form })
          expect(verdictOf(g), `${speciesText(sp)} ${form}: ${c.text}`).toBe(c.kind)
          expect(g.verdict === 'mistake' && g.witness).toBe(c.witness)
        }
      }
    expect(candidates).toBeGreaterThan(400)
    // Every configuration kind is produced for some species.
    for (const k of [
      'electron_count',
      'subshell_overfilled',
      'subshell_nonexistent',
      'filling_order',
      'exception_missed',
      'exception_misapplied',
      'ion_charge_ignored',
      'ion_wrong_direction',
      'ion_removed_from_3d',
      'ion_wrong_number',
      'core_wrong',
      'core_not_earlier',
    ])
      expect(kinds.has(k), k).toBe(true)
  }, SWEEP_TIMEOUT)

  it('the candidates that matter are listed where they should be', () => {
    const kindsOf = (s: string, form: 'full' | 'shorthand') => configurationMistakes(s, form)!.map((c) => c.kind)
    for (const s of ['Cr', 'Cu']) expect(kindsOf(s, 'shorthand'), s).toContain('exception_missed')
    for (const s of ['Sc', 'Ti', 'V', 'Mn', 'Fe', 'Co', 'Ni']) expect(kindsOf(s, 'shorthand'), s).toContain('exception_misapplied')
    for (const s of ['K', 'Ca', 'Sc', 'Fe', 'Ni', 'Cr']) expect(kindsOf(s, 'full'), s).toContain('filling_order')
    for (const sp of econfigIons()) {
      const kinds = configurationMistakes(sp, 'full')!.map((c) => c.kind)
      expect(kinds, speciesText(sp)).toContain('ion_charge_ignored')
      // Br- with two electrons added would need a 5s subshell, which is outside the model.
      if (speciesText(sp) !== 'Br-') expect(kinds, speciesText(sp)).toContain('ion_wrong_number')
      if (sp.z >= 21 && sp.z <= 30) expect(kinds, speciesText(sp)).toContain('ion_removed_from_3d')
      if (speciesText(sp) !== 'H-') expect(kinds, speciesText(sp)).toContain('ion_wrong_direction')
    }
    for (const sp of ALL) if (sp.z - sp.charge > 2) expect(configurationMistakes(sp, 'shorthand')!.map((c) => c.kind), speciesText(sp)).toContain('core_not_earlier')
  })
})

describe('seeded: right answers typed in any order and any style', () => {
  it('1,500 draws grade correct and read back the right number of electrons', () => {
    const r = mulberry32(20261001)
    for (let i = 0; i < 1500; i++) {
      const sp = pick(r, ALL)
      const form = pick(r, ['full', 'shorthand'] as const)
      const style = pick(r, STYLES)
      const { core, rest } = form === 'shorthand' ? nobleGasShorthand(sp) : { core: null, rest: electronConfiguration(sp) }
      // 'squeezed' keeps a standard order (a real student writes it left to right); the others get any order.
      const terms = style === 'squeezed' ? rest : shuffled(r, rest)
      const typed = written(core?.symbol ?? null, terms, style)
      const parsed = parseConfiguration(typed)
      expect(parsed.ok, typed).toBe(true)
      if (parsed.ok) expect((parsed.value.core?.z ?? 0) + totalElectrons(parsed.value.terms), typed).toBe(sp.z - sp.charge)
      expect(verdictOf(gradeConfiguration(sp, typed, { form })), `#${i} ${speciesText(sp)} ${form} ${style}: ${typed}`).toBe('correct')
    }
  }, SWEEP_TIMEOUT)
})

describe('seeded: mutated answers', () => {
  const EXTRA: SubshellCount[] = [
    { n: 1, l: 'p', count: 0 },
    { n: 2, l: 'd', count: 0 },
    { n: 3, l: 'f', count: 0 },
    { n: 4, l: 'd', count: 0 },
    { n: 5, l: 's', count: 0 },
  ]
  const BASE: SubshellCount[] = aufbau(36).map((t) => ({ ...t, count: 0 }))

  it('3,000 mutations: correct exactly when the subshells are right, and the first rule that applies is named', () => {
    const r = mulberry32(5)
    const seen = new Set<string>()
    let wrongAnswers = 0
    for (let i = 0; i < 3000; i++) {
      const sp = pick(r, ALL)
      const right = electronConfiguration(sp)
      const occ = occupancyOf(right)
      // Start from the right answer on the full list of subshells, then nudge one to three counts.
      const terms: SubshellCount[] = [...BASE, ...(r() < 0.15 ? [pick(r, EXTRA)] : [])].map((t) => ({ ...t, count: occ.get(`${t.n}${t.l}`) ?? 0 }))
      const nudges = int(r, 1, 3)
      for (let k = 0; k < nudges; k++) {
        const t = pick(r, terms)
        t.count = Math.max(0, t.count + pick(r, [-2, -1, 1, 1, 2]))
      }
      const kept = terms.filter((t) => t.count > 0)
      if (kept.length === 0) continue
      const typed = termsText(r() < 0.5 ? kept : shuffled(r, kept))
      const g = gradeConfiguration(sp, typed, { form: 'full' })
      const label = `#${i} ${speciesText(sp)}: ${typed}`
      expect(g.verdict, label).not.toBe('invalid')
      expect(g.verdict, label).not.toBe('unsupported')
      const same = sameConfiguration(kept, right)
      expect(g.verdict === 'correct', label).toBe(same)
      if (same) continue
      wrongAnswers++
      seen.add(verdictOf(g))
      const total = totalElectrons(kept)
      const ghost = kept.some((t) => !subshellExists(t))
      const over = kept.some((t) => t.count > SUBSHELL_CAPACITY[t.l])
      const tidy = inOrderWithoutGaps(kept)
      if (ghost) expect(verdictOf(g), label).toBe('subshell_nonexistent')
      else if (over) expect(verdictOf(g), label).toBe('subshell_overfilled')
      else if (sp.charge === 0 && total === sp.z) expect(['filling_order', 'exception_missed', 'exception_misapplied'], label).toContain(verdictOf(g))
      else if (sp.charge === 0 && tidy) expect(verdictOf(g), label).toBe('electron_count')
      else if (sp.charge === 0) expect(['filling_order', 'electron_count'], label).toContain(verdictOf(g))
      else if (!tidy) expect(['filling_order', 'electron_count', 'ion_charge_ignored', 'ion_wrong_direction', 'ion_wrong_number', 'ion_removed_from_3d'], label).toContain(verdictOf(g))
      else if (total === sp.z) expect(verdictOf(g), label).toBe('ion_charge_ignored')
      else if (total === sp.z + sp.charge) expect(verdictOf(g), label).toBe('ion_wrong_direction')
      else if (total !== sp.z - sp.charge) expect(['ion_wrong_number', 'electron_count'], label).toContain(verdictOf(g))
      else expect(verdictOf(g), label).toBe('ion_removed_from_3d')
      // A named mistake always comes with a sentence.
      if (g.verdict === 'mistake') expect(g.witness.length, label).toBeGreaterThan(40)
    }
    expect(wrongAnswers).toBeGreaterThan(2000)
    for (const k of ['subshell_nonexistent', 'subshell_overfilled', 'electron_count', 'filling_order', 'ion_charge_ignored', 'ion_wrong_number']) expect(seen.has(k), k).toBe(true)
  }, SWEEP_TIMEOUT)
})
