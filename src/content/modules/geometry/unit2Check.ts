/**
 * Independent checks for Unit 2. Each proof is read again from its own wording: the algebra is
 * solved from the equations on the page, and each reason is the one that justifies that row.
 */
import type { GeometryAnswer } from '@/content/types'
import { formatLin, lin, showNum } from './expr'
import { REASONS } from './reasons'
import {
  LAW_CHAINS,
  factOf,
  ifThen,
  STATEMENT_BANK,
  biconditionalOf,
  biconditionalTruth,
  formTruth,
  halfNegation,
  isCounterexample,
  statementOf,
  type BankEntry,
  type LawChain,
  type LogicForm,
  type Situation,
} from './bank'

const MINUS = '\u2212'

interface Lin {
  a: number
  b: number
}

interface Row {
  statement: string
  /** Reason id when she picks the reason. Null when she picks the statement. */
  reasonId: string | null
  support: string
}

function rowsOf(answer: GeometryAnswer): Row[] {
  return answer.stages.map((stage) => {
    // The first sentence only: a row that accepts another reason says so in a second sentence.
    const support = /supported by ([^.]+)\./.exec(stage.reveal[0] ?? '')?.[1] ?? ''
    if (stage.kind === 'reason') {
      return { statement: (stage.note ?? '').replace(/^Statement: /, ''), reasonId: stage.answerText, support }
    }
    const statement = stage.choices?.find((choice) => choice.id === stage.answerText)?.text ?? ''
    return { statement, reasonId: null, support }
  })
}

function reasonOf(row: Row): string {
  if (row.reasonId) return row.reasonId
  return REASONS.find((reason) => reason.label === row.support)?.id ?? `unreadable support “${row.support}”`
}

function parseLin(text: string): Lin {
  const s = text.trim().replace(new RegExp(MINUS, 'g'), '-').replace(/\s+/g, '')
  if (/^[+-]?\d+$/.test(s)) return { a: 0, b: Number(s) }
  const m = /^([+-]?\d*)x([+-]\d+)?$/.exec(s)
  if (!m) throw new Error(`not a linear expression: ${text}`)
  const a = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1])
  return { a, b: Number(m[2] ?? 0) }
}

/** The one x with left = right, or null when the equation is an identity or impossible. */
function solve(left: Lin, right: Lin): number | null {
  const a = left.a - right.a
  if (a === 0) return null
  const x = (right.b - left.b) / a
  if (!Number.isInteger(x)) return null
  return x
}

function at(e: Lin, x: number): number {
  return e.a * x + e.b
}

function same(got: string[], want: string[], where: string, errors: string[]) {
  if (got.length !== want.length || got.some((item, i) => item !== want[i])) {
    errors.push(`${where}: got ${got.join(' | ')} want ${want.join(' | ')}`)
  }
}

function checkMidpoint(prompt: string, rows: Row[], errors: string[]) {
  const m = /^M is the midpoint of ([A-Z]{2})\. ([A-Z]{2}) = (.+)\. ([A-Z]{2}) = (.+)\. Fill in each row of the proof\.$/.exec(prompt)
  if (!m) {
    errors.push(`unread midpoint prompt: ${prompt}`)
    return
  }
  const [, whole, leftName, leftText, rightName, rightText] = m
  const a = whole[0]!
  const b = whole[1]!
  if (leftName !== `${a}M` || rightName !== `M${b}`) errors.push('the two expressions are not the halves of the segment')
  const left = parseLin(leftText)
  const right = parseLin(rightText)
  const x = solve(left, right)
  if (x === null) {
    errors.push('midpoint equation does not have exactly one solution')
    return
  }
  if (x === 4 || at(left, x) <= 0 || at(left, x) !== at(right, x)) errors.push(`bad midpoint solution x = ${x}`)
  const gap = right.a - left.a
  if (left.a <= 0 || gap <= 0) {
    errors.push('midpoint: the smaller x term is not the one that moves')
    return
  }
  if (right.b === 0 || left.b - right.b !== gap * x) {
    errors.push('midpoint: moving the constant does not leave a multiple of x')
    return
  }
  // Moving the x term subtracts it. Moving the constant adds its size when it is negative and subtracts
  // it when positive. When the x terms differ by one, the row after that already reads "<x> = x".
  const wantStatements = [
    `M is the midpoint of ${whole}`,
    `${a}M = ${leftText} and M${b} = ${rightText}`,
    `${a}M = M${b}`,
    `${leftText} = ${rightText}`,
    `${showNum(left.b)} = ${formatLin(lin(gap, right.b))}`,
    `${showNum(left.b - right.b)} = ${coeff(gap)}`,
    ...(gap === 1 ? [] : [`${x} = x`]),
    `x = ${x}`,
  ]
  same(rows.map((row) => row.statement), wantStatements, 'midpoint statements', errors)
  same(
    rows.map(reasonOf),
    ['given', 'given', 'def-midpoint', 'eq-subst', 'eq-sub', constantMove(right.b), ...(gap === 1 ? [] : ['eq-div']), 'eq-sym'],
    'midpoint reasons',
    errors,
  )
}

/** Moving a constant across: a negative one leaves by addition, a positive one by subtraction. */
function constantMove(constant: number): string {
  return constant < 0 ? 'eq-add' : 'eq-sub'
}

function checkOverlap(prompt: string, rows: Row[], errors: string[]) {
  const m = /^Points ([A-Z]), ([A-Z]), ([A-Z]), and ([A-Z]) are in that order on a line\. ([A-Z]{2}) = ([A-Z]{2})\. Fill in each row of the proof\.$/.exec(prompt)
  if (!m) {
    errors.push(`unread overlap prompt: ${prompt}`)
    return
  }
  const [, a, b, c, d, left, right] = m
  if (left !== `${a}${b}` || right !== `${c}${d}`) errors.push('the equal segments are not the outer pieces')
  const ab = `${a}${b}`
  const bc = `${b}${c}`
  const cd = `${c}${d}`
  const ac = `${a}${c}`
  const bd = `${b}${d}`
  same(
    rows.map((row) => row.statement),
    [
      `${b} is between ${a} and ${c}, and ${c} is between ${b} and ${d}`,
      `${ab} = ${cd}`,
      `${ab} + ${bc} = ${ac}`,
      `${cd} + ${bc} = ${bd}`,
      `${ab} + ${bc} = ${bd}`,
      `${ac} = ${bd}`,
    ],
    'overlap statements',
    errors,
  )
  same(rows.map(reasonOf), ['given', 'given', 'post-seg-add', 'post-seg-add', 'eq-subst', 'eq-trans'], 'overlap reasons', errors)
}

function checkLinear(rows: Row[], errors: string[]) {
  same(
    rows.map((row) => row.statement),
    [
      'Angle 1 and angle 2 form a linear pair',
      'Angle 2 is congruent to angle 3',
      'Angle 1 and angle 2 are supplementary',
      'The measures of angle 1 and angle 2 add to 180',
      'Angle 2 and angle 3 have the same measure',
      'The measures of angle 1 and angle 3 add to 180',
      'Angle 1 and angle 3 are supplementary',
    ],
    'linear statements',
    errors,
  )
  same(
    rows.map(reasonOf),
    ['given', 'given', 'post-linear-pair', 'def-supp', 'def-cong-ang', 'eq-subst', 'def-supp'],
    'linear reasons',
    errors,
  )
}

function checkVerticalProve(rows: Row[], errors: string[]) {
  same(
    rows.map((row) => row.statement),
    [
      'Angle 1 and angle 3 form a linear pair',
      'Angle 2 and angle 3 form a linear pair',
      'Angle 1 and angle 3 are supplementary',
      'Angle 2 and angle 3 are supplementary',
      'Angle 1 is congruent to angle 2',
    ],
    'vertical-prove statements',
    errors,
  )
  same(rows.map(reasonOf), ['given', 'given', 'post-linear-pair', 'post-linear-pair', 'thm-cong-supp'], 'vertical-prove reasons', errors)
}

function checkVerticalApply(rows: Row[], errors: string[]) {
  same(
    rows.map((row) => row.statement),
    ['Angle 1 and angle 2 are vertical angles', 'Angle 1 is congruent to angle 2', 'Angle 1 and angle 2 have the same measure'],
    'vertical-apply statements',
    errors,
  )
  same(rows.map(reasonOf), ['given', 'thm-vertical', 'def-cong-ang'], 'vertical-apply reasons', errors)
}

function checkPartner(prompt: string, rows: Row[], errors: string[]) {
  const m = /^Angle 1 and angle 2 are (supplementary|complementary), and angle 3 and angle 2 are \1\. Fill in the proof\.$/.exec(prompt)
  if (!m) {
    errors.push(`unread partner prompt: ${prompt}`)
    return
  }
  const word = m[1]!
  const total = word === 'supplementary' ? '180' : '90'
  const definition = word === 'supplementary' ? 'def-supp' : 'def-comp'
  same(
    rows.map((row) => row.statement),
    [
      `Angle 1 and angle 2 are ${word}`,
      `Angle 3 and angle 2 are ${word}`,
      `The measures of angle 1 and angle 2 add to ${total}`,
      `The measures of angle 3 and angle 2 add to ${total}`,
      `${total} equals the measure of angle 3 plus the measure of angle 2`,
      'The measure of angle 1 plus the measure of angle 2 equals the measure of angle 3 plus the measure of angle 2',
      'Angle 1 and angle 3 have the same measure',
      'Angle 1 is congruent to angle 3',
    ],
    'partner statements',
    errors,
  )
  // The second sum is turned around (symmetric), so the chain shares the total in the middle (transitive),
  // and taking the measure of angle 2 off both sides leaves angle 1 and angle 3 (subtraction).
  same(rows.map(reasonOf), ['given', 'given', definition, definition, 'eq-sym', 'eq-trans', 'eq-sub', 'def-cong-ang'], 'partner reasons', errors)
}

function checkRight(rows: Row[], errors: string[]) {
  same(
    rows.map((row) => row.statement),
    [
      'Angle 1 is a right angle',
      'Angle 2 is a right angle',
      'The measure of angle 1 is 90 degrees',
      'The measure of angle 2 is 90 degrees',
      '90 degrees equals the measure of angle 2',
      'Angle 1 and angle 2 have the same measure',
      'Angle 1 is congruent to angle 2',
    ],
    'right-angle statements',
    errors,
  )
  same(rows.map(reasonOf), ['given', 'given', 'def-right', 'def-right', 'eq-sym', 'eq-trans', 'def-cong-ang'], 'right-angle reasons', errors)
}

function checkAngleBisector(prompt: string, rows: Row[], errors: string[]) {
  const m = /^Ray ([A-Z]{2}) bisects angle ([A-Z]{3})\. Angle 1 and angle 2 are the two pieces, and angle 3 is the whole angle\. Fill in the proof\.$/.exec(prompt)
  if (!m) {
    errors.push(`unread bisector prompt: ${prompt}`)
    return
  }
  same(
    rows.map((row) => row.statement),
    [
      `Ray ${m[1]} bisects angle ${m[2]}`,
      'Angle 1 is congruent to angle 2',
      'Angle 1 and angle 2 have the same measure',
      'The measures of angle 1 and angle 2 add to the measure of angle 3',
      'The measure of angle 1 added to itself equals the measure of angle 3',
      'The measure of angle 3 equals the measure of angle 1 added to itself',
    ],
    'angle-bisector statements',
    errors,
  )
  same(rows.map(reasonOf), ['given', 'def-ang-bisector', 'def-cong-ang', 'post-ang-add', 'eq-subst', 'eq-sym'], 'angle-bisector reasons', errors)
}

function checkSegmentBisector(prompt: string, rows: Row[], errors: string[]) {
  const m = /^Line ([A-Z]{2}) bisects ([A-Z]{2}) at M\. Fill in the proof\.$/.exec(prompt)
  if (!m) {
    errors.push(`unread segment-bisector prompt: ${prompt}`)
    return
  }
  const whole = m[2]!
  const a = whole[0]!
  const b = whole[1]!
  same(
    rows.map((row) => row.statement),
    [
      `Line ${m[1]} bisects ${whole} at M`,
      `M is the midpoint of ${whole}`,
      `${a}M = M${b}`,
      `Segment ${a}M is congruent to segment M${b}`,
    ],
    'segment-bisector statements',
    errors,
  )
  same(rows.map(reasonOf), ['given', 'def-seg-bisector', 'def-midpoint', 'def-cong-seg'], 'segment-bisector reasons', errors)
}

function checkTransitive(prompt: string, rows: Row[], errors: string[]) {
  const m = /^([A-Z]{2}) = ([A-Z]{2}) and ([A-Z]{2}) = ([A-Z]{2})\. Fill in the proof\.$/.exec(prompt)
  if (!m) {
    errors.push(`unread transitive prompt: ${prompt}`)
    return
  }
  const [, ab, cd, cd2, ef] = m
  if (cd !== cd2) errors.push('the two givens do not share a middle segment')
  same(rows.map((row) => row.statement), [`${ab} = ${cd}`, `${cd} = ${ef}`, `${ab} = ${ef}`, `${ef} = ${ab}`], 'transitive statements', errors)
  same(rows.map(reasonOf), ['given', 'given', 'eq-trans', 'eq-sym'], 'transitive reasons', errors)
}

function checkPerp(prompt: string, rows: Row[], errors: string[]) {
  const m = /^Line ([A-Z]{2}) is perpendicular to line ([A-Z]{2})\. Angle 1 is one of the angles where they meet\. Fill in the proof\.$/.exec(prompt)
  if (!m) {
    errors.push(`unread perpendicular prompt: ${prompt}`)
    return
  }
  same(
    rows.map((row) => row.statement),
    [`Line ${m[1]} is perpendicular to line ${m[2]}`, 'Angle 1 is a right angle', 'The measure of angle 1 is 90 degrees', '90 degrees equals the measure of angle 1'],
    'perpendicular statements',
    errors,
  )
  same(rows.map(reasonOf), ['given', 'def-perp', 'def-right', 'eq-sym'], 'perpendicular reasons', errors)
}

/** What is wrong with this two-column proof, read again from the prompt. Empty means it holds. */
export function auditTwoColumn(skeleton: string, prompt: string, answer: GeometryAnswer): string[] {
  const rows = rowsOf(answer)
  const errors: string[] = []
  switch (skeleton) {
    case 'midpoint-algebra':
      checkMidpoint(prompt, rows, errors)
      break
    case 'seg-overlap':
      checkOverlap(prompt, rows, errors)
      break
    case 'linear-supp':
      checkLinear(rows, errors)
      break
    case 'vertical-prove':
      checkVerticalProve(rows, errors)
      break
    case 'vertical-apply':
      checkVerticalApply(rows, errors)
      break
    case 'cong-supplements':
    case 'cong-complements':
      checkPartner(prompt, rows, errors)
      break
    case 'right-angles':
      checkRight(rows, errors)
      break
    case 'angle-bisector':
      checkAngleBisector(prompt, rows, errors)
      break
    case 'segment-bisector':
      checkSegmentBisector(prompt, rows, errors)
      break
    case 'transitive-segments':
      checkTransitive(prompt, rows, errors)
      break
    case 'perpendicular':
      checkPerp(prompt, rows, errors)
      break
    default:
      errors.push(`unknown skeleton ${skeleton}`)
  }
  return errors
}

function coeff(n: number): string {
  return n === 1 ? 'x' : `${n}x`
}

/** What is wrong with this algebraic proof. The solution is computed from the first equations only. */
export function auditAlgebra(skeleton: string, lines: readonly string[], reasons: readonly string[]): string[] {
  const errors: string[] = []
  if (skeleton === 'sym-div') {
    const m = /^(\d+) = (\d+)x$/.exec(lines[0] ?? '')
    if (!m || lines.length !== 3) return [`unread sym-div: ${lines.join(' | ')}`]
    const total = Number(m[1])
    const n = Number(m[2])
    const x = solve({ a: 0, b: total }, { a: n, b: 0 })
    if (x === null || n === 0) return ['sym-div does not have exactly one solution']
    if (x === 4) errors.push('x = 4')
    same([...lines], [`${total} = ${n}x`, `${n}x = ${total}`, `x = ${x}`], 'sym-div lines', errors)
    same([...reasons], ['given', 'eq-sym', 'eq-div'], 'sym-div reasons', errors)
    return errors
  }
  if (skeleton === 'distribute') {
    const m = /^(\d+) = (\d+)\(x \+ (\d+)\)$/.exec(lines[0] ?? '')
    if (!m || lines.length !== 5) return [`unread distribute: ${lines.join(' | ')}`]
    const total = Number(m[1])
    const n = Number(m[2])
    const b = Number(m[3])
    if (n === 0 || total % n !== 0) return ['distribute does not have exactly one solution']
    const x = total / n - b
    if (!Number.isInteger(x)) return ['distribute solution is not an integer']
    if (x === 4) errors.push('x = 4')
    if (n * (x + b) !== total) errors.push('distribute does not recover the total')
    same(
      [...lines],
      [`${total} = ${n}(x + ${b})`, `${n}(x + ${b}) = ${total}`, `${formatLin(lin(n, n * b))} = ${total}`, `${n}x = ${n * x}`, `x = ${x}`],
      'distribute lines',
      errors,
    )
    same([...reasons], ['given', 'eq-sym', 'eq-dist', 'eq-sub', 'eq-div'], 'distribute reasons', errors)
    return errors
  }
  if (skeleton === 'chain') {
    if (lines.length !== 6) return [`unread chain: ${lines.join(' | ')}`]
    const first = splitEq(lines[0]!)
    const second = splitEq(lines[1]!)
    if (!first || !second) return [`unread chain equations: ${lines[0]} / ${lines[1]}`]
    const x = solve(first[0], first[1])
    const y = solve(second[0], second[1])
    if (x === null || y === null || x !== y) return [`chain does not have exactly one shared solution (${x}, ${y})`]
    if (x === 4) errors.push('x = 4')
    const left = first[0].a !== 0 ? first[0] : first[1]
    const right = second[0].a !== 0 ? second[0] : second[1]
    const total = first[0].a === 0 ? first[0].b : first[1].b
    const total2 = second[0].a === 0 ? second[0].b : second[1].b
    if (total !== total2) errors.push('the two givens do not end in the same total')
    const gap = right.a - left.a
    if (left.a <= 0 || gap <= 0) return ['chain: the smaller x term is not the one that moves']
    if (right.b === 0) return ['chain: a zero constant would repeat a line']
    // Both givens end in the total, so the second is turned around before the two chain through it.
    same(
      [...lines],
      [
        `${formatLin(left)} = ${showNum(total)}`,
        `${formatLin(right)} = ${showNum(total)}`,
        `${showNum(total)} = ${formatLin(right)}`,
        `${formatLin(left)} = ${formatLin(right)}`,
        `${showNum(left.b)} = ${formatLin(lin(gap, right.b))}`,
        `${showNum(left.b - right.b)} = ${coeff(gap)}`,
      ],
      'chain lines',
      errors,
    )
    same([...reasons], ['given', 'given', 'eq-sym', 'eq-trans', 'eq-sub', constantMove(right.b)], 'chain reasons', errors)
    if (at(left, x) !== total || at(right, x) !== total) errors.push('chain solution misses a given')
    return errors
  }
  return [`unknown algebra ${skeleton}`]
}

function splitEq(line: string): [Lin, Lin] | null {
  const parts = line.split(' = ')
  if (parts.length !== 2) return null
  try {
    return [parseLin(parts[0]!), parseLin(parts[1]!)]
  } catch {
    return null
  }
}

/** The one reason a single proof line needs, read from the sentence itself. */
export function auditReasonLine(statement: string): string | null {
  let m = /^If ([A-Z]{2}) = ([A-Z]{2}), then ([A-Z]{2}) = ([A-Z]{2})\.$/.exec(statement)
  if (m) return m[1] === m[4] && m[2] === m[3] && m[1] !== m[2] ? 'eq-sym' : null
  m = /^([A-Z])M = M([A-Z]) because M is the midpoint of \1\2\.$/.exec(statement)
  if (m) return 'def-midpoint'
  if (statement === 'The measures of angle 1 and angle 2 add to 180 because the two angles form a linear pair.') return 'post-linear-pair'
  m = /^([A-Z])([A-Z]) \+ \2([A-Z]) = \1\3 because \2 is between \1 and \3\.$/.exec(statement)
  if (m) return 'post-seg-add'
  m = /^The measures of angle 1 and angle 2 add to the measure of angle ([A-Z]{3}) because ray ([A-Z]{2}) is inside that angle\.$/.exec(statement)
  if (m) return m[2]![0] === m[1]![1] ? 'post-ang-add' : null
  if (statement === 'Angle 1 is congruent to angle 2 because the two angles are vertical angles.') return 'thm-vertical'
  m = /^([A-Z]{2}) = ([A-Z]{2}) because \1 = ([A-Z]{2}) and \3 = \2\.$/.exec(statement)
  if (m) return m[1] !== m[3] && m[2] !== m[3] ? 'eq-trans' : null
  if (statement === 'Angle 1 is congruent to angle 3 because angle 1 is congruent to angle 2 and angle 2 is congruent to angle 3.') return 'cong-trans'
  if (statement === 'Angle 2 is congruent to angle 1 because angle 1 is congruent to angle 2.') return 'cong-sym'
  return null
}

function choiceText(answer: GeometryAnswer, index: number): string {
  const stage = answer.stages[index]
  if (!stage) return ''
  if (stage.kind === 'choice') return stage.choices?.find((choice) => choice.id === stage.answerText)?.text ?? ''
  return stage.answerText
}

function onlyChoice(answer: GeometryAnswer, index: number, text: string, errors: string[], where: string) {
  const stage = answer.stages[index]
  const hits = stage?.choices?.filter((choice) => choice.text === text) ?? []
  if (hits.length !== 1 || hits[0]!.id !== stage?.answerText) errors.push(`${where}: “${text}” is not the one correct choice`)
}

function quoted(prompt: string): string[] {
  return [...prompt.matchAll(/"([^"]+)"/g)].map((match) => match[1]!)
}

function entryForConditional(sentence: string): BankEntry | undefined {
  return STATEMENT_BANK.find((entry) => statementOf(entry, 'conditional') === sentence)
}

function classify(entry: BankEntry, sentence: string): 'converse' | 'inverse' | 'contra' | 'half' | 'conditional' {
  if (sentence === statementOf(entry, 'conditional')) return 'conditional'
  if (sentence === statementOf(entry, 'converse')) return 'converse'
  if (sentence === statementOf(entry, 'inverse')) return 'inverse'
  if (sentence === statementOf(entry, 'contrapositive')) return 'contra'
  return 'half'
}

const NAME: Record<'converse' | 'inverse' | 'contra' | 'half', string> = {
  converse: 'the converse',
  inverse: 'the inverse',
  contra: 'the contrapositive',
  half: 'none of these: only one part is negated',
}

/** What is wrong with a logic problem, read again from the prompt and the bank's clauses. */
export function auditLogic(question: string, prompt: string, answer: GeometryAnswer): string[] {
  const errors: string[] = []
  if (question === 'related') {
    const start = entryForConditional(quoted(prompt)[0] ?? '')
    if (!start) return [`related prompt does not quote a bank conditional: ${prompt}`]
    if (answer.stages.length === 3) {
      const want = [statementOf(start, 'converse'), statementOf(start, 'inverse'), statementOf(start, 'contrapositive')]
      want.forEach((text, index) => onlyChoice(answer, index, text, errors, `related part ${index + 1}`))
      return errors
    }
    const shown = (answer.stages[0]?.note ?? '').replace(/^New sentence: /, '')
    const kind = classify(start, shown)
    if (kind === 'conditional') errors.push('the new sentence is the original if-then')
    if (kind === 'half' && (halfNegation(start, 0) !== shown && halfNegation(start, 1) !== shown)) {
      errors.push('a half negation was not built from one negated part')
    }
    onlyChoice(answer, 0, NAME[kind === 'conditional' ? 'half' : kind], errors, 'name the related statement')
    return errors
  }
  if (question === 'truth') {
    const sentence = quoted(prompt)[0] ?? ''
    // Two bank rows can word one sentence the same way (one row's inverse is its mirror row's
    // contrapositive), so take the row whose situations are the ones on offer.
    const matches = STATEMENT_BANK.filter((item) => (['conditional', 'converse', 'inverse', 'contrapositive'] as const).some((form) => statementOf(item, form) === sentence) || biconditionalOf(item) === sentence)
    const offered = (answer.stages[1]?.choices ?? []).map((choice) => choice.text).filter((text) => text !== 'No counterexample: the statement holds.')
    const entry = matches.find((item) => offered.every((text) => findSituation(item, text))) ?? matches[0]
    if (!entry) return [`truth prompt is not a bank sentence: ${sentence}`]
    const iff = biconditionalOf(entry) === sentence
    const form = (['conditional', 'converse', 'inverse', 'contrapositive'] as const).find((item) => statementOf(entry, item) === sentence)
    const holds = iff ? biconditionalTruth(entry) : form ? formTruth(entry, form) : null
    if (holds === null || !form && !iff) return ['truth sentence matched neither a form nor a biconditional']
    onlyChoice(answer, 0, holds ? 'It is true.' : 'It is false.', errors, 'true or false')
    const direction: LogicForm = iff ? (entry.conditional ? 'converse' : 'conditional') : form!
    const knocks = (situation: Situation) => (iff ? (situation.p && !situation.q) || (situation.q && !situation.p) : isCounterexample(direction, situation))
    const picked = choiceText(answer, 1)
    if (holds) {
      if (picked !== 'No counterexample: the statement holds.') errors.push('a true sentence was given a counterexample')
      const stage = answer.stages[1]
      for (const choice of stage?.choices ?? []) {
        if (choice.id === stage?.answerText) continue
        const situation = findSituation(entry, choice.text)
        if (situation && knocks(situation)) errors.push(`a true sentence lists a counterexample: ${choice.text}`)
      }
      return errors
    }
    const situation = findSituation(entry, picked)
    if (!situation || !knocks(situation)) errors.push(`the chosen counterexample does not knock the sentence down: ${picked}`)
    const stage = answer.stages[1]
    const knockers = (stage?.choices ?? []).filter((choice) => {
      const item = findSituation(entry, choice.text)
      return item ? knocks(item) : false
    })
    if (knockers.length !== 1) errors.push(`expected one counterexample choice, found ${knockers.length}`)
    return errors
  }
  if (question === 'laws') {
    const premise1 = /^Premise 1: (.+)$/m.exec(prompt)?.[1] ?? ''
    const premise2 = /^Premise 2: (.+)$/m.exec(prompt)?.[1] ?? ''
    const found = lawAnswer(premise1, premise2)
    if (!found) return [`unread premises: ${premise1} / ${premise2}`]
    onlyChoice(answer, 0, found.text, errors, 'conclusion')
    const trap = answer.stages[0]?.choices?.find((choice) => choice.trap)
    if (!trap || trap.text === found.text) errors.push('the law problem has no wrong conclusion set apart from the right one')
    if (trap && trap.trap !== found.trap) errors.push(`trap ${trap?.trap} does not match the premises (${found.trap})`)
    if (trap && found.trapText && trap.text !== found.trapText) errors.push(`trap text “${trap.text}” is not the classic wrong conclusion`)
    return errors
  }
  return [`unknown logic question ${question}`]
}

function findSituation(entry: BankEntry, text: string): Situation | undefined {
  if (text === 'No counterexample: the statement holds.') return undefined
  for (const situation of entry.situations) if (situation.text === text) return situation
  for (const form of ['conditional', 'converse', 'inverse', 'contrapositive'] as const) {
    const counter = entry.counterexamples[form]
    if (counter?.text === text) return counter
  }
  return undefined
}

function cap(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

function lawAnswer(p1: string, p2: string): { text: string; trap: string; trapText: string } | null {
  for (const chain of LAW_CHAINS) {
    const hit = lawPattern(chain, p1, p2)
    if (hit) return hit
  }
  return null
}

function lawPattern(chain: LawChain, p1: string, p2: string): { text: string; trap: string; trapText: string } | null {
  const ifpq = ifThen(chain.p, chain.q)
  const ifqr = ifThen(chain.q, chain.r)
  const ifpr = ifThen(chain.p, chain.r)
  const ifAltQ = ifThen(chain.alt, chain.q)
  const fact = (key: 'p' | 'q' | 'r' | 'notP' | 'notQ') => factOf(chain, key)
  const none = 'There is no valid conclusion.'
  if (p1 === ifpq && p2 === cap(fact('q'))) return { text: none, trap: 'geo_affirm_conclusion', trapText: cap(fact('p')) }
  if (p1 === ifpq && p2 === cap(fact('notP'))) return { text: none, trap: 'geo_deny_hypothesis', trapText: cap(fact('notQ')) }
  if (p1 === ifpq && p2 === ifqr) return { text: ifpr, trap: 'geo_syllogism_order', trapText: ifThen(chain.r, chain.p) }
  // Two if-thens that share an ending: nothing follows, and chaining them gives a false sentence.
  if (p1 === ifpq && p2 === ifAltQ) return { text: none, trap: 'geo_syllogism_order', trapText: ifThen(chain.p, chain.alt) }
  if (p1 === ifpq && p2 === cap(fact('p'))) return { text: `So, ${fact('q')}.`, trap: 'geo_missed_detachment', trapText: none }
  return null
}
