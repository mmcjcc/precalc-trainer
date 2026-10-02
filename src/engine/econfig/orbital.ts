/**
 * Orbital diagrams and unpaired electrons.
 *
 * A diagram is the boxes of ONE subshell, left to right (1 box for s, 3 for p, 5 for d); each box is the list
 * of arrows in it ('up' / 'down'). The right diagram is Hund's-rule filling: one up arrow in every box first,
 * then the down arrows. A UI builds the answer from tappable boxes and passes the array straight in; the
 * compact text form ("ud u u - -", "[↑↓] [↑] [ ]") is read by `parseOrbitalDiagram`.
 *
 * Diagram checks, in order (rule checks on HER boxes):
 *   1. the number of boxes                                                   → wrong (plain)
 *   2. a box with more than two arrows, or two arrows the same way           → pauli_broken
 *   3. the number of arrows is not the number of electrons in the subshell   → wrong (plain)
 *   4. a box holds a pair while another box of the subshell is empty         → hund_broken
 *   5. the single electrons do not all point the same way                    → hund_broken
 * What passes is correct: the boxes of a subshell are equal in energy, so which boxes hold the single
 * electrons, and whether the singles point up or down, is not graded (the message notes the convention).
 *
 * Unpaired electrons (a number), mistakes computed as what each slip would give:
 *   - counted from her own wrong diagram, or from a pair-first diagram        → unpaired_from_wrong_diagram
 *   - counted from Cr / Cu written without the exception                      → exception_missed
 *   - counted from the neutral atom instead of the ion                        → ion_charge_ignored
 *   - counted from the ion with 3d electrons removed before 4s                → ion_removed_from_3d
 */
import type { ParseError } from '@/shared/types'
import {
  aufbau,
  deriveConfiguration,
  elementOf,
  EXCEPTION_ELEMENTS,
  FILLING_ORDER,
  neutralConfiguration,
  occupancyOf,
  readSubshell,
  removeFrom3dFirst,
  resolveSpecies,
  speciesDisplay,
  speciesProblem,
  SUBSHELL_ORBITALS,
  subshellName,
} from './model'
import { invalidGrade } from './grade'
import { aLetter, parseCount, plural, termDisplay } from './text'
import type {
  CountMistakeCandidate,
  DiagramMistakeCandidate,
  EconfigGrade,
  EconfigMistakeKind,
  EconfigSpecies,
  EconfigSpeciesLike,
  OrbitalBox,
  OrbitalDiagram,
  OrbitalDiagramInfo,
  OrbitalDiagramParse,
  Spin,
  Subshell,
  SubshellCount,
  SubshellLetter,
  SubshellLike,
} from './types'

// ---------------------------------------------------------------------------
// Building and rendering diagrams
// ---------------------------------------------------------------------------

/** Hund's-rule filling of `electrons` in one subshell: an up arrow in every box first, then the down arrows. */
export function hundDiagram(electrons: number, l: SubshellLetter): OrbitalBox[] {
  const orbitals = SUBSHELL_ORBITALS[l]
  if (!Number.isInteger(electrons) || electrons < 0 || electrons > 2 * orbitals) throw new RangeError(`econfig: ${electrons} electrons do not fit in ${aLetter(l)} subshell`)
  const boxes: Spin[][] = []
  for (let i = 0; i < orbitals; i++) {
    const box: Spin[] = []
    if (i < electrons) box.push('up')
    if (i < electrons - orbitals) box.push('down')
    boxes.push(box)
  }
  return boxes
}

/** Pairs first (the Hund mistake): full boxes from the left, then a single. */
function pairFirstDiagram(electrons: number, l: SubshellLetter): OrbitalBox[] {
  const boxes: Spin[][] = []
  for (let i = 0; i < SUBSHELL_ORBITALS[l]; i++) boxes.push(2 * i + 1 < electrons ? ['up', 'down'] : 2 * i < electrons ? ['up'] : [])
  return boxes
}

/** Electrons alone in a box. */
export function unpairedInDiagram(boxes: OrbitalDiagram): number {
  return boxes.filter((b) => b.length === 1).length
}

/** Compact text the parser reads back: "ud u u - -" (u up, d down, - empty). */
export function orbitalDiagramText(boxes: OrbitalDiagram): string {
  return boxes.map((b) => b.map((s) => (s === 'up' ? 'u' : 'd')).join('') || '-').join(' ')
}

/** For sentences: "[↑↓] [↑ ] [  ]". */
export function orbitalDiagramDisplay(boxes: OrbitalDiagram): string {
  return boxes.map((b) => `[${b.map((s) => (s === 'up' ? '↑' : '↓')).join('').padEnd(2, ' ')}]`).join(' ')
}

/** LaTeX (KaTeX): boxes of arrows, "\boxed{\uparrow\downarrow}\,\boxed{\uparrow\phantom{\downarrow}}". */
export function orbitalDiagramLatex(boxes: OrbitalDiagram): string {
  const arrow = (s: Spin) => (s === 'up' ? '\\uparrow' : '\\downarrow')
  return boxes
    .map((b) => {
      if (b.length === 0) return '\\boxed{\\phantom{\\uparrow\\downarrow}}'
      if (b.length === 1) return b[0] === 'up' ? '\\boxed{\\uparrow\\phantom{\\downarrow}}' : '\\boxed{\\phantom{\\uparrow}\\downarrow}'
      return `\\boxed{${b.map(arrow).join('')}}`
    })
    .join('\\,')
}

function parseError(message: string, position: number, length?: number): { ok: false; error: ParseError } {
  return { ok: false, error: length === undefined ? { message, position } : { message, position, length } }
}

function arrowOf(ch: string): Spin | null {
  if (ch === 'u' || ch === 'U' || ch === '↑') return 'up'
  if (ch === 'd' || ch === 'D' || ch === '↓') return 'down'
  return null
}

const DIAGRAM_HELP = 'Write u for an up arrow, d for a down arrow and - for an empty box, with a space between boxes: ud u -'

/**
 * A typed diagram: boxes separated by spaces, commas or |, each a run of u / d (or ↑ / ↓), with -, _ or 0
 * for an empty box ("ud u -"); or bracketed boxes, "[ud] [u] [ ]" / "[↑↓][↑][]".
 */
export function parseOrbitalDiagram(text: string): OrbitalDiagramParse {
  const src = text ?? ''
  if (src.trim() === '') return parseError(`The diagram is empty. ${DIAGRAM_HELP}`, 0)
  const boxes: OrbitalBox[] = []
  if (src.includes('[')) {
    let i = 0
    while (i < src.length) {
      const ch = src[i]!
      if (/[\s,|]/.test(ch)) {
        i++
        continue
      }
      if (ch !== '[') return parseError('Put every box in square brackets, like [ud] [u] [ ].', i, 1)
      const end = src.indexOf(']', i)
      if (end < 0) return parseError('This box is never closed.', i, 1)
      const box: Spin[] = []
      for (let j = i + 1; j < end; j++) {
        const inner = src[j]!
        if (/[\s_\-0]/.test(inner)) continue
        const spin = arrowOf(inner)
        if (!spin) return parseError(`“${inner}” is not an arrow. ${DIAGRAM_HELP}`, j, 1)
        box.push(spin)
      }
      boxes.push(box)
      i = end + 1
    }
    return { ok: true, value: boxes }
  }
  const token = /[^\s,|]+/g
  for (let m = token.exec(src); m; m = token.exec(src)) {
    const word = m[0]
    if (/^[-_0.]$/.test(word)) {
      boxes.push([])
      continue
    }
    const box: Spin[] = []
    for (let j = 0; j < word.length; j++) {
      const spin = arrowOf(word[j]!)
      if (!spin) return parseError(`“${word[j]}” is not an arrow. ${DIAGRAM_HELP}`, m.index + j, 1)
      box.push(spin)
    }
    boxes.push(box)
  }
  return { ok: true, value: boxes }
}

/** Her diagram, whichever way it was given: boxes from a tappable UI, or typed text. */
function readDiagram(answer: OrbitalDiagram | string): OrbitalDiagramParse {
  if (typeof answer === 'string') return parseOrbitalDiagram(answer)
  const ok = Array.isArray(answer) && answer.every((b) => Array.isArray(b) && b.every((s) => s === 'up' || s === 'down'))
  if (!ok) return parseError('The diagram could not be read: each box is a list of up and down arrows.', 0)
  return { ok: true, value: answer.map((b) => [...b]) }
}

// ---------------------------------------------------------------------------
// The right diagram of a species
// ---------------------------------------------------------------------------

/** The last occupied subshell in filling order, the one that is being filled: 3d for Fe, 2p for O, 4s for K. */
export function lastSubshell(species: EconfigSpeciesLike): Subshell {
  const sp = resolveSpecies(species)
  const problem = speciesProblem(species)
  if (!sp || problem) throw new RangeError(`econfig: ${problem}`)
  const config = deriveConfiguration(sp.z, sp.charge)
  const last = config[config.length - 1]!
  return { n: last.n, l: last.l }
}

/** Why a diagram question cannot be asked (species outside the model, subshell not one of 1s to 4p), or null. */
export function diagramProblem(species: EconfigSpeciesLike, subshell?: SubshellLike): string | null {
  const problem = speciesProblem(species)
  if (problem) return problem
  if (subshell === undefined) return null
  const s = readSubshell(subshell)
  if (!s) return `Could not read the subshell ${JSON.stringify(subshell)}.`
  if (!FILLING_ORDER.some((f) => f.n === s.n && f.l === s.l)) return `${subshellName(s)} is outside the model: the subshells are ${FILLING_ORDER.map(subshellName).join(', ')}.`
  return null
}

function diagramInfo(sp: EconfigSpecies, subshell: Subshell): OrbitalDiagramInfo {
  const electrons = occupancyOf(deriveConfiguration(sp.z, sp.charge)).get(subshellName(subshell)) ?? 0
  const boxes = hundDiagram(electrons, subshell.l)
  return {
    subshell,
    name: subshellName(subshell),
    electrons,
    orbitals: SUBSHELL_ORBITALS[subshell.l],
    boxes,
    unpaired: unpairedInDiagram(boxes),
    text: orbitalDiagramText(boxes),
  }
}

/**
 * The right orbital diagram of one subshell of a species: the named subshell, or by default the last one in
 * filling order (`lastSubshell`). Throws RangeError when `diagramProblem` is not null.
 *   orbitalDiagram('Fe')        → 3d, 6 electrons, boxes ud u u u u, 4 unpaired
 *   orbitalDiagram('O', '2p')   → 2p, 4 electrons, boxes ud u u, 2 unpaired
 */
export function orbitalDiagram(species: EconfigSpeciesLike, subshell?: SubshellLike): OrbitalDiagramInfo {
  const problem = diagramProblem(species, subshell)
  if (problem) throw new RangeError(`econfig: ${problem}`)
  return diagramInfo(resolveSpecies(species)!, subshell === undefined ? lastSubshell(species) : readSubshell(subshell)!)
}

// ---------------------------------------------------------------------------
// Grading a diagram
// ---------------------------------------------------------------------------

export interface DiagramGradeOptions {
  /** Which subshell the question asks about ("3d"); the default is `lastSubshell(species)`. */
  subshell?: SubshellLike
}

function gradeBoxes(sp: EconfigSpecies, info: OrbitalDiagramInfo, boxes: OrbitalBox[]): EconfigGrade {
  const l = info.subshell.l
  const label = speciesDisplay(sp)
  if (boxes.length !== info.orbitals)
    return {
      verdict: 'wrong',
      message: `${aLetter(l).replace(/^a/, 'A')} subshell has ${plural(info.orbitals, 'orbital')}, so its diagram has ${info.orbitals} ${info.orbitals === 1 ? 'box' : 'boxes'}. Yours has ${boxes.length}.`,
    }
  const crowded = boxes.findIndex((b) => b.length > 2)
  if (crowded >= 0)
    return {
      verdict: 'mistake',
      mistake: 'pauli_broken',
      witness: `Box ${crowded + 1} holds ${boxes[crowded]!.length} arrows. An orbital holds at most 2 electrons, and those two must have opposite spins (the Pauli exclusion principle).`,
    }
  const sameSpin = boxes.findIndex((b) => b.length === 2 && b[0] === b[1])
  if (sameSpin >= 0)
    return {
      verdict: 'mistake',
      mistake: 'pauli_broken',
      witness: `Box ${sameSpin + 1} holds two arrows pointing ${boxes[sameSpin]![0]}. Two electrons in the same orbital must have opposite spins, one up and one down (the Pauli exclusion principle).`,
    }
  const arrows = boxes.reduce((sum, b) => sum + b.length, 0)
  if (arrows !== info.electrons)
    return {
      verdict: 'wrong',
      message: `Your diagram has ${plural(arrows, 'arrow')}, but the ${info.name} subshell of ${label} holds ${plural(info.electrons, 'electron')}. Draw one arrow for each electron.`,
    }
  const firstPair = boxes.findIndex((b) => b.length === 2)
  const empties = boxes.map((b, i) => (b.length === 0 ? i + 1 : 0)).filter((i) => i > 0)
  if (firstPair >= 0 && empties.length > 0)
    return {
      verdict: 'mistake',
      mistake: 'hund_broken',
      witness: `Box ${firstPair + 1} holds a pair while ${empties.length === 1 ? `box ${empties[0]} is` : `${empties.length} boxes are`} still empty. Hund's rule: the orbitals of a subshell have the same energy, so each one gets ONE electron before any of them gets a second.`,
    }
  const singles = boxes.filter((b) => b.length === 1).map((b) => b[0]!)
  if (singles.includes('up') && singles.includes('down'))
    return {
      verdict: 'mistake',
      mistake: 'hund_broken',
      witness: `Your single electrons point in different directions (${singles.filter((s) => s === 'up').length} up, ${singles.filter((s) => s === 'down').length} down). Hund's rule: the unpaired electrons of a subshell all have the same spin, so the single arrows all point the same way.`,
    }
  const convention = singles.length > 0 && singles[0] === 'down' ? ' By convention the single arrows are drawn pointing up.' : ''
  const count = unpairedInDiagram(boxes)
  return {
    verdict: 'correct',
    message: `Correct: ${info.name} of ${label} is ${orbitalDiagramDisplay(boxes)}, with ${count === 0 ? 'no unpaired electrons' : plural(count, 'unpaired electron')}.${convention}`,
  }
}

/**
 * Grade the orbital diagram of one subshell. `answer` is the boxes from the UI, or typed text.
 *   gradeOrbitalDiagram('O', [['up', 'down'], ['up', 'down'], []], { subshell: '2p' })   → hund_broken
 */
export function gradeOrbitalDiagram(species: EconfigSpeciesLike, answer: OrbitalDiagram | string, options: DiagramGradeOptions = {}): EconfigGrade {
  const problem = diagramProblem(species, options.subshell)
  if (problem) return { verdict: 'unsupported', message: problem }
  const read = readDiagram(answer)
  if (!read.ok) return invalidGrade(read.error)
  return gradeBoxes(resolveSpecies(species)!, orbitalDiagram(species, options.subshell), read.value)
}

/**
 * The diagram each mistake would draw for this subshell (only those that grade as their own kind):
 * hund_broken is the pair-first diagram, pauli_broken has the paired boxes drawn with both arrows up.
 * Null when the question cannot be asked.
 */
export function orbitalDiagramMistakes(species: EconfigSpeciesLike, subshell?: SubshellLike): DiagramMistakeCandidate[] | null {
  if (diagramProblem(species, subshell)) return null
  const info = orbitalDiagram(species, subshell)
  const { electrons, orbitals } = info
  const l = info.subshell.l
  const raw: { kind: EconfigMistakeKind; boxes: OrbitalBox[] }[] = [{ kind: 'hund_broken', boxes: pairFirstDiagram(electrons, l) }]
  if (electrons > orbitals) raw.push({ kind: 'pauli_broken', boxes: info.boxes.map((b) => (b.length === 2 ? ['up', 'up'] : [...b])) })
  else if (electrons >= 2 && orbitals > 1) {
    // Two electrons crowded into the first box, both up; the rest one per box.
    const boxes: Spin[][] = [['up', 'up']]
    for (let i = 1; i < orbitals; i++) boxes.push(i <= electrons - 2 ? ['up'] : [])
    raw.push({ kind: 'pauli_broken', boxes })
  }
  const kept: DiagramMistakeCandidate[] = []
  for (const r of raw) {
    const text = orbitalDiagramText(r.boxes)
    if (kept.some((c) => c.text === text)) continue
    const grade = gradeOrbitalDiagram(species, r.boxes, subshell === undefined ? {} : { subshell })
    if (grade.verdict === 'mistake' && grade.mistake === r.kind) kept.push({ kind: r.kind, boxes: r.boxes, text, witness: grade.witness, shadows: [] })
  }
  return kept
}

// ---------------------------------------------------------------------------
// Unpaired electrons
// ---------------------------------------------------------------------------

function unpairedOf(config: readonly SubshellCount[]): number {
  return config.reduce((sum, t) => sum + unpairedInDiagram(hundDiagram(t.count, t.l)), 0)
}

/** Subshells that are neither empty nor full: the only ones that can hold unpaired electrons. */
function partlyFilled(config: readonly SubshellCount[]): SubshellCount[] {
  return config.filter((t) => t.count < 2 * SUBSHELL_ORBITALS[t.l])
}

/**
 * The number of unpaired electrons in the whole atom or ion (every subshell counted).
 *   unpairedElectrons('N') → 3    unpairedElectrons('Fe') → 4    unpairedElectrons('Cr') → 6    unpairedElectrons('Fe3+') → 5
 */
export function unpairedElectrons(species: EconfigSpeciesLike): number {
  const problem = speciesProblem(species)
  if (problem) throw new RangeError(`econfig: ${problem}`)
  const sp = resolveSpecies(species)!
  return unpairedOf(deriveConfiguration(sp.z, sp.charge))
}

function unpairedCandidates(sp: EconfigSpecies): CountMistakeCandidate[] {
  const { z, charge } = sp
  const config = deriveConfiguration(z, charge)
  const right = unpairedOf(config)
  const label = speciesDisplay(sp)
  const raw: { kind: EconfigMistakeKind; value: number; witness: string }[] = []

  const pairFirst = config.reduce((sum, t) => sum + (t.count % 2), 0)
  const example = partlyFilled(config).find((t) => t.count % 2 !== unpairedInDiagram(hundDiagram(t.count, t.l)))
  raw.push({
    kind: 'unpaired_from_wrong_diagram',
    value: pairFirst,
    witness: `${pairFirst} is the count from a diagram that pairs electrons up first${example ? ` (${termDisplay(example)} drawn as ${orbitalDiagramDisplay(pairFirstDiagram(example.count, example.l))})` : ''}. Hund's rule: every orbital of a subshell gets one electron before any orbital gets a second, so more of them stay unpaired.`,
  })
  if (charge === 0 && EXCEPTION_ELEMENTS.includes(z)) {
    const plain = aufbau(z)
    const value = unpairedOf(plain)
    raw.push({
      kind: 'exception_missed',
      value,
      witness: `${value} is the count for 4s² 3d${z === 24 ? '⁴' : '⁹'}, the plain filling order. ${label} is one of the two exceptions: one electron moves from 4s to 3d, so count the unpaired electrons in both 4s and 3d again.`,
    })
  }
  if (charge !== 0) {
    const neutral = unpairedOf(neutralConfiguration(z))
    raw.push({
      kind: 'ion_charge_ignored',
      value: neutral,
      witness: `${neutral} is the count for the neutral atom. ${label} has ${charge > 0 ? 'lost' : 'gained'} ${plural(Math.abs(charge), 'electron')}: work out the ion's configuration first, then count.`,
    })
    const group = elementOf(sp).group
    if (charge > 0 && group !== null && group >= 3 && group <= 12) {
      const value = unpairedOf(removeFrom3dFirst(z, charge))
      raw.push({
        kind: 'ion_removed_from_3d',
        value,
        witness: `${value} is the count if the electrons are taken out of 3d while 4s stays full. The 4s electrons leave FIRST when a transition metal becomes a positive ion, so ${label} has no 4s electrons: count again from that configuration.`,
      })
    }
  }
  const kept: CountMistakeCandidate[] = []
  for (const r of raw) {
    if (r.value === right) continue
    const twin = kept.find((c) => c.value === r.value)
    if (twin) {
      if (!twin.shadows.includes(r.kind)) twin.shadows.push(r.kind)
      continue
    }
    kept.push({ kind: r.kind, value: r.value, text: String(r.value), witness: r.witness, shadows: [] })
  }
  return kept
}

/**
 * The count each mistake would give (only those different from the right count), in priority order; two
 * kinds giving the same number are one candidate with `shadows`. Null for a species outside the model.
 *   unpairedMistakes('Fe3+').map(c => [c.kind, c.text])
 *   // [['unpaired_from_wrong_diagram', '1'], ['ion_charge_ignored', '4'], ['ion_removed_from_3d', '3']]
 */
export function unpairedMistakes(species: EconfigSpeciesLike): CountMistakeCandidate[] | null {
  if (speciesProblem(species)) return null
  return unpairedCandidates(resolveSpecies(species)!)
}

export interface UnpairedGradeOptions {
  /** The diagram she drew for this question, when the screen has one: a count that matches a wrong diagram is named. */
  diagram?: OrbitalDiagram | string
  /** The subshell her diagram is of (default `lastSubshell(species)`). */
  subshell?: SubshellLike
}

/** Grade the number of unpaired electrons she typed for the whole atom or ion. */
export function gradeUnpairedElectrons(species: EconfigSpeciesLike, answer: string, options: UnpairedGradeOptions = {}): EconfigGrade {
  const problem = options.diagram === undefined ? speciesProblem(species) : diagramProblem(species, options.subshell)
  if (problem) return { verdict: 'unsupported', message: problem }
  const sp = resolveSpecies(species)!
  const parsed = parseCount(answer, 'Type the number of unpaired electrons.')
  if (!parsed.ok) return invalidGrade(parsed)
  const her = parsed.value
  const config = deriveConfiguration(sp.z, sp.charge)
  const right = unpairedOf(config)
  const label = speciesDisplay(sp)
  const partial = partlyFilled(config)

  if (her === right) {
    const where = partial.map((t) => `${subshellName(t)} ${orbitalDiagramDisplay(hundDiagram(t.count, t.l))}`).join(', ')
    return {
      verdict: 'correct',
      message:
        right === 0
          ? `Correct: every occupied subshell of ${label} is full, so every electron is paired.`
          : `Correct: ${label} has ${plural(right, 'unpaired electron')} (${where}).`,
    }
  }

  if (options.diagram !== undefined) {
    const read = readDiagram(options.diagram)
    if (read.ok) {
      const info = orbitalDiagram(sp, options.subshell)
      const drawn = gradeBoxes(sp, info, read.value)
      const fromHers = unpairedInDiagram(read.value) + (right - info.unpaired)
      if ((drawn.verdict === 'mistake' || drawn.verdict === 'wrong') && fromHers === her)
        return {
          verdict: 'mistake',
          mistake: 'unpaired_from_wrong_diagram',
          witness: `${her} is what your ${info.name} diagram shows, so the counting is fine: the diagram is what needs fixing. ${drawn.verdict === 'mistake' ? drawn.witness : drawn.message}`,
        }
    }
  }

  const hit = unpairedCandidates(sp).find((c) => c.value === her)
  if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness }

  if (partial.length === 0)
    return { verdict: 'wrong', message: `Every occupied subshell of ${label} is full. In a full subshell each orbital holds a pair, so no electron is left alone.` }
  const inPartial = partial.reduce((sum, t) => sum + t.count, 0)
  const names = partial.map(subshellName).join(' and ')
  // Chromium has two subshells that are not full: counting only one of them is its own slip.
  const alone = partial.length > 1 ? partial.find((t) => unpairedInDiagram(hundDiagram(t.count, t.l)) === her) : undefined
  if (alone) {
    const others = partial.filter((t) => t !== alone)
    return {
      verdict: 'wrong',
      message: `${her} counts ${subshellName(alone)} alone. ${others.map(termDisplay).join(' and ')} is not full either, so its unpaired ${others.reduce((sum, t) => sum + unpairedInDiagram(hundDiagram(t.count, t.l)), 0) === 1 ? 'electron counts' : 'electrons count'} too.`,
    }
  }
  if (her === inPartial)
    return {
      verdict: 'wrong',
      message: `${her} is the number of electrons in ${names}. Some of them share an orbital: an unpaired electron is one that is alone in its box. Draw the boxes and count only the single arrows.`,
    }
  return {
    verdict: 'wrong',
    message: `Full subshells have no unpaired electrons, so only ${names} can have any. Draw ${partial.length === 1 ? 'its' : 'their'} boxes, put one arrow in each box before pairing any, and count the arrows that are alone. Your answer was ${her}.`,
  }
}
