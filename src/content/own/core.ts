/**
 * "Check my own problem" (docs/progress/own-problem.md): the shared core of the constructors that turn what she
 * typed into a ProblemInstance of a module, exactly like a generated one, or say in one plain sentence why not.
 * Pure: no React, no store.
 *
 * Every constructor screens her text here BEFORE anything is solved (length, characters, nesting, the size of
 * numbers and powers), so no input can hang the page or throw: math.js never sees 9^9^9 evaluated by an exact engine.
 */
import type { MathNode } from 'mathjs'
import { normalizeInput, parseExpression, parseStatement } from '@/engine'
import { collectVars, evalNode, fnName, isOp, nodeArgs } from '@/engine/math'
import { toLatex } from '@/notation'
import type { ModuleId, ParseError, VarName } from '@/shared/types'
import type { ProblemInstance } from '../types'

/** Bump when a constructor's output for the same text changes (a saved attempt then starts fresh). */
export const OWN_VERSION = 1
/** The longest problem she may type. */
export const OWN_MAX_LENGTH = 120
/** Parentheses inside parentheses, at most. */
export const OWN_MAX_DEPTH = 6
/** The largest number she may type (a held-down key, or a typo, past it gets a reason). */
export const OWN_MAX_NUMBER = 10_000
/** Decimal places in a number, at most. */
export const OWN_MAX_DECIMALS = 4
/** A power written with a number, like x^12, at most. */
export const OWN_MAX_POWER = 12
/** A part with no letter in it may work out to this size at most. */
export const OWN_MAX_VALUE = 1e6

/** A piece of a sentence: words, a formula (LaTeX, shown with KaTeX), or another module (its title, a link). */
export type OwnPart = string | { tex: string } | { module: ModuleId }

/** Why a problem cannot be checked here, in one plain sentence (two at most). `code` is stable for tests. */
export interface OwnReason {
  code: string
  parts: OwnPart[]
}

export type OwnResult =
  | {
      ok: true
      instance: ProblemInstance
      /** What she will be asked, in the module's words ("Solve for x; give the answer in interval and set notation."). */
      asks: OwnPart[]
    }
  | { ok: false; reason: OwnReason }

/** A kind of problem the builder offers for a module, in the module's own words. */
export interface OwnKind {
  id: string
  /** "Solve an inequality", "Find the inverse". */
  label: string
  /** One example in app syntax, shown as the box's placeholder ("like …"). */
  example: string
  /** The box takes a relation (an equation, an inequality), an expression, or either (f(x) = … or the expression). */
  input: 'relation' | 'expression' | 'either'
  /** Letters the box offers on the keypad. */
  vars: readonly VarName[]
}

/** What she asks of the answer besides the kind: exponential and log equations may want it rounded. */
export interface OwnOptions {
  /** Round the answer to this many decimal places (one of OWN_PLACES); absent: the exact answer. */
  places?: number
}

/** The decimal places she may ask for. */
export const OWN_PLACES = [1, 2, 3, 4] as const

/**
 * The options as her problem's route carries them (`?d=`, like a generated problem's flags) and as the attempt keeps
 * them (`Attempt.difficulty`): '' for the exact answer, 'r3' for three decimal places.
 */
export function ownFlags(options: OwnOptions = {}): string {
  return options.places && (OWN_PLACES as readonly number[]).includes(options.places) ? `r${options.places}` : ''
}

/** The options a route's flags ask for; null when the flags are not ones this app writes. */
export function ownOptionsFromFlags(flags: string | null | undefined): OwnOptions | null {
  if (!flags) return {}
  const m = /^r([1-4])$/.exec(flags)
  return m ? { places: Number(m[1]) } : null
}

/** One module's constructor. */
export interface OwnConstructor {
  moduleId: ModuleId
  kinds: readonly OwnKind[]
  /** She may ask for the answer rounded (exponential and log equations): the builder offers it. */
  rounding?: boolean
  /** Her text as a problem of this kind, or why not. Never throws. Options only reach a constructor that takes them. */
  build: (kindId: string, text: string, options?: OwnOptions) => OwnResult
  /** The kind a template's problems belong to (the problem's route carries the template), or null. */
  kindOfTemplate: (templateId: string) => string | null
}

// ---------------------------------------------------------------------------
// Sentences
// ---------------------------------------------------------------------------

/** A formula in app syntax, for KaTeX. */
export function math(appText: string): { tex: string } {
  try {
    return { tex: toLatex(appText) }
  } catch {
    return { tex: appText.replace(/[\\{}]/g, '') }
  }
}

export function reason(code: string, ...parts: OwnPart[]): OwnReason {
  return { code, parts }
}

export function fail(code: string, ...parts: OwnPart[]): OwnResult {
  return { ok: false, reason: reason(code, ...parts) }
}

/** The sentence as plain text (tests, screen readers): formulas as their LaTeX, modules as their id. */
export function partsText(parts: readonly OwnPart[]): string {
  return parts.map((p) => (typeof p === 'string' ? p : 'tex' in p ? p.tex : `[${p.module}]`)).join('')
}

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

/** Her statement as the route and the ids carry it: the app's ASCII syntax, single spaces. */
export function ownStatement(text: string): string {
  return normalizeInput(text).replace(/\s+/g, ' ').trim()
}

/** FNV-1a of the text from a given start, as an unsigned 32-bit number. */
function fnv1a(text: string, start: number): number {
  let h = start
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** A seed from the statement (FNV-1a), never 0: the checker's sampling stays the same for the same problem. */
export function ownSeed(statement: string): number {
  return fnv1a(statement, 0x811c9dc5) || 1
}

/**
 * Her problem's id, built from the statement: the saved entries of an attempt are keyed by it, so a reload or a
 * Back-and-return finds her lines again. Never a generated problem's id (those have no "own:"). The statement goes in
 * as a 64-bit hash (two FNV-1a runs, base 36), so the id stays short and in the characters every id uses: the tutor's
 * server takes only letters, digits and `_.:@/#?=&+-` (server/src/validate.ts). The statement itself is
 * `instance.own` and `attempt.own`, and an attempt matches a problem only when both agree. `flags` (`ownFlags`: the
 * answer rounded) go into the hash and after it, so the exact and the rounded problem never share saved lines.
 */
export function ownProblemId(moduleId: ModuleId, templateId: string, statement: string, flags = ''): string {
  // A statement never holds a line break (screenText makes every run of spaces one space).
  const text = flags ? `${statement}\n${flags}` : statement
  const key = `${fnv1a(text, 0x811c9dc5).toString(36)}-${fnv1a(text, 0x050c5d1f).toString(36)}`
  return `own:${moduleId}/${templateId}@${OWN_VERSION}/${key}${flags ? `/${flags}` : ''}`
}

// ---------------------------------------------------------------------------
// Screening, before anything is parsed or solved
// ---------------------------------------------------------------------------

const ALLOWED = /^[0-9A-Za-z\s+\-*/^().,=<>!|_{}]*$/

function shownChar(c: string): string {
  if (c === '"') return 'a quotation mark'
  if (c === "'") return 'an apostrophe'
  return c
}

/** Prose names for the signs she might end a line with. */
export function signWord(c: string): string {
  switch (c) {
    case '-':
      return '−'
    case '*':
      return '×'
    case '/':
      return '÷'
    default:
      return c
  }
}

export interface ScreenOptions {
  maxNumber?: number
}

/**
 * Length, characters, nesting and numbers, on the text alone. Returns the statement (normalized) or why not.
 * Runs in microseconds on any string.
 */
export function screenText(text: string, opts: ScreenOptions = {}): { ok: true; statement: string } | { ok: false; reason: OwnReason } {
  const raw = text.trim()
  if (!raw) return { ok: false, reason: reason('empty', 'Type your problem in the box first.') }
  if (raw.length > OWN_MAX_LENGTH) {
    return { ok: false, reason: reason('too_long', `That is longer than I can check: ${OWN_MAX_LENGTH} characters at most, and this has ${raw.length}.`) }
  }
  const statement = ownStatement(raw)
  if (!ALLOWED.test(statement)) {
    const bad = [...statement].find((c) => !ALLOWED.test(c)) ?? '?'
    if (bad === '[' || bad === ']') {
      return { ok: false, reason: reason('bracket', 'Square brackets are for intervals; in a problem, group with parentheses ( ) instead.') }
    }
    return { ok: false, reason: reason('character', `There is a character here I can’t read: ${shownChar(bad)}.`) }
  }
  let depth = 0
  let deepest = 0
  for (const c of statement) {
    if (c === '(' || c === '{') depth++
    else if (c === ')' || c === '}') depth--
    deepest = Math.max(deepest, depth)
  }
  // A line that stops after a sign: what is missing, before the parser says it in its own words.
  const end = /(<=|>=|[+\-*/^=<>,(_])\s*$/.exec(statement)
  if (end) {
    const sign = end[1]!
    if (sign === '(') return { ok: false, reason: reason('missing', 'Something is missing inside the last parentheses.') }
    const glyph = sign === '<=' ? '≤' : sign === '>=' ? '≥' : sign === '_' ? 'underscore' : sign === ',' ? 'comma' : signWord(sign)
    return { ok: false, reason: reason('missing', `Something is missing after the ${glyph}.`) }
  }
  if (deepest > OWN_MAX_DEPTH) {
    return { ok: false, reason: reason('too_deep', `This has more parentheses inside parentheses than I can check: ${OWN_MAX_DEPTH} deep at most.`) }
  }
  const maxNumber = opts.maxNumber ?? OWN_MAX_NUMBER
  for (const m of statement.matchAll(/[0-9.]+/g)) {
    const num = m[0]
    if ((num.match(/\./g) ?? []).length > 1) return { ok: false, reason: reason('number', `The number ${num} has two decimal points.`) }
    if (num === '.') return { ok: false, reason: reason('number', 'There is a decimal point with no digits beside it.') }
    const decimals = num.includes('.') ? num.length - num.indexOf('.') - 1 : 0
    if (decimals > OWN_MAX_DECIMALS) {
      return { ok: false, reason: reason('decimals', `The number ${num} has more decimal places than I can check: ${OWN_MAX_DECIMALS} at most.`) }
    }
    if (Number(num) > maxNumber) {
      return { ok: false, reason: reason('number_too_big', `The number ${num} is bigger than I can check here: ${withCommas(maxNumber)} at most.`) }
    }
  }
  return { ok: true, statement }
}

/** 10000 → "10,000" (no Intl: its first use loads locale data, which takes longer than the whole check). */
function withCommas(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function containsPower(node: MathNode): boolean {
  if (isOp(node, '^')) return true
  if (fnName(node) === 'exp' || fnName(node) === 'nthRoot' || fnName(node) === 'nthroot') return true
  return nodeArgs(node).some(containsPower) || (node.type === 'ParenthesisNode' && containsPower((node as unknown as { content: MathNode }).content))
}

function children(node: MathNode): MathNode[] {
  if (node.type === 'ParenthesisNode') return [(node as unknown as { content: MathNode }).content]
  return nodeArgs(node)
}

/**
 * The parsed sides, before anything is solved: a power inside a power (9^9^9), a power written with a big number
 * (x^20), and a part with no letter in it that is huge or has no value (1/0, log(−5)). Evaluated with plain
 * floating point only (math.js on numbers), never by an exact engine. Null when nothing is wrong.
 */
export function screenTree(sides: readonly MathNode[]): OwnReason | null {
  for (const root of sides) {
    const stack: MathNode[] = [root]
    while (stack.length) {
      const node = stack.pop()!
      if (isOp(node, '^')) {
        const [base, exp] = nodeArgs(node)
        if (exp && containsPower(exp)) return reason('power_in_power', 'This has a power inside a power, and I can’t check that here.')
        if (exp && collectVars(exp).length === 0) {
          const e = evalNode(exp, {})
          if (e === 'undef' || Math.abs(e) > OWN_MAX_POWER) {
            return reason('big_power', `The power ${e === 'undef' ? 'here' : formatNumber(e)} is bigger than I can check: ${OWN_MAX_POWER} at most.`)
          }
          if (base && collectVars(base).length === 0) {
            const v = evalNode(node, {})
            if (v !== 'undef' && Math.abs(v) > OWN_MAX_VALUE) return reason('too_big', 'Part of this works out to a number bigger than I can check here.')
          }
        }
      }
      const vars = collectVars(node)
      if (vars.length === 0 && node.type !== 'ConstantNode' && node.type !== 'SymbolNode') {
        const v = evalNode(node, {})
        if (v === 'undef') return reason('undefined_number', 'Part of this has no value: ', math(node.toString()), ' is undefined.')
        if (Math.abs(v) > OWN_MAX_VALUE) return reason('too_big', 'Part of this works out to a number bigger than I can check here.')
        continue
      }
      stack.push(...children(node))
    }
  }
  return null
}

function formatNumber(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(4)))
}

/**
 * A parse error from the engine as a reason: what is missing and where, in words. `text` is the statement the
 * engine read. Unknown letters are left to the module (`letter` names the letter).
 */
export function parseReason(error: ParseError, text: string): OwnReason {
  const message = error.message
  const letter = /^Unknown letter "([^"]+)"/.exec(message)
  if (letter) return reason('letter', 'This uses the letter ', math(letter[1]!), ', which this kind of problem does not have.')
  if (/ends too early|nothing next to it|Unexpected end/i.test(message)) {
    const before = text.slice(0, Math.min(text.length, Math.max(0, error.position + 1))).trimEnd()
    const last = before[before.length - 1] ?? ''
    const sign = /[+\-*/^]/.test(last) ? last : [...text.trimEnd()].reverse().find((c) => /[+\-*/^]/.test(c))
    if (sign) return reason('missing', `Something is missing after the ${signWord(sign)}.`)
    return reason('missing', 'Something is missing: a number or a letter.')
  }
  if (/side of the relation is empty/i.test(message)) {
    const ops = /(<=|>=|=|<|>)/.exec(text)
    const op = ops?.[1] ?? '='
    const at = ops?.index ?? 0
    const glyph = op === '<=' ? '≤' : op === '>=' ? '≥' : op
    return at <= 0 || !text.slice(0, at).trim()
      ? reason('missing', `Something is missing before the ${glyph}.`)
      : reason('missing', `Something is missing after the ${glyph}.`)
  }
  if (/closing \) is missing|Parenthesis/i.test(message)) return reason('parenthesis', 'A closing parenthesis is missing.')
  if (/must point the same way/i.test(message)) return reason('chain', 'The two signs in this chain point different ways; in a chain both point the same way.')
  if (/Too many comparison signs/i.test(message)) return reason('chain', 'There are too many signs in one piece; join two inequalities with “and”, “or”, or one chain.')
  if (/≠ is not used/i.test(message)) return reason('not_equal', 'The sign ≠ is not one I check here.')
  if (/needs parentheses|in parentheses|needs an input|nothing inside its parentheses/i.test(message)) {
    return reason('function_parens', 'Put what a function applies to in parentheses, like ', math('sqrt(x)'), ' or ', math('log(x)'), '.')
  }
  if (/base/i.test(message)) return reason('log_base', 'Write a log’s base right after the underscore, like ', math('log_2(8)'), '.')
  const closing = (text.match(/\)/g) ?? []).length - (text.match(/\(/g) ?? []).length
  if (closing > 0) return reason('parenthesis', 'There is a closing parenthesis with no opening one.')
  return reason('unreadable', 'I can’t read this as written; the note under the box shows where.')
}

/** What a side is made of, as far as the variable goes (to say why a problem is outside a module). */
export interface Features {
  /** Functions applied to something with the variable: 'sqrt', 'cbrt', 'abs', 'log', 'exp', 'trig', or another name. */
  fns: string[]
  /** Functions of numbers only (√2, log(5)): their values are not whole numbers or fractions. */
  constFns: string[]
  /** The variable is in an exponent (2^x). */
  varInExponent: boolean
  /** The variable is in a denominator (or under a negative power). */
  varInDenominator: boolean
  /** The largest whole-number power written on something with the variable (1 when none). */
  maxPower: number
  /** A fractional power on something with the variable (x^(1/2)). */
  fractionalPower: boolean
  /** π or e written in it. */
  constants: string[]
}

function fnKind(name: string): string {
  if (name === 'sqrt') return 'sqrt'
  if (name === 'cbrt' || name === 'nthRoot' || name === 'nthroot' || name === 'root') return 'cbrt'
  if (name === 'abs') return 'abs'
  if (name === 'log' || name === 'ln' || name === 'log10' || name === 'log2') return 'log'
  if (name === 'exp') return 'exp'
  if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan'].includes(name)) return 'trig'
  return name
}

const FN_WORDS: Record<string, string> = {
  sqrt: 'a square root',
  cbrt: 'a cube root',
  abs: 'an absolute value',
  log: 'a log',
  exp: 'an exponential',
  trig: 'a trig function',
  min: 'a min',
  max: 'a max',
  floor: 'a floor',
  ceil: 'a ceiling',
  round: 'a rounding',
  sign: 'a sign function',
}

/** A function kind from `scanFeatures` in words: "a square root", "a trig function" ("a function" for any other). */
export function fnWords(kind: string): string {
  return FN_WORDS[kind] ?? 'a function'
}

function hasVar(node: MathNode, v: string): boolean {
  return collectVars(node).includes(v)
}

export function scanFeatures(root: MathNode, v: string): Features {
  const out: Features = { fns: [], constFns: [], varInExponent: false, varInDenominator: false, maxPower: 1, fractionalPower: false, constants: [] }
  const add = (list: string[], item: string) => {
    if (!list.includes(item)) list.push(item)
  }
  const visit = (node: MathNode) => {
    if (node.type === 'ParenthesisNode') {
      visit((node as unknown as { content: MathNode }).content)
      return
    }
    if (node.type === 'SymbolNode') {
      const name = (node as unknown as { name: string }).name
      if (name === 'pi' || name === 'e') add(out.constants, name)
      return
    }
    const fn = fnName(node)
    if (fn) {
      add(hasVar(node, v) ? out.fns : out.constFns, fnKind(fn))
    } else if (isOp(node, '^')) {
      const [base, exp] = nodeArgs(node)
      if (exp && hasVar(exp, v)) out.varInExponent = true
      else if (base && exp && hasVar(base, v)) {
        const e = evalNode(exp, {})
        if (e !== 'undef') {
          if (!Number.isInteger(e)) out.fractionalPower = true
          else if (e < 0) out.varInDenominator = true
          else out.maxPower = Math.max(out.maxPower, e)
        }
      }
    } else if (isOp(node, '/')) {
      const d = nodeArgs(node)[1]
      if (d && hasVar(d, v)) out.varInDenominator = true
    }
    for (const a of nodeArgs(node)) visit(a)
  }
  visit(root)
  return out
}

const LOG_NAMES = new Set(['log', 'ln', 'log10', 'log2'])

/** A log inside a log (ln(ln x)): no module takes one, and the log engine's checks on it are slow. */
export function hasLogInLog(root: MathNode): boolean {
  let found = false
  const visit = (n: MathNode, inLog: boolean) => {
    if (found) return
    const name = fnName(n)
    const isLog = name !== null && LOG_NAMES.has(name)
    if (isLog && inLog) {
      found = true
      return
    }
    for (const a of children(n)) visit(a, inLog || isLog)
  }
  visit(root, false)
  return found
}

/** Every letter in the sides (x, y, n, h), sorted. */
export function lettersOf(sides: readonly MathNode[]): string[] {
  const found = new Set<string>()
  for (const s of sides) for (const v of collectVars(s)) found.add(v)
  return [...found].sort()
}

/** "x and y", "x, y and n". */
export function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// ---------------------------------------------------------------------------
// Letters she used that the module does not take
// ---------------------------------------------------------------------------

/** Every letter but e (the constant): to read which letters she used. */
const ANY_LETTERS = 'abcdfghijklmnopqrstuvwxyz'.split('')
/** A function written with its name and its letter: f(x) = …, g(t) = … */
const FUNCTION_LEFT = /^\s*([A-Za-z])\s*\(\s*([A-Za-z])\s*\)\s*=\s*/
const Y_LEFT = /^\s*y\s*=\s*/
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'] as const

/** How a module takes letters, for the reason it gives when hers are others. */
export interface LetterRule {
  /** The letter its problems are written in. */
  main: string
  /** Every letter it takes. */
  allowed: readonly string[]
  /** Several of them may stand in one problem (log properties: x, y and n). */
  together?: boolean
  /** Its problems are functions, typed f(x) = …, y = … or as the expression alone. */
  functions?: boolean
  /** What it checks, after "and here": "the equation is in x alone". */
  here: readonly OwnPart[]
}

/** "x", "x and y", "x, y and n", each letter in KaTeX. */
function letterList(letters: readonly string[]): OwnPart[] {
  const out: OwnPart[] = []
  letters.forEach((l, i) => {
    if (i > 0) out.push(i === letters.length - 1 ? ' and ' : ', ')
    out.push(math(l))
  })
  return out
}

/** The letters in a text read with any letter allowed (functions and constants stay themselves); null if unreadable. */
function lettersIn(text: string): string[] | null {
  const p = /[=<>]/.test(text) ? parseStatement(text, ANY_LETTERS) : parseExpression(text, ANY_LETTERS)
  if (!p.ok) return null
  return lettersOf('node' in p ? [p.node] : p.statement.disjuncts.flat().flatMap((r) => [r.lhs, r.rhs]))
}

/**
 * Her problem uses a letter the module does not take: say which, and what to type instead when swapping letters makes
 * it a problem here ("type it with x in place of t, and I can check it"; a function called g: "type it as
 * f(x) = 2x + 3"). Nothing beyond that: a letter beside the module's own (x and t) only says what is there.
 */
export function letterReason(statement: string, rule: LetterRule): OwnResult {
  let body = statement
  let name: string | null = null
  if (rule.functions) {
    const fn = FUNCTION_LEFT.exec(statement)
    if (fn) {
      name = fn[1]!
      body = statement.slice(fn[0].length)
    } else body = statement.replace(Y_LEFT, '')
  }
  const here: OwnPart[] = [', and here ', ...rule.here]
  const letters = lettersIn(body)
  const foreign = letters?.filter((l) => !rule.allowed.includes(l)) ?? []
  const present = letters?.filter((l) => rule.allowed.includes(l)) ?? []
  if (!foreign.length) {
    // Only the function's name is another letter: g(x) = 2x + 3.
    if (letters && name && name !== 'f') {
      return fail('letter', 'This calls the function ', math(name), ', and here a function is written as ', math(`f(${rule.main})`), '; type it as ', math(`f(${rule.main}) = ${body}`), ', and I can check it.')
    }
    return fail('letter', 'This uses a letter I don’t take', ...here, '.')
  }
  const free = rule.together ? rule.allowed.filter((l) => !present.includes(l)) : present.length ? [] : [rule.main]
  if (foreign.length <= free.length) {
    const swap = free.slice(0, foreign.length)
    return fail(
      'letter',
      foreign.length === 1 ? 'This uses the letter ' : 'This uses the letters ',
      ...letterList(foreign),
      ...here,
      '; type it with ',
      ...letterList(swap),
      ' in place of ',
      ...letterList(foreign),
      ', and I can check it.',
    )
  }
  const all = [...present, ...foreign]
  return fail('letter', `This has ${COUNT_WORDS[all.length] ?? 'several'} letters, `, ...letterList(all), ...here, '.')
}
