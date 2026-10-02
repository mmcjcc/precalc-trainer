/**
 * Valence electrons of a neutral MAIN-GROUP atom (groups 1, 2, 13 to 18): the electrons in the outermost
 * occupied shell, read off the configuration (so gallium's 3d10 is not counted: its outer shell is n = 4).
 * Transition metals are out of scope for this question (their 4s and 3d electrons both take part in
 * bonding); the grader says so with `unsupported`, and so does the validator.
 *
 * Named mistakes, each the number that slip produces:
 *   - every electron of the atom (the atomic number)        → valence_total_electrons
 *   - the electrons in the last subshell only (3p5 → 5)     → valence_last_subshell
 */
import { elementByZ } from '../chem/elements'
import { isMainGroup, neutralConfiguration, resolveSpecies, speciesDisplay, speciesProblem, subshellName } from './model'
import { invalidGrade } from './grade'
import { capitalized, nameOf, parseCount, plural, termsDisplay } from './text'
import type { CountMistakeCandidate, EconfigGrade, EconfigMistakeKind, EconfigSpeciesLike, SubshellCount } from './types'

/** Why the valence question cannot be asked about this species, or null when it can. */
export function valenceProblem(species: EconfigSpeciesLike): string | null {
  const problem = speciesProblem(species)
  if (problem) return problem
  const sp = resolveSpecies(species)!
  if (sp.charge !== 0) return `Valence electrons are asked about neutral atoms only, and ${speciesDisplay(sp)} is an ion.`
  if (!isMainGroup(sp.z))
    return `${capitalized(nameOf(sp.z))} is a transition metal, and transition metals are out of scope for this question: their 4s and 3d electrons can both take part in bonding, so valence electrons are only asked for main-group elements (groups 1, 2 and 13 to 18).`
  return null
}

interface ValenceModel {
  z: number
  name: string
  config: SubshellCount[]
  /** The outermost occupied shell and its subshells. */
  shell: number
  outer: SubshellCount[]
  valence: number
  /** The last subshell in filling order. */
  last: SubshellCount
}

function modelOf(species: EconfigSpeciesLike): ValenceModel | null {
  if (valenceProblem(species)) return null
  const { z } = resolveSpecies(species)!
  const config = neutralConfiguration(z)
  const shell = Math.max(...config.map((t) => t.n))
  const outer = config.filter((t) => t.n === shell)
  return { z, name: nameOf(z), config, shell, outer, valence: outer.reduce((sum, t) => sum + t.count, 0), last: config[config.length - 1]! }
}

/**
 * The number of valence electrons of a neutral main-group atom; null for a transition metal, an ion, or a
 * species outside the model.
 *   valenceElectrons('Cl') → 7     valenceElectrons('Ga') → 3     valenceElectrons('Fe') → null
 */
export function valenceElectrons(species: EconfigSpeciesLike): number | null {
  return modelOf(species)?.valence ?? null
}

function candidates(m: ValenceModel): CountMistakeCandidate[] {
  const inner = m.z - m.valence
  const raw: { kind: EconfigMistakeKind; value: number; witness: string }[] = [
    {
      kind: 'valence_total_electrons',
      value: m.z,
      witness: `${m.z} is ALL of ${m.name}'s electrons (its atomic number). Valence electrons are only the ones in the outermost shell, n = ${m.shell}: the ${plural(inner, 'electron')} in the inner ${m.shell === 2 ? 'shell' : 'shells'} ${inner === 1 ? 'does' : 'do'} not count.`,
    },
    {
      kind: 'valence_last_subshell',
      value: m.last.count,
      witness: `${m.last.count} is the number of electrons in ${subshellName(m.last)} alone. The outermost shell is the whole of n = ${m.shell}, so the ${listOuterOthers(m)} too.`,
    },
  ]
  const kept: CountMistakeCandidate[] = []
  for (const r of raw) {
    if (r.value === m.valence) continue
    const twin = kept.find((c) => c.value === r.value)
    if (twin) {
      twin.shadows.push(r.kind)
      continue
    }
    kept.push({ kind: r.kind, value: r.value, text: String(r.value), witness: r.witness, shadows: [] })
  }
  return kept
}

/** "2 electrons in 3s count" */
function listOuterOthers(m: ValenceModel): string {
  const others = m.outer.filter((t) => subshellName(t) !== subshellName(m.last))
  const total = others.reduce((sum, t) => sum + t.count, 0)
  return `${plural(total, 'electron')} in ${others.map(subshellName).join(' and ')} ${total === 1 ? 'counts' : 'count'}`
}

/**
 * What each valence mistake gives for this atom (only those that differ from the right answer); null when the
 * question cannot be asked about the species.
 *   valenceMistakes('Cl').map(c => [c.kind, c.text])   // [['valence_total_electrons', '17'], ['valence_last_subshell', '5']]
 */
export function valenceMistakes(species: EconfigSpeciesLike): CountMistakeCandidate[] | null {
  const m = modelOf(species)
  return m ? candidates(m) : null
}

/**
 * How the valence electrons are counted: the configuration, the outermost shell, the sum. Reveals the answer.
 * Throws RangeError when the question cannot be asked about the species (`valenceProblem`).
 */
export function explainValence(species: EconfigSpeciesLike): string[] {
  const m = modelOf(species)
  if (!m) throw new RangeError(`econfig: ${valenceProblem(species)}`)
  const lines = [
    `${capitalized(m.name)}'s configuration is ${termsDisplay(m.config)}.`,
    `Valence electrons are the electrons in the outermost occupied shell, the highest shell number. Here that is n = ${m.shell}: ${termsDisplay(m.outer)}.`,
  ]
  if (m.shell === 4 && m.config.some((t) => subshellName(t) === '3d'))
    lines.push('The ten 3d electrons are in shell 3, an inner shell, so they are not valence electrons.')
  lines.push(
    m.outer.length === 1
      ? `${capitalized(m.name)} has ${plural(m.valence, 'valence electron')}.`
      : `${m.outer.map((t) => t.count).join(' + ')} = ${m.valence}: ${m.name} has ${plural(m.valence, 'valence electron')}.`,
  )
  return lines
}

/** Grade the number of valence electrons she typed for a neutral main-group atom. */
export function gradeValenceElectrons(species: EconfigSpeciesLike, answer: string): EconfigGrade {
  const problem = valenceProblem(species)
  if (problem) return { verdict: 'unsupported', message: problem }
  const m = modelOf(species)!
  const parsed = parseCount(answer, 'Type the number of valence electrons.')
  if (!parsed.ok) return invalidGrade(parsed)
  const her = parsed.value
  const outerText = termsDisplay(m.outer)
  if (her === m.valence)
    return { verdict: 'correct', message: `Correct: ${m.name}'s outermost shell is n = ${m.shell} (${outerText}), which holds ${plural(m.valence, 'valence electron')}.` }
  const hit = candidates(m).find((c) => c.value === her)
  if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness }
  const group = elementByZ(m.z)?.group ?? 0
  if (m.shell === 4 && m.config.some((t) => subshellName(t) === '3d') && her === m.valence + 10)
    return {
      verdict: 'wrong',
      message: `${her} counts the ten 3d electrons. 3d is in shell 3, an inner shell here: valence electrons are only the ones in the outermost shell, n = 4.`,
    }
  if (group >= 13 && her === group)
    return { verdict: 'wrong', message: `${her} is ${m.name}'s group number. Valence electrons are the electrons in the outermost shell, n = ${m.shell}: for groups 13 to 18 that is the group number minus 10.` }
  return {
    verdict: 'wrong',
    message: `Valence electrons are the electrons in the outermost occupied shell. For ${m.name} that is shell n = ${m.shell}: count every electron in it, in all of its subshells. Your answer was ${her}.`,
  }
}
