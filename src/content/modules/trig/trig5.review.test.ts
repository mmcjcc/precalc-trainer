/**
 * Lessons from the earlier reviews, for Unit 5 (graphs of sine and cosine, of the other four, the inverse functions),
 * with the second half's leak matcher (showsNumber: √ and π belong to the number they touch):
 *  - no catalog entry, rule card, format hint or instruction contains an answer a Unit 5 template generates (2000 seeds
 *    per template), and no card example or format hint reuses seed 1's numbers;
 *  - before a part is answered nothing she can see spells that part's answer or a later one, and neither does any
 *    message she can retry on, counting an answer that ends a sentence;
 *  - every equal exact form, every correctly rounded decimal and every textbook spelling is right: a phase shift as a
 *    signed number (−π/3 for "π/3 left"), a typed degree sign or "rad", a family with another letter or the other sign,
 *    a list in another order;
 *  - no answer equals a number the problem gives, read here from what she sees (the equation's TeX, the words, the
 *    figure's labels), except the numbers a part reads straight off the equation by design (the amplitude |A|, the
 *    midline D, a factored form's shift) and sin(arcsin u) = u, whose answer is its input (the lesson itself);
 *  - prompts read as English: no article before a number, plurals agree, no sentence starts with a symbol, and nothing
 *    she reads before answering prints a button's text ("No value", a quadrant's name);
 *  - a figure never answers a part: the reference triangle labels the side she finds only after she finds it, a graph
 *    labels only its highest and lowest points (never the period or the amplitude), the four cards are named only by
 *    their letters.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { RuleCard, TrigAnswer, TrigPart } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { TRIG_MISTAKE_IDS } from '@/engine/trig'
import type { ModuleId } from '@/shared/types'
import { IT_HINTS, IT_INSTRUCTIONS, IT_RULES } from '../inverseTrig'
import { OG_HINTS, OG_INSTRUCTIONS, OG_RULES } from '../otherTrigGraphs'
import { SG_HINTS, SG_INSTRUCTIONS, SG_RULES } from '../sinusoids'
import { answerForms, figureTextsAt, gradeTrigPart, partCatalogTexts, partShownTexts } from './parts'
import { valueOf } from './resolve5'
import { pieces, plain, showsNumber } from './text'
import { trigAnswerOf } from './testkit'

const SWEEP = 2000
const LOOP_TIMEOUT = 120_000

const cardTexts = (cards: readonly RuleCard[]) => cards.flatMap((c) => [c.title, c.body, c.example ?? ''])

interface ModuleTexts {
  moduleId: ModuleId
  templates: string[]
  cards: readonly RuleCard[]
  hints: readonly string[]
  instructions: readonly string[]
}

const MODULES: ModuleTexts[] = [
  { moduleId: 'sinusoids', templates: ['sg.features', 'sg.equation', 'sg.model'], cards: SG_RULES, hints: SG_HINTS, instructions: Object.values(SG_INSTRUCTIONS) },
  { moduleId: 'otherTrigGraphs', templates: ['og.features', 'og.match'], cards: OG_RULES, hints: OG_HINTS, instructions: Object.values(OG_INSTRUCTIONS) },
  { moduleId: 'inverseTrig', templates: ['it.evaluate', 'it.compose'], cards: IT_RULES, hints: IT_HINTS, instructions: Object.values(IT_INSTRUCTIONS) },
]

const TEMPLATES: [ModuleId, string][] = MODULES.flatMap((m) => m.templates.map((t) => [m.moduleId, t] as [ModuleId, string]))

const answerOf = (moduleId: ModuleId, templateId: string, seed: number): TrigAnswer => trigAnswerOf(generateProblem(moduleId, templateId, seed))

/** The value of an answer as written, or null when it is not one number ("no value", an equation, a set). */
function tryValue(text: string): number | null {
  try {
    const v = valueOf(text)
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// The catalog, the cards, the hints
// ---------------------------------------------------------------------------

const UNIT5_IDS = TRIG_MISTAKE_IDS.slice(TRIG_MISTAKE_IDS.indexOf('trig_amplitude_negative'))

describe('Unit 5’s catalog entries and cards', () => {
  it('31 new trig_ ids, each with a wrong → right example and no special value', () => {
    expect(UNIT5_IDS).toHaveLength(31)
    for (const id of UNIT5_IDS) {
      const e = ERROR_PATTERNS[id]
      expect(e.example, id).toMatch(/✗ →/)
      expect(`${e.lesson} ${e.example}`, id).not.toMatch(/undefined|√[23]|\b1\/2\b|π\/\d/)
    }
  })

  it('the cards name the facts: period 2π/B, phase shift C/B, the inverse ranges', () => {
    const sg = cardTexts(SG_RULES).join(' ')
    expect(sg).toMatch(/2π\/B/)
    expect(sg).toMatch(/C\/B/)
    const og = cardTexts(OG_RULES).join(' ')
    expect(og).toMatch(/π\/B/)
    const it5 = cardTexts(IT_RULES).join(' ')
    expect(it5).toMatch(/\[−π\/2, π\/2\]/)
    expect(it5).toMatch(/\[0, π\]/)
    expect(it5).toMatch(/\(−π\/2, π\/2\)/)
  })

  it('no card works an algebraic problem: with u read as x, no card shows an expression it.compose asks for', { timeout: LOOP_TIMEOUT }, () => {
    const answers = new Set<string>()
    for (let seed = 1; seed <= 400; seed++) {
      const a = answerOf('inverseTrig', 'it.compose', seed)
      for (const s of a.stages) if (s.check.kind === 'function') for (const f of [s.answerText, ...s.forms]) answers.add(f.replace(/\s+/g, '').replace(/\^2/g, '²').replace(/-/g, '−'))
    }
    expect(answers.size).toBeGreaterThan(5)
    for (const text of cardTexts(IT_RULES)) {
      const asX = text.replace(/\bu\b/g, 'x').replace(/\s+/g, '')
      for (const f of answers) expect(asX.includes(f), `${text} works ${f}`).toBe(false)
    }
  })
})

describe.each(MODULES)('$moduleId: no catalog entry, card, hint or instruction holds an answer (2000 seeds per template)', (mod) => {
  it(
    'checked against every answer and spelling the module generates',
    () => {
      const forms = new Set<string>()
      const named = new Set<string>()
      for (const templateId of mod.templates) {
        for (let seed = 1; seed <= SWEEP; seed++) {
          const a = answerOf(mod.moduleId, templateId, seed)
          for (const s of a.stages) {
            for (const f of answerForms(s)) forms.add(f)
            for (const t of s.traps) named.add(t.id)
          }
        }
      }
      for (const id of named) expect((TRIG_MISTAKE_IDS as readonly string[]).includes(id), id).toBe(true)
      const catalog = [...named].flatMap((id) => [ERROR_PATTERNS[id as keyof typeof ERROR_PATTERNS].title, ERROR_PATTERNS[id as keyof typeof ERROR_PATTERNS].lesson, ERROR_PATTERNS[id as keyof typeof ERROR_PATTERNS].example])
      const texts = [...cardTexts(mod.cards), ...mod.hints, ...mod.instructions, ...catalog].filter(Boolean)
      const clashes: string[] = []
      for (const f of forms) if (showsNumber(texts, [f])) clashes.push(`${f}: ${texts.filter((t) => showsNumber([t], [f])).map(plain).join(' / ')}`)
      expect(clashes.slice(0, 10)).toEqual([])
    },
    LOOP_TIMEOUT,
  )
})

describe('the format hints and the card examples do not work seed 1’s problem', () => {
  it.each(MODULES)('$moduleId', { timeout: LOOP_TIMEOUT }, (mod) => {
    for (const templateId of mod.templates) {
      const a = answerOf(mod.moduleId, templateId, 1)
      const given = new Set(shownNumbers(a, 0).filter((n) => Number.isInteger(n) && n > 1))
      const texts = [...mod.cards.map((c) => c.example ?? ''), ...mod.hints, ...a.stages.map((s) => s.formatHint)]
      for (const text of texts) {
        const reused = [...new Set([...text.matchAll(/\d+/g)].map((m) => Number(m[0])))].filter((n) => given.has(n))
        expect(reused.length, `${templateId}: “${text}” reuses ${reused.join(', ')}`).toBeLessThan(2)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Early texts and retry messages
// ---------------------------------------------------------------------------

/** Answers she might type that are not attempts, or are wrong, so the messages beside a retry can be read. */
function retryInputs(part: TrigPart): string[] {
  const out = ['', '???', 'sin(30)', '1/0', '∞', '(5', '2 3', 'undefined', 'no value']
  const c = part.check
  const v = tryValue(part.answerText.replace(/^[a-z] = /, ''))
  switch (c.kind) {
    case 'value':
      out.push('0.866', '1/√2', '√12/2', '2√3/6', '30°', 'π/6', '5 rad', '1 + √3', '-1', '2.5', '3π/2', 'x')
      if (v !== null) out.push(v.toFixed(3), v.toFixed(1), `-(${part.answerText})`)
      break
    case 'shift':
      out.push('3', 'π/4 up', 'right', 'left π', '5π/2 right', '1.57 right', '0.785 left', 'π/4 right left', `${part.answerText} up`)
      break
    case 'midline':
      out.push('x = 2', 'y = 2°', 'y = π', '0', 'y = 1.5', 'y = 3x', `x = ${c.value}`)
      break
    case 'interval':
      out.push('[2, 1]', '(-∞, ∞)', '[-1, 1]', 'y ≥ 2', '[0, 2π]', '(1, 3)', '[1, 3)', 'all real numbers', '1, 3')
      break
    case 'points':
      out.push('(0, 0)', '(π/2, 1), (π, 0)', '(1, 2, 3)', '(0.5, 1)', c.points.map(([x, y]) => `(${y}, ${x})`).join(', '), c.points.slice(1).map(([x, y]) => `(${x}, ${y})`).join(', '))
      break
    case 'function':
      out.push('y = sin(x)', 'y = 3cos(2x) + 1', 'y = 2.5sin(1.3x)', 'cos(x)', 'y = x', 'y = 2sin(3.14x)')
      break
    case 'family':
      out.push('x = π/2 + kπ', 'x = π', 'x = 1.57 + kπ', 'x = kπ', 'k', 'x = π/4, x = 3π/4', 'x = 2 + 3k', 'x = 0.785 + k')
      break
    case 'principal':
      out.push('π/3', '60', '-π/6', '1.047', '2π/3', '120°', '-60°', '0.5', 'π')
      if (v !== null) out.push(v.toFixed(3))
      break
    case 'decimal':
      out.push('1', '0.1', '12345.6', 'π/3', '2.5°', String(Math.round(c.value)), c.value.toFixed(Math.max(0, c.places - 1)), `${c.value.toFixed(c.places)} m`)
      break
    default:
      break
  }
  return out
}

describe.each(TEMPLATES)('%s/%s texts over 2000 seeds', (moduleId, templateId) => {
  const mod = MODULES.find((m) => m.moduleId === moduleId)!
  it(
    'no prompt, instruction, figure label, early text, catalog entry or retry message spells an answer',
    () => {
      const clashes: string[] = []
      for (let seed = 1; seed <= SWEEP && clashes.length < 12; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        const a = trigAnswerOf(p)
        const all = a.stages.flatMap(answerForms)
        for (const text of [p.instructions, a.prompt, a.figure.ariaLabel]) if (text && showsNumber([text], all)) clashes.push(`${p.id}: “${plain(text)}” spells ${all.join(' | ')}`)
        a.stages.forEach((part, i) => {
          const later = a.stages.slice(i).flatMap(answerForms)
          for (const text of figureTextsAt(a, i)) if (showsNumber([text], later)) clashes.push(`${p.id} ${part.id}: the figure’s “${text}” spells ${later.join(' | ')}`)
          for (const text of [...partShownTexts(part), ...partCatalogTexts(part)]) if (text && showsNumber([text], later)) clashes.push(`${p.id} ${part.id}: “${plain(text)}” spells ${later.join(' | ')}`)
          // Function parts are graded by sampling: their retries are checked on every tenth seed.
          if (part.kind === 'function' && seed % 10 !== 1) return
          for (const typed of retryInputs(part)) {
            const g = gradeTrigPart(part, typed)
            if (g.verdict === 'correct') continue
            const said = g.verdict === 'mistake' ? g.witness : g.message
            if (showsNumber([said], later)) clashes.push(`${p.id} ${part.id}: “${typed}” → “${said}” spells ${later.join(' | ')}`)
          }
        })
      }
      expect(clashes).toEqual([])
      void mod
    },
    LOOP_TIMEOUT,
  )
})

// ---------------------------------------------------------------------------
// Every right spelling is right
// ---------------------------------------------------------------------------

const piWord = (s: string) => s.replace(/π/g, 'pi')
const sqrtWord = (s: string) => s.replace(/√(\d+)/g, 'sqrt($1)')

/** The first call of sin or cos in a formula, swapped for the other with a quarter turn: cos(u) = sin(u + π/2). */
function cofunctionForm(text: string): string | null {
  const m = /(sin|cos)\(/.exec(text)
  if (!m) return null
  let depth = 0
  for (let i = m.index + 3; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') {
      depth--
      if (depth === 0) {
        const inside = text.slice(m.index + 4, i)
        const swapped = m[1] === 'cos' ? `sin((${inside}) + π/2)` : `cos((${inside}) - π/2)`
        return text.slice(0, m.index) + swapped + text.slice(i + 1)
      }
    }
  }
  return null
}

/** Spellings of a part's answer, other than its own forms, that grade right. */
function equalForms(part: TrigPart): string[] {
  const c = part.check
  const t = part.answerText
  const right: string[] = []
  switch (c.kind) {
    case 'value': {
      if (t === 'undefined' || t === 'no value') break
      right.push(`(${t})`, piWord(t), sqrtWord(t))
      const pi = /^(-?)(\d*)π\/(\d+)$/.exec(t)
      if (pi) right.push(`${pi[1]}(${pi[2] || 1}/${pi[3]})π`)
      const frac = /^(-?\d+)\/(\d+)$/.exec(t)
      if (frac && [2, 4, 5, 8, 10].includes(Number(frac[2]))) right.push(String(Number(frac[1]) / Number(frac[2])))
      if (['x', 'y', 'r'].includes(part.id)) right.push(`${part.id} = ${t}`)
      break
    }
    case 'shift': {
      const v = c.value
      if (v === '0') {
        right.push('none', 'no shift', '0', 'None')
        break
      }
      const negative = v.startsWith('-')
      const size = negative ? v.slice(1) : v
      const dir = negative ? 'left' : 'right'
      // The textbook's signed phase shift C/B, and the size and direction in other orders and words.
      right.push(negative ? `-${size}` : size, negative ? `−${size}` : `+${size}`, `${dir} ${size}`, `${size} to the ${dir}`, `${size} ${dir === 'left' ? 'L' : 'R'}`, `${piWord(size)} ${dir}`, `${size} units ${dir}`)
      break
    }
    case 'midline':
      right.push(`y=${c.value}`, c.value, `y = (${c.value})`, `y = ${piWord(c.value)}`)
      break
    case 'interval': {
      const band = /^\[(.+), (.+)\]$/.exec(t)
      const union = /^\(-∞, (.+)\] ∪ \[(.+), ∞\)$/.exec(t)
      if (band) right.push(`[${band[1]},${band[2]}]`, `${band[1]} ≤ y ≤ ${band[2]}`, `[ ${band[1]} , ${band[2]} ]`, `[${band[1]!.replace(/-/g, '−')}, ${band[2]!.replace(/-/g, '−')}]`)
      if (union) right.push(`(-∞,${union[1]}]∪[${union[2]},∞)`, `(−∞, ${union[1]!.replace(/-/g, '−')}] ∪ [${union[2]!.replace(/-/g, '−')}, ∞)`, `y ≤ ${union[1]} or y ≥ ${union[2]}`, `(-inf, ${union[1]}] U [${union[2]}, inf)`)
      break
    }
    case 'points': {
      const pts = c.points.map(([x, y]) => `(${x}, ${y})`)
      right.push([...pts].reverse().join(', '), pts.join(','), pts.map(piWord).join(', '), pts.join('; '))
      break
    }
    case 'function': {
      right.push(piWord(t), t.replace(/\s+/g, ''))
      if (c.algebraic) right.push(t.replace(/√\(([^()]*)\)/g, 'sqrt($1)'), t.replace(/\^2/g, '²'), `y = ${t}`)
      else {
        const co = cofunctionForm(t)
        if (co) right.push(co)
      }
      break
    }
    case 'family': {
      if (c.between) {
        const items = t.split(', ')
        right.push([...items].reverse().join(', '), items.join(' and '), items.map((s) => s.replace(/^x = /, '')).join(', '), items.join('; '))
      } else {
        right.push(t.replace(/k/g, 'n'), t.replace(/ \+ (\d*k)/, ' - $1'), `${t}, k ∈ ℤ`, `${t}, where k is an integer`, `${t} for any integer k`, piWord(t))
      }
      break
    }
    case 'principal': {
      if (c.deg === null) {
        right.push('no value', 'No value', 'undefined', 'DNE', 'does not exist')
        break
      }
      if (c.unit === 'rad') right.push(`${t} rad`, `${t} radians`, piWord(t), `(${t})`)
      else right.push(`${t}°`, `${t} degrees`, `${t} °`)
      break
    }
    case 'decimal': {
      right.push(c.value.toFixed(c.places + 1), c.value.toFixed(c.places + 3))
      if (c.units?.length) right.push(`${t} ${c.units[0]}`)
      if (c.unit === 'rad') right.push(`${t} rad`, `${t} radians`)
      break
    }
    default:
      break
  }
  return right
}

describe.each(TEMPLATES)('%s/%s: every equal form, rounding and textbook spelling is right', (moduleId, templateId) => {
  it(
    'over 300 seeds',
    () => {
      const bad: string[] = []
      for (let seed = 1; seed <= 300 && bad.length < 10; seed++) {
        const a = answerOf(moduleId, templateId, seed)
        for (const part of a.stages) {
          for (const t of [part.answerText, ...part.forms, ...equalForms(part)]) {
            const g = gradeTrigPart(part, t)
            if (g.verdict !== 'correct') bad.push(`${templateId}/${seed} ${part.id}: “${t}” — ${g.verdict === 'mistake' ? g.mistake : g.message}`)
          }
        }
      }
      expect(bad).toEqual([])
    },
    LOOP_TIMEOUT,
  )
})

// ---------------------------------------------------------------------------
// No answer is a number the problem gives
// ---------------------------------------------------------------------------

/** The numbers a TeX line shows: \frac{5\pi}{6}, \frac{\pi x}{3} (its coefficient π/3), \frac{x}{3} (1/3), 2x, \sqrt{3}. */
function texNumbers(tex: string): number[] {
  const out: number[] = []
  let t = tex.replace(/\$/g, '').replace(/\^\{-1\}/g, '').replace(/\^\{[^{}]*\}/g, '')
  t = t.replace(/\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\{([^{}]*)\}/g, (_m, n: string, d: string) => {
    // The coefficient: \frac{\pi x}{3} shows π/3 and \frac{x}{3} shows 1/3.
    const top = n.replace(/\\sqrt\{(\d+)\}/g, '√$1').replace(/\\pi/g, 'π').replace(/\s+/g, '').replace(/[xt]/g, '') || '1'
    out.push(valueOf(top) / Number(d))
    return ' '
  })
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)?\s*(\\sqrt\{(\d+)\})?\s*(\\pi)?/g)) {
    if (!m[1] && !m[2] && !m[4]) continue
    out.push((m[1] ? Number(m[1]) : 1) * (m[3] ? Math.sqrt(Number(m[3])) : 1) * (m[4] ? Math.PI : 1))
  }
  return out
}

/** The numbers a sentence shows: "x = −π/2", "14.5 hours", "day 173", "(3π/4, −1)", "√21", and "twelve". */
function textNumbers(s: string): number[] {
  const t = plain(s).replace(/[−–]/g, '-').replace(/⁻¹|\^-1/g, '').replace(/[²³]/g, '').replace(/\btwelve\b/gi, '12')
  const out: number[] = []
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)?(√(\d+))?(π)?(?:\/(\d+(?:\.\d+)?))?/g)) {
    if (!m[1] && !m[2] && !m[4]) continue
    out.push(((m[1] ? Number(m[1]) : 1) * (m[3] ? Math.sqrt(Number(m[3])) : 1) * (m[4] ? Math.PI : 1)) / (m[5] ? Number(m[5]) : 1))
  }
  return out
}

/** Everything she sees while part `i` is open: the words, every part's question, the equation, the figure's labels. */
function shownNumbers(a: TrigAnswer, i: number): number[] {
  return [...textNumbers(a.prompt), ...a.stages.flatMap((s) => textNumbers(s.ask)), ...(a.display ? texNumbers(a.display) : []), ...figureTextsAt(a, i).flatMap(textNumbers)]
}

/** The one number a part's answer is, read from its text (null for a set, an equation, a choice, "no value"). */
function answerNumbers(part: TrigPart): number[] {
  const t = part.answerText
  switch (part.check.kind) {
    case 'value':
    case 'principal':
    case 'decimal': {
      const v = tryValue(t)
      return v === null ? [] : [v]
    }
    case 'midline': {
      const v = tryValue(t.replace(/^y = /, ''))
      return v === null ? [] : [v]
    }
    case 'shift': {
      if (t === 'none') return []
      const v = tryValue(t.replace(/ (left|right)$/, ''))
      return v === null ? [] : [v]
    }
    // A list of x-values or a family is a set, not one number to copy: a csc or cot cycle starts with an asymptote at
    // its shift, so one member may be the shown shift by the rule itself.
    default:
      return []
  }
}

/** The numbers a part may equal by design, read off the given line: |A| for the amplitude, D for the midline, a factored shift. */
function readOffNumbers(a: TrigAnswer, part: TrigPart): number[] {
  const d = (a.display ?? '').replace(/\$/g, '')
  const num = (s: string | undefined) => {
    if (!s) return 1
    const f = /^\\frac\{(\d+)\}\{(\d+)\}$/.exec(s)
    return f ? Number(f[1]) / Number(f[2]) : Number(s)
  }
  if (a.type === 'sinusoids' && a.question === 'features') {
    if (part.id === 'amplitude') {
      const m = /^y = -?(\\frac\{\d+\}\{\d+\}|\d+)?\\(?:sin|cos)/.exec(d)
      return m ? [num(m[1])] : []
    }
    if (part.id === 'midline') {
      const m = /[+-] (\\frac\{\d+\}\{\d+\}|\d+)$/.exec(d)
      return m ? [num(m[1])] : []
    }
    // A shift is read off a factored form, x − C (or x − C/B with B = 1).
    if (part.id === 'shift') return [...d.matchAll(/\bx [+-] ((?:\\frac\{[^{}]*\}\{[^{}]*\})|\d*\\pi|[^\\\s{}]+)/g)].flatMap((m) => texNumbers(m[1]!))
  }
  if (a.type === 'inverseTrig' && a.question === 'compose' && /^\\(sin|cos|tan)\\left\((?:\\arc\1|\\\1\^\{-1\})/.test(d)) {
    // sin(arcsin u) = u: the identity's answer is its input, which is the lesson.
    return texNumbers(d)
  }
  return []
}

const sameSize = (u: number, v: number) => Math.abs(Math.abs(u) - Math.abs(v)) <= 1e-9 * Math.max(1, Math.abs(u))

describe.each(TEMPLATES)('%s/%s: no answer equals a number the problem gives (300 seeds)', (moduleId, templateId) => {
  it(
    'read from what she sees, apart from the numbers a part reads straight off the equation',
    () => {
      const bad: string[] = []
      for (let seed = 1; seed <= 300; seed++) {
        const a = answerOf(moduleId, templateId, seed)
        a.stages.forEach((part, i) => {
          const allowed = readOffNumbers(a, part)
          const shown = shownNumbers(a, i)
          const places = part.check.kind === 'decimal' ? part.check.places : null
          for (const v of answerNumbers(part)) {
            for (const g of shown) {
              const same = places === null ? sameSize(v, g) : Math.abs(Number(Math.abs(g).toFixed(places)) - Math.abs(v)) < 1e-9
              if (same && !allowed.some((x) => sameSize(x, g))) bad.push(`${templateId}/${seed} ${part.id} = ${part.answerText} is shown (${g})`)
            }
          }
        })
      }
      expect(bad.slice(0, 10)).toEqual([])
    },
    LOOP_TIMEOUT,
  )
})

// ---------------------------------------------------------------------------
// English, and no button text in a prompt
// ---------------------------------------------------------------------------

const PLURALS = 'units|feet|meters|hours|minutes|seconds|days|months|degrees'
const SINGULARS = 'unit|foot|meter|hour|minute|second|day|month|degree'

/** What she reads of a problem, as words: the instructions, the prompt, each part's texts and the slips' sentences. */
function readTexts(instructions: string, a: TrigAnswer): string[] {
  return [instructions, a.prompt, ...a.reveal, ...a.stages.flatMap((s) => [s.ask, s.nudge, s.formatHint, s.wrongNote, ...s.reveal, ...s.traps.map((t) => t.witness)])].filter(Boolean).map(plain)
}

describe.each(TEMPLATES)('%s/%s reads as English (300 seeds)', (moduleId, templateId) => {
  it(
    'no article before a number, plurals agree, no sentence starts with a symbol, no button text before she answers',
    () => {
      const bad: string[] = []
      for (let seed = 1; seed <= 300 && bad.length < 10; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        const a = trigAnswerOf(p)
        for (const text of readTexts(p.instructions, a)) {
          if (/\b[Aa]n? \d/.test(text)) bad.push(`${p.id}: an article before a number: ${text}`)
          if (new RegExp(`(?<![\\d.])1 (?:${PLURALS})\\b`).test(text)) bad.push(`${p.id}: one with a plural: ${text}`)
          if (new RegExp(`(?<![\\d.])(?:[02-9]|\\d{2,}|\\d+\\.\\d+) (?:${SINGULARS})\\b(?![-\\w])`).test(text)) bad.push(`${p.id}: a plural missing: ${text}`)
          for (const sentence of text.split(/(?<=[.?!])\s+/)) if (/^[^A-Za-z“"‘(]/.test(sentence.trim()) && sentence.trim()) bad.push(`${p.id}: a sentence starts with a symbol: “${sentence}”`)
        }
        // π (and a radical) in the problem's words is KaTeX: the prompt, the questions, the nudges, the worked lines.
        for (const text of [a.prompt, ...a.reveal, ...a.stages.flatMap((s) => [s.ask, s.nudge, ...s.reveal])]) {
          for (const piece of pieces(text)) if (!piece.tex && /[π√]/.test(piece.text)) bad.push(`${p.id}: π outside KaTeX in “${plain(text)}”`)
        }
        // Before she answers, nothing prints a button's text: "No value", or the right quadrant's name.
        const before = [p.instructions, a.prompt, ...a.stages.flatMap((s) => [s.ask, s.nudge, s.formatHint])].map(plain)
        for (const text of before) if (/no value/i.test(text)) bad.push(`${p.id}: a button’s text in “${text}”`)
        for (const s of a.stages) {
          if (s.kind !== 'choice') continue
          const label = s.choices?.find((c) => c.value === s.answerText)?.label
          if (!label || label.length < 3) continue
          const re = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`)
          for (const text of [s.ask, s.nudge, s.formatHint, s.wrongNote, ...s.traps.map((t) => t.witness)].map(plain)) if (re.test(text)) bad.push(`${p.id} ${s.id}: the right choice “${label}” in “${text}”`)
        }
      }
      expect(bad).toEqual([])
    },
    LOOP_TIMEOUT,
  )
})

// ---------------------------------------------------------------------------
// A figure never answers a part
// ---------------------------------------------------------------------------

describe('a figure never answers a part (300 seeds)', () => {
  it(
    'the reference triangle labels the side she finds only once she has found it, and never shows the value she is asked',
    () => {
      let triangles = 0
      for (let seed = 1; seed <= 300; seed++) {
        const a = answerOf('inverseTrig', 'it.compose', seed)
        if (!a.figure.legs) continue
        triangles++
        const side = a.stages[1]!
        const leg = a.figure.legs[side.id as 'x' | 'y' | 'r']!
        expect(leg.after, `${seed}: the ${side.id} label waits for its part`).toBe(side.id)
        expect(a.figure.waitFor).toBe('quadrant')
        // While the side's part is open, the figure shows the other two sides, never this one.
        const shown = figureTextsAt(a, 1)
        expect(shown, `${seed}`).not.toContain(leg.label)
        for (const other of (['x', 'y', 'r'] as const).filter((c) => c !== side.id)) expect(shown).toContain(a.figure.legs[other]!.label)
        // Before the quadrant is answered, no side is drawn at all.
        for (const c of ['x', 'y', 'r'] as const) expect(figureTextsAt(a, 0)).not.toContain(a.figure.legs[c]!.label)
        // The value she finds last is never a label.
        expect(figureTextsAt(a, 2).some((t) => showsNumber([t], answerForms(a.stages[2]!)))).toBe(false)
      }
      expect(triangles).toBeGreaterThan(40)
    },
    LOOP_TIMEOUT,
  )

  it(
    'a graph to read labels only a highest and a lowest point, never a period or an amplitude; the cards only their letters',
    () => {
      let graphs = 0
      for (let seed = 1; seed <= 300; seed++) {
        const eq = answerOf('sinusoids', 'sg.equation', seed)
        if (eq.figure.kind === 'graph') {
          graphs++
          const g = eq.figure.graph!
          const marks = g.markers ?? []
          expect(marks).toHaveLength(2)
          for (const mk of marks) expect(mk.label, `${seed}`).toMatch(/^\(.+, .+\)$/)
          const ys = marks.map((mk) => mk.y)
          const samples = (g.runs ?? []).flat().map((s) => s.y)
          expect(Math.max(...ys)).toBeCloseTo(Math.max(...samples), 6)
          expect(Math.min(...ys)).toBeCloseTo(Math.min(...samples), 6)
          for (const t of figureTextsAt(eq, 0)) expect(t, `${seed}`).not.toMatch(/period|amplitude|midline/i)
        }
        const match = answerOf('otherTrigGraphs', 'og.match', seed)
        for (const card of match.figure.graphs ?? []) {
          expect(card.graph.ariaLabel).toBe(`Graph ${card.letter}`)
          expect(card.graph.markers ?? []).toHaveLength(0)
        }
      }
      expect(graphs).toBeGreaterThan(100)
    },
    LOOP_TIMEOUT,
  )
})
