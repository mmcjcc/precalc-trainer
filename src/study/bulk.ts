/**
 * Paste to cards: she pastes notes or a list and each line becomes a card. The separator between a
 * term and its definition is found for her (a tab from Quizlet or a spreadsheet, " - ", ": ",
 * " = ", an arrow), or she picks it; text with no separators at all is read as a term line
 * followed by its definition line. Pure: the page shows the result as a preview before anything
 * is added, so a wrong guess costs nothing.
 */
import { STUDY_LIMITS, type StudyDraftCard } from '@/store/studySets'

export type BulkSplit = 'auto' | 'tab' | 'dash' | 'colon' | 'equals' | 'lines'
export type BulkFound = Exclude<BulkSplit, 'auto'>

export interface BulkResult {
  cards: StudyDraftCard[]
  /** How the text was read; null when it held nothing to read. */
  split: BulkFound | null
  /** Lines that could not be made into a card. */
  skipped: string[]
  /** Cards shortened to the field limit. */
  clipped: number
  /** Cards left out because the set has no room for them. */
  overflow: number
}

/** A hyphen or an en dash needs a space on both sides ("wave-particle" and "400–700 nm" stay whole). */
const SEPARATORS: Record<Exclude<BulkFound, 'lines'>, RegExp> = {
  tab: /\t+/,
  dash: /\s+[-–]{1,2}>?(?:\s+|$)|\s*—\s*|\s*(?:->|=>|→|⇒)\s*/,
  colon: /:\s+|:$/,
  equals: /\s+=\s+/,
}

/** When two inline separators are as common as each other, the first of these wins. */
const INLINE: readonly Exclude<BulkFound, 'lines' | 'tab'>[] = ['dash', 'colon', 'equals']

/** A leading bullet or list number ("- ", "• ", "3. ", "(3) "), which is never part of the term. */
const BULLET = /^(?:[-*•▷▶►·‣◦○●■□➤➢>]+|\(?\d{1,3}[.)])\s+/

function clean(line: string): string {
  return line.trim().replace(BULLET, '').trim()
}

function splitAt(line: string, kind: Exclude<BulkFound, 'lines'>): [string, string] | null {
  const m = SEPARATORS[kind].exec(line)
  if (!m || m.index === 0) return null
  return [line.slice(0, m.index).trim(), line.slice(m.index + m[0].length).replace(/\t+/g, ' ').trim()]
}

/**
 * Notes wrap, so a list is read as one card per line once about a third of its lines hold a
 * separator; under that it is a term line followed by a definition line. An equals sign only
 * counts on a line with no dash or colon: there it is the separator, elsewhere part of a formula.
 */
function detect(lines: readonly string[]): BulkFound {
  const enough = Math.max(1, Math.ceil(lines.length * 0.3))
  const has = (kind: Exclude<BulkFound, 'lines'>) => (line: string) => splitAt(line, kind) !== null
  if (lines.filter(has('tab')).length >= enough) return 'tab'
  if (lines.filter((line) => INLINE.some((kind) => has(kind)(line))).length < enough) return 'lines'
  const count: Record<(typeof INLINE)[number], number> = {
    dash: lines.filter(has('dash')).length,
    colon: lines.filter(has('colon')).length,
    equals: lines.filter((line) => has('equals')(line) && !has('dash')(line) && !has('colon')(line)).length,
  }
  let best: (typeof INLINE)[number] = 'dash'
  for (const kind of INLINE) if (count[kind] > count[best]) best = kind
  return best
}

interface Draft {
  term: string
  definition: string
}

/** Whichever of a dash and a colon comes first in the line ("Aufbau principle: fill low orbitals - then high"). */
function splitAtFirst(line: string): [string, string] | null {
  const dash = SEPARATORS.dash.exec(line)
  const colon = SEPARATORS.colon.exec(line)
  const dashAt = dash && dash.index > 0 ? dash.index : Infinity
  const colonAt = colon && colon.index > 0 ? colon.index : Infinity
  if (dashAt === Infinity && colonAt === Infinity) return null
  return splitAt(line, dashAt <= colonAt ? 'dash' : 'colon')
}

/**
 * One line of a list found for her. An equals sign is the last thing tried unless the list is
 * written with them, because a term is often a formula ("c = λν - the speed of light").
 */
function splitFound(line: string, kind: Exclude<BulkFound, 'lines'>): [string, string] | null {
  if (kind === 'tab') return splitAt(line, 'tab')
  if (kind === 'equals') return splitAt(line, 'equals') ?? splitAtFirst(line)
  return splitAtFirst(line) ?? splitAt(line, 'equals')
}

/** One card per line; a line with no separator carries on the card before it. */
function readInline(lines: readonly string[], kind: Exclude<BulkFound, 'lines'>, strict: boolean, skipped: string[]): Draft[] {
  const out: Draft[] = []
  for (const line of lines) {
    const pair = strict ? splitAt(line, kind) : splitFound(line, kind)
    if (pair) {
      out.push({ term: pair[0], definition: pair[1] })
      continue
    }
    const last = out[out.length - 1]
    if (last) last.definition = last.definition ? `${last.definition} ${line}` : line
    else skipped.push(line)
  }
  return out
}

/** No separators: blocks parted by blank lines (term, then its definition), or else every other line. */
function readLines(text: string, skipped: string[]): Draft[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map(clean).filter(Boolean))
    .filter((block) => block.length > 0)
  const out: Draft[] = []
  if (blocks.length > 1 && blocks.every((block) => block.length >= 2)) {
    for (const block of blocks) out.push({ term: block[0]!, definition: block.slice(1).join(' ') })
    return out
  }
  const lines = blocks.flat()
  for (let i = 0; i + 1 < lines.length; i += 2) out.push({ term: lines[i]!, definition: lines[i + 1]! })
  if (lines.length % 2 === 1) skipped.push(lines[lines.length - 1]!)
  return out
}

/**
 * The cards in a pasted text. `split` is her choice of separator ('auto' finds it); `room` is how
 * many more cards the set can take.
 */
export function parseBulkCards(text: string, split: BulkSplit = 'auto', room: number = STUDY_LIMITS.maxCards): BulkResult {
  const normal = text.replace(/\r\n?/g, '\n')
  const lines = normal.split('\n').map(clean).filter(Boolean)
  if (lines.length === 0) return { cards: [], split: null, skipped: [], clipped: 0, overflow: 0 }
  const found = split === 'auto' ? detect(lines) : split
  const skipped: string[] = []
  const drafts = found === 'lines' ? readLines(normal, skipped) : readInline(lines, found, split !== 'auto', skipped)

  const cards: StudyDraftCard[] = []
  let clipped = 0
  for (const draft of drafts) {
    if (!draft.term || !draft.definition) {
      skipped.push(draft.term || draft.definition)
      continue
    }
    const term = draft.term.slice(0, STUDY_LIMITS.maxField)
    const definition = draft.definition.slice(0, STUDY_LIMITS.maxField)
    if (term.length < draft.term.length || definition.length < draft.definition.length) clipped += 1
    cards.push({ term, definition })
  }
  const kept = cards.slice(0, Math.max(0, room))
  return { cards: kept, split: found, skipped, clipped, overflow: cards.length - kept.length }
}

/** What the page says under the paste box. */
export const BULK_SPLIT_LABELS: Readonly<Record<BulkSplit, string>> = {
  auto: 'Find it for me',
  tab: 'A tab (Quizlet, a spreadsheet)',
  dash: 'A dash: term - definition',
  colon: 'A colon: term: definition',
  equals: 'An equals sign: term = definition',
  lines: 'A new line: term, then definition',
}
