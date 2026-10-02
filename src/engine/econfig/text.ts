/**
 * Renderers. Three kinds of text:
 *  - app text, what she types and what the parser reads back: "1s2 2s2 2p6 3s2 3p6 4s2 3d6", "[Ar] 4s2 3d6";
 *  - display text for sentences, with superscripts: "1s² 2s² 2p⁶", "[Ar] 4s² 3d⁶";
 *  - LaTeX: "\mathrm{[Ar]\,4s^{2}\,3d^{6}}".
 */
import { elementByZ } from '../chem/elements'
import {
  canonicalCore,
  deriveConfiguration,
  fillingOrder,
  requireSpecies,
  restAfterCore,
  shellOrder,
  subshellName,
  superscriptNumber,
} from './model'
import type { EconfigSpecies, EconfigSpeciesLike, NobleGasCore, EconfigRenderOptions, SubshellCount } from './types'

/** "4s2 3d6" (the order given). */
export function termsText(config: readonly SubshellCount[]): string {
  return config.map((t) => `${subshellName(t)}${t.count}`).join(' ')
}

/** "4s² 3d⁶" */
export function termsDisplay(config: readonly SubshellCount[]): string {
  return config.map((t) => `${subshellName(t)}${superscriptNumber(t.count)}`).join(' ')
}

/** "4s^{2}\,3d^{6}" (no \mathrm wrapper) */
export function termsLatex(config: readonly SubshellCount[]): string {
  return config.map((t) => `${subshellName(t)}^{${t.count}}`).join('\\,')
}

/** One subshell for a sentence: "3d⁶". */
export function termDisplay(t: SubshellCount): string {
  return `${subshellName(t)}${superscriptNumber(t.count)}`
}

interface Pieces {
  core: NobleGasCore | null
  terms: SubshellCount[]
}

function pieces(sp: EconfigSpecies, options: EconfigRenderOptions): Pieces {
  const config = deriveConfiguration(sp.z, sp.charge)
  const sort = options.order === 'shell' ? shellOrder : fillingOrder
  if (options.form !== 'shorthand') return { core: null, terms: sort(config) }
  const core = canonicalCore(sp)
  const rest = core ? restAfterCore(config, core) : null
  return core && rest ? { core, terms: sort(rest) } : { core: null, terms: sort(config) }
}

function joinCore(core: string | null, terms: string, glue: string): string {
  if (core === null) return terms
  return terms === '' ? core : `${core}${glue}${terms}`
}

/**
 * The configuration as app text. Defaults: full form, filling order.
 *   configurationText('Fe')                                          → "1s2 2s2 2p6 3s2 3p6 4s2 3d6"
 *   configurationText('Fe', { form: 'shorthand' })                   → "[Ar] 4s2 3d6"
 *   configurationText('Fe', { form: 'shorthand', order: 'shell' })   → "[Ar] 3d6 4s2"
 * Hydrogen and helium have no noble gas before them, so their shorthand is the full text.
 */
export function configurationText(species: EconfigSpeciesLike, options: EconfigRenderOptions = {}): string {
  const p = pieces(requireSpecies(species), options)
  return joinCore(p.core ? `[${p.core.symbol}]` : null, termsText(p.terms), ' ')
}

/** The same with superscripts, for sentences: "[Ar] 4s² 3d⁶". */
export function configurationDisplay(species: EconfigSpeciesLike, options: EconfigRenderOptions = {}): string {
  const p = pieces(requireSpecies(species), options)
  return joinCore(p.core ? `[${p.core.symbol}]` : null, termsDisplay(p.terms), ' ')
}

/** LaTeX: "\mathrm{[Ar]\,4s^{2}\,3d^{6}}". */
export function configurationLatex(species: EconfigSpeciesLike, options: EconfigRenderOptions = {}): string {
  const p = pieces(requireSpecies(species), options)
  return `\\mathrm{${joinCore(p.core ? `[${p.core.symbol}]` : null, termsLatex(p.terms), '\\,')}}`
}

// ---------------------------------------------------------------------------
// Small sentence helpers shared by the graders and the explanations
// ---------------------------------------------------------------------------

/** "1 electron", "3 electrons" */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** "iron" */
export function nameOf(z: number): string {
  return elementByZ(z)?.name ?? `element ${z}`
}

/** "Iron" */
export function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** ["a", "b", "c"] → "a, b and c" */
export function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** "an s", "a p", "a d", "an f" */
export function aLetter(l: string): string {
  return l === 's' || l === 'f' ? `an ${l}` : `a ${l}`
}

/** A whole number she typed into a box. */
export function parseCount(text: string, empty: string): { ok: true; value: number } | { ok: false; message: string; position: number; length?: number } {
  const source = text ?? ''
  const lead = source.length - source.trimStart().length
  const t = source.trim()
  if (t === '') return { ok: false, message: empty, position: 0 }
  if (/^[-−]/.test(t)) return { ok: false, message: 'This is a count of electrons, so it cannot be negative.', position: lead, length: 1 }
  const bad = t.search(/[^0-9]/)
  if (bad >= 0) return { ok: false, message: 'Type a whole number, like 5.', position: lead + bad, length: 1 }
  if (t.length > 3) return { ok: false, message: 'That is far more electrons than any atom has.', position: lead, length: t.length }
  return { ok: true, value: Number(t) }
}
