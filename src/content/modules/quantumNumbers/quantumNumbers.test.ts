import { describe, expect, it } from 'vitest'
import { generateProblem, getModule, MODULES } from '@/content'
import type { QnCheck, QuantumAnswer } from '@/content/types'
import { answerLeaks } from './facts'
import { QN_MISTAKE_IDS, assertQuantum, gradeQnStage, type QnGrade } from './grade'
import { QN_RULE_IDS } from './rules'

const SEEDED = 120_000
const TEMPLATES = ['qn.meaning', 'qn.allowed', 'qn.count', 'qn.name', 'qn.shapes', 'qn.pauli'] as const
const EXEMPT = new Set(['Allowed', 'Not allowed'])

function answerOf(templateId: string, seed: number): QuantumAnswer {
  const p = generateProblem('quantumNumbers', templateId, seed)
  if (p.answer.type !== 'quantum') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

function grade(check: QnCheck, text: string): QnGrade {
  const answer: QuantumAnswer = {
    type: 'quantum',
    question: 'count',
    prompt: 'Hand worked.',
    stages: [
      {
        id: 'a',
        kind: 'text',
        label: 'Answer',
        hint: 'A whole number.',
        answerText: 'hand',
        nudge: 'Count what the question names.',
        ruleCard: 'qn-count',
        reveal: ['Shown later.'],
        traps: [],
        check,
      },
    ],
    expectedDisplay: 'hand',
    reveal: ['Shown later.'],
    ruleCards: ['qn-count'],
  }
  return gradeQnStage(answer, 'a', text)
}

function mistake(check: QnCheck, text: string): string {
  const graded = grade(check, text)
  if (graded.verdict !== 'mistake') throw new Error(`${check.kind} "${text}" graded ${graded.verdict}`)
  return graded.mistake
}

describe('quantum numbers registration', () => {
  it('is Chemistry, in chapter 5 after electrons, with six templates and the Pauli card', () => {
    const m = getModule('quantumNumbers')
    expect(m.subject).toBe('Chemistry')
    expect(m.title).toBe('Quantum numbers and orbitals')
    expect(m.order).toBeGreaterThan(getModule('electrons').order)
    expect(m.order).toBeLessThan(getModule('periodic').order)
    const ids = MODULES.map((mod) => mod.id)
    expect(ids.indexOf('quantumNumbers')).toBe(ids.indexOf('electrons') + 1)
    expect(m.templates.map((t) => t.id)).toEqual([...TEMPLATES])
    expect(m.ruleCards.map((card) => card.id)).toEqual([...Object.values(QN_RULE_IDS), 'ec-pauli'])
    const sample = generateProblem('quantumNumbers', 'qn.meaning', 1)
    expect(m.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(m.nextStep(sample, null, false)).toBeNull()
    expect(sample.kind).toBe('quantumNumbers')
    expect(sample.id).toBe('quantumNumbers/qn.meaning@1/1')
  })
})

describe('hand-worked quantum numbers', () => {
  it('grades the textbook cases, including each named slip', () => {
    expect(grade({ kind: 'values-l', n: 3 }, '0, 1, 2').verdict).toBe('correct')
    expect(mistake({ kind: 'values-l', n: 3 }, '0, 1, 2, 3')).toBe('qn_l_equals_n')
    expect(grade({ kind: 'values-ml', l: 2 }, '−2, −1, 0, 1, 2').verdict).toBe('correct')
    expect(grade({ kind: 'ml-list', l: 2 }, '2, 1, 0, −1, −2').verdict).toBe('correct')
    expect(grade({ kind: 'sub-electrons', l: 2 }, '10').verdict).toBe('correct')
    expect(mistake({ kind: 'sub-electrons', l: 2 }, '5')).toBe('qn_sublevel_electrons_as_orbitals')
    expect(grade({ kind: 'shell-orbitals', n: 3 }, '9').verdict).toBe('correct')
    expect(mistake({ kind: 'shell-orbitals', n: 3 }, '18')).toBe('qn_shell_orbitals_as_electrons')
    expect(grade({ kind: 'shell-electrons', n: 3 }, '18').verdict).toBe('correct')
    expect(mistake({ kind: 'shell-electrons', n: 3 }, '9')).toBe('qn_shell_electrons_as_orbitals')
    expect(grade({ kind: 'name', n: 2, l: 2 }, 'Does not exist').verdict).toBe('correct')
    expect(mistake({ kind: 'name', n: 2, l: 2 }, '2d')).toBe('qn_l_equals_n')
    expect(grade({ kind: 'name', n: 1, l: 1 }, 'Does not exist').verdict).toBe('correct')
    expect(mistake({ kind: 'name', n: 1, l: 1 }, '1p')).toBe('qn_l_equals_n')
    expect(grade({ kind: 'allowed', n: 2, l: 1, ml: 0, ms2: 1 }, 'Allowed').verdict).toBe('correct')
    expect(grade({ kind: 'allowed', n: 2, l: 2, ml: 0, ms2: 1 }, 'Not allowed').verdict).toBe('correct')
    expect(mistake({ kind: 'allowed', n: 2, l: 2, ml: 0, ms2: 1 }, 'Allowed')).toBe('qn_l_equals_n')
    expect(grade({ kind: 'breaks', n: 2, l: 2, ml: 0, ms2: 1 }, 'the angular momentum quantum number').verdict).toBe('correct')
    expect(grade({ kind: 'allowed', n: 3, l: 1, ml: 2, ms2: -1 }, 'Not allowed').verdict).toBe('correct')
    expect(mistake({ kind: 'allowed', n: 3, l: 1, ml: 2, ms2: -1 }, 'Allowed')).toBe('qn_ml_out_of_range')
    expect(grade({ kind: 'breaks', n: 3, l: 1, ml: 2, ms2: -1 }, 'the magnetic quantum number').verdict).toBe('correct')
    expect(grade({ kind: 'allowed', n: 1, l: 0, ml: 0, ms2: 2 }, 'Not allowed').verdict).toBe('correct')
    expect(mistake({ kind: 'allowed', n: 1, l: 0, ml: 0, ms2: 2 }, 'Allowed')).toBe('qn_ms_integer')
    expect(grade({ kind: 'breaks', n: 1, l: 0, ml: 0, ms2: 2 }, 'the spin quantum number').verdict).toBe('correct')
    expect(grade({ kind: 'partner', n: 3, l: 2, ml: -1, ms2: 1 }, '(3, 2, −1, −1/2)').verdict).toBe('correct')
    expect(mistake({ kind: 'partner', n: 3, l: 2, ml: -1, ms2: 1 }, '(3, 2, −1, +1/2)')).toBe('qn_same_spin')
    expect(grade({ kind: 'nl-electrons', n: 4, l: 1 }, '6').verdict).toBe('correct')
    expect(grade({ kind: 'sub-orbitals', l: 0 }, '1').verdict).toBe('correct')
    expect(grade({ kind: 'orbital-electrons' }, '2').verdict).toBe('correct')
    expect(grade({ kind: 'nlm-electrons', n: 3, l: 1, ml: 0 }, '2').verdict).toBe('correct')
    expect(grade({ kind: 'sublevels', n: 3 }, '3d, 3s, 3p').verdict).toBe('correct')
    expect(mistake({ kind: 'values-n' }, '0, 1, 2, …')).toBe('qn_n_zero')
    expect(mistake({ kind: 'values-ms' }, '0, +1 or −1')).toBe('qn_ms_integer')
    expect(mistake({ kind: 'ml-list', l: 2 }, '−2, −1, 1, 2')).toBe('qn_ml_missing_zero')
    expect(mistake({ kind: 'ml-list', l: 2 }, '0, 1, 2')).toBe('qn_ml_nonnegative')
    expect(mistake({ kind: 'ml-list', l: 2, n: 3 }, '2')).toBe('qn_ml_as_l')
    expect(mistake({ kind: 'ml-list', l: 2, n: 3 }, '3')).toBe('qn_ml_as_n')
    expect(mistake({ kind: 'ml-list', l: 2 }, '−3, −2, −1, 0, 1, 2, 3')).toBe('qn_ml_out_of_range')
    expect(mistake({ kind: 'shape', orbital: 'dxy' }, 'dx²−y²')).toBe('qn_dxy_dx2y2_swapped')
    expect(mistake({ kind: 'shape', orbital: 'dx2y2' }, 'dxy')).toBe('qn_dxy_dx2y2_swapped')
    expect(mistake({ kind: 'shape', orbital: 'px' }, 'py')).toBe('qn_p_axis_mixed')
    expect(mistake({ kind: 'shape', orbital: 'pz' }, 'px')).toBe('qn_p_axis_mixed')
    expect(grade({ kind: 'pair', n: 3, l: 2, ml: -1, ms2: 1 }, '(3, 2, −1, +1/2) and (3, 2, −1, +1/2)').verdict).toBe('correct')
    expect(grade({ kind: 'pair', n: 3, l: 2, ml: -1, ms2: 1 }, '(3, 2, −1, +1/2) and (3, 2, −1, −1/2)').verdict).toBe('wrong')
    expect(mistake({ kind: 'set-count', n: 4, l: 0, ml: 0, ms2: 1 }, '2')).toBe('qn_same_four')
    expect(grade({ kind: 'set-count', n: 4, l: 0, ml: 0, ms2: 1 }, '1').verdict).toBe('correct')
    expect(QN_MISTAKE_IDS).toHaveLength(15)
  })

  it('accepts every equal form a textbook would, and rejects yes or no', () => {
    const ml = { kind: 'ml-list', l: 2 } as const
    for (const text of ['−2, −1, 0, 1, 2', '2, 1, 0, -1, -2', '–2, –1, 0, 1, 2', '—2 —1 0 1 2', '−2, −1, 0, 1 and 2']) {
      expect(grade(ml, text).verdict, text).toBe('correct')
    }
    const spins = { kind: 'values-ms' } as const
    for (const text of ['+1/2 or −1/2', '1/2 or -1/2', '+½ or −½', '+0.5 or -0.5', '−1/2 or +1/2']) {
      expect(grade(spins, text).verdict, text).toBe('correct')
    }
    const allowed = { kind: 'allowed', n: 2, l: 1, ml: 0, ms2: 1 } as const
    expect(grade(allowed, 'allowed').verdict).toBe('correct')
    expect(grade(allowed, 'is allowed').verdict).toBe('correct')
    expect(grade(allowed, 'yes').verdict).toBe('invalid')
    expect(grade(allowed, 'no').verdict).toBe('invalid')
    const blocked = { kind: 'allowed', n: 2, l: 2, ml: 0, ms2: 1 } as const
    expect(grade(blocked, 'not allowed').verdict).toBe('correct')
    expect(grade(blocked, 'is not allowed').verdict).toBe('correct')
    expect(grade(blocked, "isn't allowed").verdict).toBe('correct')
    expect(grade(blocked, 'not').verdict).toBe('invalid')
    expect(grade({ kind: 'name', n: 4, l: 3 }, '4F').verdict).toBe('correct')
    expect(grade({ kind: 'name', n: 2, l: 2 }, "doesn't exist").verdict).toBe('correct')
    expect(grade({ kind: 'name', n: 2, l: 2 }, 'doesnt exist').verdict).toBe('correct')
    expect(grade({ kind: 'shape', orbital: 'dx2y2' }, 'dx2-y2').verdict).toBe('correct')
    expect(grade({ kind: 'shape', orbital: 'dx2y2' }, 'dx^2-y^2').verdict).toBe('correct')
    expect(grade({ kind: 'shape', orbital: 'dx2y2' }, 'd(x2-y2)').verdict).toBe('correct')
    expect(grade({ kind: 'shape', orbital: 'dz2' }, 'dz²').verdict).toBe('correct')
    expect(grade({ kind: 'shape', orbital: 'dz2' }, 'dz2').verdict).toBe('correct')
    expect(grade({ kind: 'sub-electrons', l: 2 }, 'the answer is 10 electrons').verdict).toBe('correct')
    expect(grade({ kind: 'sublevels', n: 3 }, '3S 3P 3D').verdict).toBe('correct')
    expect(grade({ kind: 'partner', n: 3, l: 2, ml: -1, ms2: 1 }, '(3, 2, -1, -1/2)').verdict).toBe('correct')
    expect(grade({ kind: 'partner', n: 3, l: 2, ml: -1, ms2: 1 }, '(3, 2, −1, -0.5)').verdict).toBe('correct')
    expect(grade({ kind: 'partner', n: 3, l: 2, ml: -1, ms2: 1 }, '(3, 2, −1, +½)').verdict).toBe('mistake')
  })
})

const LETTERS = ['s', 'p', 'd', 'f', 'g', 'h', 'i']
const JOB = {
  n: 'the principal quantum number',
  l: 'the angular momentum quantum number',
  ml: 'the magnetic quantum number',
  ms: 'the spin quantum number',
} as const
const TELLS = {
  n: "the energy level and the orbital's size",
  l: "the sublevel and the orbital's shape",
  ml: "the orbital's orientation",
  ms: "the electron's spin",
} as const
const JOB_OF = Object.fromEntries(Object.entries(JOB).map(([id, text]) => [text, id])) as Record<string, keyof typeof JOB>
const TELL_OF = Object.fromEntries(Object.entries(TELLS).map(([id, text]) => [text, id])) as Record<string, keyof typeof TELLS>

const FIGURE_PROMPTS = new Set([
  'Which orbital is drawn?',
  'What is the name of the orbital in the picture?',
  'Name the orbital shown.',
  'Which orbital does the picture show?',
])

const ARIA: Record<string, string> = {
  'A sphere, the same in every direction': 's',
  'Two lobes, along the x axis': 'px',
  'Two lobes, along the y axis': 'py',
  'Two lobes, along the z axis': 'pz',
  'Four lobes, between the x and y axes': 'dxy',
  'Four lobes, between the x and z axes': 'dxz',
  'Four lobes, between the y and z axes': 'dyz',
  'Four lobes, along the x and y axes': 'dx²−y²',
  'Two lobes along the z axis, with a ring in the xy plane': 'dz²',
}

const WORDS: Record<string, string> = {
  'Which d orbital has its lobes along the x and y axes?': 'dx²−y²',
  'Which d orbital has its lobes between the x and y axes?': 'dxy',
  'Which d orbital has its lobes between the x and z axes?': 'dxz',
  'Which d orbital has its lobes between the y and z axes?': 'dyz',
  'Which d orbital has two lobes along the z axis and a ring in the xy plane?': 'dz²',
  'Which p orbital lies along the x axis?': 'px',
  'Which p orbital lies along the y axis?': 'py',
  'Which p orbital lies along the z axis?': 'pz',
  'Which orbital is a sphere?': 's',
}

function num(raw: string): number {
  return Number(raw.replace(/[−–—]/g, '-'))
}

function fmt(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : String(n)
}

function list(values: number[]): string {
  return values.map(fmt).join(', ')
}

function mlList(l: number): string {
  const values: number[] = []
  for (let m = -l; m <= l; m++) values.push(m)
  return list(values)
}

function lValues(n: number): string {
  const values: number[] = []
  for (let v = 0; v < n; v++) values.push(v)
  return list(values)
}

function spinOf(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/[−–—]/g, '-').replace(/½/g, '1/2').replace(/\s+/g, '')
  if (t === '+1/2' || t === '1/2' || t === '+0.5' || t === '0.5' || t === '.5') return '+'
  if (t === '-1/2' || t === '-0.5' || t === '-.5') return '-'
  if (t === '0' || t === '+0' || t === '-0') return '0'
  if (t === '+1' || t === '1') return '+1'
  if (t === '-1') return '-1'
  return t
}

function broken(n: number, l: number, ml: number, ms: string): 'n' | 'l' | 'ml' | 'ms' | null {
  if (!Number.isInteger(n) || n < 1) return 'n'
  if (!Number.isInteger(l) || l < 0 || l > n - 1) return 'l'
  if (!Number.isInteger(ml) || ml < -l || ml > l) return 'ml'
  if (ms !== '+' && ms !== '-') return 'ms'
  return null
}

function shellN(phrase: string): number {
  if (phrase === 'the first shell') return 1
  const m = /^shell (\d+)$/.exec(phrase)
  if (!m) throw new Error(`shell ${phrase}`)
  return Number(m[1])
}

function lOfArticle(phrase: string): number {
  const m = /^(an|a) ([spdf]) sublevel$/.exec(phrase)
  if (!m) throw new Error(`sublevel ${phrase}`)
  return 'spdf'.indexOf(m[2]!)
}

function sublevelCalled(n: number, l: number): string {
  if (l < 0 || l >= n || l >= LETTERS.length) return 'Does not exist'
  return `${n}${LETTERS[l]}`
}

function sublevels(n: number): string {
  const names: string[] = []
  for (let l = 0; l < n && l < LETTERS.length; l++) names.push(`${n}${LETTERS[l]}`)
  return names.join(', ')
}

interface SetRead {
  n: number
  l: number
  ml: number
  ms: string
}

function parseSet(raw: string): SetRead | null {
  const m = raw.trim().match(/^\(\s*(\d+)\s*,\s*(\d+)\s*,\s*([−–—-]?\d+)\s*,\s*([^)]+?)\s*\)$/)
  if (!m) return null
  return { n: Number(m[1]), l: Number(m[2]), ml: num(m[3]!), ms: spinOf(m[4]!) }
}

function sameSet(a: SetRead, b: SetRead): boolean {
  return a.n === b.n && a.l === b.l && a.ml === b.ml && a.ms === b.ms
}

function readNums(prompt: string): { n: number; l: number; ml: number; ms: string } | null {
  const m = /^Can an electron have the quantum numbers n = (\d+), l = (\d+), ml = ([−–—-]?\d+), and ms = ([^?]+)\?/.exec(prompt)
  if (!m) return null
  return { n: Number(m[1]), l: Number(m[2]), ml: num(m[3]!), ms: spinOf(m[4]!) }
}

/** The answer, decided from the prompt and the picture. Not from the generator. */
function solveText(prompt: string): string {
  let m = /^How many orbitals are in (an s sublevel|a p sublevel|a d sublevel|an f sublevel)\?$/.exec(prompt)
  if (m) return String(2 * lOfArticle(m[1]!) + 1)
  m = /^How many orbitals does a sublevel have when the angular momentum quantum number is (\d+)\?$/.exec(prompt)
  if (m) return String(2 * Number(m[1]) + 1)
  m = /^How many electrons can (an s sublevel|a p sublevel|a d sublevel|an f sublevel) hold\?$/.exec(prompt)
  if (m) return String(2 * (2 * lOfArticle(m[1]!) + 1))
  m = /^How many electrons can a sublevel hold when the angular momentum quantum number is (\d+)\?$/.exec(prompt)
  if (m) return String(2 * (2 * Number(m[1]) + 1))
  if (prompt === 'What is the most electrons one orbital can hold?' || prompt === 'How many electrons can share one orbital?') return '2'
  m = /^How many orbitals are in (the first shell|shell \d+)\?$/.exec(prompt)
  if (m) return String(shellN(m[1]!) ** 2)
  m = /^How many orbitals does (the first shell|shell \d+) hold\?$/.exec(prompt)
  if (m) return String(shellN(m[1]!) ** 2)
  m = /^How many electrons can (the first shell|shell \d+) hold\?$/.exec(prompt)
  if (m) return String(2 * shellN(m[1]!) ** 2)
  m = /^What is the most electrons (the first shell|shell \d+) can hold\?$/.exec(prompt)
  if (m) return String(2 * shellN(m[1]!) ** 2)
  m = /^List the values of the magnetic quantum number when the angular momentum quantum number is (\d+)\.$/.exec(prompt)
  if (m) return mlList(Number(m[1]))
  m = /^List every magnetic quantum number for the (\d)([spdfghi]) sublevel\.$/.exec(prompt)
  if (m) return mlList(LETTERS.indexOf(m[2]!))
  m = /^Which sublevels are in shell (\d+)\?$/.exec(prompt)
  if (m) return sublevels(Number(m[1]))
  m = /^List the sublevels of shell (\d+)\.$/.exec(prompt)
  if (m) return sublevels(Number(m[1]))
  m = /^How many electrons in an atom can have n = (\d+) and l = (\d+)\?$/.exec(prompt)
  if (m) return String(2 * (2 * Number(m[2]) + 1))
  m = /^How many electrons in an atom can have n = (\d+), l = (\d+), and ml = [−–—-]?\d+\?$/.exec(prompt)
  if (m) return '2'
  m = /^The sublevel is (\d)([spdfghi])\. What is the principal quantum number\?$/.exec(prompt)
  if (m) return m[1]!
  m = /^The sublevel is (\d)([spdfghi])\. What is the angular momentum quantum number\?$/.exec(prompt)
  if (m) return String(LETTERS.indexOf(m[2]!))
  m = /^The sublevel is (\d)([spdfghi])\. List every value of the magnetic quantum number\.$/.exec(prompt)
  if (m) return mlList(LETTERS.indexOf(m[2]!))
  throw new Error(`unparsed text: ${prompt}`)
}

function rights(prompt: string, aria: string | undefined, choices: string[]): string[] {
  const named = expected(prompt, aria, choices)
  if (typeof named === 'string') return choices.filter((choice) => choice === named)
  return choices.filter(named)
}

function expected(prompt: string, aria: string | undefined, choices: string[]): string | ((choice: string) => boolean) {
  if (FIGURE_PROMPTS.has(prompt)) {
    if (!aria || !(aria in ARIA)) throw new Error(`picture without a description: ${prompt}`)
    return ARIA[aria]!
  }
  if (prompt in WORDS) return WORDS[prompt]!
  if (prompt === 'How many orientations does an s orbital have?') return '1'
  let m = /^What does (.+) tell you\?$/.exec(prompt)
  if (m) return TELLS[JOB_OF[m[1]!]!]
  m = /^Which symbol is used for (.+)\?$/.exec(prompt)
  if (m) return JOB_OF[m[1]!]!
  m = /^Which quantum number tells you (.+)\?$/.exec(prompt)
  if (m) return JOB[TELL_OF[m[1]!]!]
  if (prompt === 'Which values can the principal quantum number take?') return '1, 2, 3, …'
  if (prompt === 'Which values can the spin quantum number take?') return '+1/2 or −1/2'
  m = /^Which values can the angular momentum quantum number take when the principal quantum number is (\d+)\?$/.exec(prompt)
  if (m) return lValues(Number(m[1]))
  m = /^The principal quantum number is (\d+)\. Which values can the angular momentum quantum number take\?$/.exec(prompt)
  if (m) return lValues(Number(m[1]))
  m = /^Which values can the magnetic quantum number take when the angular momentum quantum number is (\d+)\?$/.exec(prompt)
  if (m) return mlList(Number(m[1]))
  m = /^The angular momentum quantum number is (\d+)\. Which values can the magnetic quantum number take\?$/.exec(prompt)
  if (m) return mlList(Number(m[1]))
  m = /^An electron has the principal quantum number (\d+) and the angular momentum quantum number (\d+)\. What is the sublevel called\?$/.exec(prompt)
  if (m) return sublevelCalled(Number(m[1]), Number(m[2]))
  const nums = readNums(prompt)
  if (nums && (choices.includes('Allowed') || choices.includes('Not allowed'))) return broken(nums.n, nums.l, nums.ml, nums.ms) ? 'Not allowed' : 'Allowed'
  // Review 2026-10-23: an allowed set's second part asks for the electron's sublevel.
  if (nums && choices.includes('Does not exist')) return sublevelCalled(nums.n, nums.l)
  if (nums && choices.every((choice) => (Object.values(JOB) as string[]).includes(choice))) {
    const why = broken(nums.n, nums.l, nums.ml, nums.ms)
    if (!why) throw new Error('which number on an allowed set')
    return JOB[why]
  }
  m = /^One electron in an orbital has n = (\d+), l = (\d+), ml = ([−–—-]?\d+), and ms = ([^.]+)\. Which set describes the other electron in that same orbital\?$/.exec(prompt)
  if (m) {
    const source = { n: Number(m[1]), l: Number(m[2]), ml: num(m[3]!), ms: spinOf(m[4]!) }
    const want = source.ms === '+' ? '-' : '+'
    return (choice) => {
      const got = parseSet(choice)
      return got !== null && got.n === source.n && got.l === source.l && got.ml === source.ml && got.ms === want
    }
  }
  if (prompt === 'Which pair of sets breaks the Pauli exclusion principle?') {
    return (choice) => {
      const parts = choice.split(/\s+and\s+/i)
      if (parts.length !== 2) return false
      const a = parseSet(parts[0]!)
      const b = parseSet(parts[1]!)
      return a !== null && b !== null && sameSet(a, b)
    }
  }
  if (/^How many electrons in one atom can have n = \d+, l = \d+, ml = [−–—-]?\d+, and a spin of (positive one half|negative one half)\?$/.test(prompt)) return '1'
  throw new Error(`unparsed choice: ${prompt}`)
}

describe('each quantum template over 300 seeds', () => {
  it.each(TEMPLATES)(
    '%s is deterministic, grades itself, and keeps the answer off the page',
    (templateId) => {
      for (let seed = 1; seed <= 300; seed++) {
        const first = generateProblem('quantumNumbers', templateId, seed)
        const second = generateProblem('quantumNumbers', templateId, seed)
        expect(second).toEqual(first)
        const answer = answerOf(templateId, seed)
        assertQuantum(answer)
        expect(answer.prompt).not.toMatch(/\b[Aa]n? \d/)
        expect(answer.prompt).not.toMatch(/\b1 (orbitals|electrons|orientations|sublevels|values)\b/)
        for (const stage of answer.stages) {
          expect(gradeQnStage(answer, stage.id, stage.answerText).verdict).toBe('correct')
          const surfaces = [answer.prompt, stage.hint, stage.nudge, ...stage.traps.map((trap) => trap.witness)]
          if (answer.figure) surfaces.push(answer.figure.ariaLabel)
          for (const surface of surfaces) {
            expect(answerLeaks(surface, stage.answerText), `${templateId}/${seed} ${surface}`).toBe(false)
          }
        }
        const possible = answer.stages.some((stage) => stage.traps.length > 0)
        if (possible) {
          expect(answer.trap, `${templateId}/${seed}`).toBeTruthy()
          const stage = answer.stages.find((item) => item.id === answer.trapStage)
          expect(stage?.traps.some((trap) => trap.id === answer.trap && trap.text === answer.trapAnswer)).toBe(true)
          const graded = gradeQnStage(answer, answer.trapStage!, answer.trapAnswer!)
          expect(graded.verdict).toBe('mistake')
          if (graded.verdict === 'mistake') expect(graded.mistake).toBe(answer.trap)
        }
      }
    },
    SEEDED,
  )
})

describe('quantum answer distribution', () => {
  it(
    '300 seeds show many problems, and no answer crowds the page',
    () => {
      const notes: string[] = []
      for (const templateId of TEMPLATES) {
        const problems = new Set<string>()
        const answers = new Map<string, number>()
        const prompts = new Map<string, number>()
        const slots = [0, 0, 0, 0]
        let choices4 = 0
        let allowed = 0
        for (let seed = 1; seed <= 300; seed++) {
          const answer = answerOf(templateId, seed)
          const key = `${answer.prompt}|${answer.figure?.ariaLabel ?? ''}|${answer.stages.map((stage) => (stage.choices ?? []).map((choice) => choice.text).join('/')).join('~')}`
          problems.add(key)
          prompts.set(answer.prompt, (prompts.get(answer.prompt) ?? 0) + 1)
          const seen = new Set(answer.stages.map((stage) => stage.answerText))
          for (const text of seen) answers.set(text, (answers.get(text) ?? 0) + 1)
          if (templateId === 'qn.allowed' && answer.stages[0]?.answerText === 'Allowed') allowed += 1
          for (const stage of answer.stages) {
            if (stage.kind !== 'choice' || stage.choices?.length !== 4) continue
            choices4 += 1
            const index = stage.choices.findIndex((choice) => choice.text === stage.answerText)
            if (index >= 0 && index < 4) slots[index] = (slots[index] ?? 0) + 1
          }
        }
        if (problems.size < 20) notes.push(`${templateId} distinct ${problems.size}`)
        for (const [text, count] of answers) {
          if (!EXEMPT.has(text) && count / 300 > 0.15) notes.push(`${templateId} answer ${count}/300 "${text}"`)
        }
        if (choices4 > 0) {
          for (let i = 0; i < 4; i++) {
            const frac = (slots[i] ?? 0) / choices4
            if (frac < 0.15 || frac > 0.35) notes.push(`${templateId} slot ${i} ${(frac * 100).toFixed(1)}% of ${choices4}`)
          }
        }
        if (templateId === 'qn.allowed' && (allowed / 300 < 0.3 || allowed / 300 > 0.45)) notes.push(`allowed ${allowed}/300`)
        const heaviest = [...prompts.entries()].sort((a, b) => b[1] - a[1])[0]
        if (heaviest && heaviest[1] / 300 > 0.5) notes.push(`${templateId} prompt ${heaviest[1]}/300 "${heaviest[0]}"`)
      }
      expect(notes, notes.join('\n')).toEqual([])
    },
    SEEDED,
  )
})

describe('solve the prompt again, without the generator', () => {
  it.each(TEMPLATES)(
    '%s has one right reading of the prompt, and it is the template answer',
    (templateId) => {
      for (let seed = 1; seed <= 300; seed++) {
        const answer = answerOf(templateId, seed)
        for (const stage of answer.stages) {
          const where = `${templateId}/${seed} ${answer.prompt}`
          if (stage.kind === 'choice') {
            const texts = (stage.choices ?? []).map((choice) => choice.text)
            const got = rights(answer.prompt, answer.figure?.ariaLabel, texts)
            expect(got, where).toEqual([stage.answerText])
            expect(gradeQnStage(answer, stage.id, got[0]!).verdict).toBe('correct')
          } else {
            const solved = solveText(answer.prompt)
            expect(solved, where).toBe(stage.answerText)
            expect(gradeQnStage(answer, stage.id, solved).verdict).toBe('correct')
          }
        }
      }
    },
    SEEDED,
  )
})
