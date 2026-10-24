/**
 * Chapter 5 templates. Every number, orbital, and choice comes from makeRng(mixSeed(seed, salt)).
 * A promised trap is one this problem's grader names.
 */
import { problemId } from '@/content/registry'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { DifficultyKnobs, OrbitalId, ProblemInstance, QnCheck, QnStageId, QuantumAnswer, TemplateDef } from '@/content/types'
import { assertQuantum, canonicalAnswer, classify, trapsFor, WITNESS } from './grade'
import {
  JOB,
  ORBITAL_IDS,
  TELLS,
  VALUES_MS,
  VALUES_MS_BAD,
  VALUES_N,
  VALUES_N_ZERO,
  answerLeaks,
  breaks,
  formatInt,
  formatList,
  formatMs,
  formatPair,
  formatSet,
  letterOf,
  orbitalAlt,
  orbitalPretty,
  partnerOf,
  sublevelName,
  type QNums,
} from './facts'
import { QN_RULE_IDS } from './rules'

const MODULE_ID = 'quantumNumbers' as const
const NO_CALC = { ti84: [], nspire: [] }
const STAGE_IDS: readonly QnStageId[] = ['a', 'b', 'c', 'd']
const INSTRUCTIONS = 'Answer each part. A list may be in any order.'

interface Row<T> {
  w: number
  item: T
}

function range(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let v = lo; v <= hi; v++) out.push(v)
  return out
}

function pickW<T>(rng: Rng, rows: readonly Row<T>[]): T {
  const total = rows.reduce((sum, row) => sum + row.w, 0)
  let roll = rng.int(1, total)
  for (const row of rows) {
    roll -= row.w
    if (roll <= 0) return row.item
  }
  return rows[rows.length - 1]!.item
}

function sublevelPhrase(l: number): string {
  const letter = letterOf(l)
  if (!letter) throw new Error(`no letter for l = ${l}`)
  const article = letter === 's' || letter === 'f' ? 'an' : 'a'
  return `${article} ${letter} sublevel`
}

/** Shell 1 is "the first shell" so a count of 1 is not sitting in the prompt. */
function shellPhrase(n: number): string {
  if (n === 1) return 'the first shell'
  return `shell ${n}`
}

type Stage = QuantumAnswer['stages'][number]

function choicePart(rng: Rng, spec: { label: string; nudge: string; ruleCard: string; check: QnCheck; options: string[] }): Stage {
  const options = [...new Set(spec.options)]
  if (options.length !== spec.options.length || options.length < 2) throw new Error(`choices collided: ${spec.options.join(' | ')}`)
  const answerText = canonicalAnswer(spec.check)
  if (!options.some((option) => option === answerText)) throw new Error(`missing answer "${answerText}" in ${options.join(' | ')}`)
  const choices = rng.shuffle(options).map((text) => {
    const graded = classify(spec.check, text)
    if (graded.verdict === 'invalid') throw new Error(`unreadable choice "${text}"`)
    if (graded.verdict === 'mistake') return { id: text, text, trap: graded.mistake, witness: WITNESS[graded.mistake] }
    return { id: text, text }
  })
  const traps = choices.flatMap((choice) => (choice.trap ? [{ id: choice.trap, text: choice.text, witness: choice.witness }] : []))
  return {
    id: 'a',
    kind: 'choice',
    label: spec.label,
    hint: 'Choose one.',
    answerText,
    choices,
    nudge: spec.nudge,
    ruleCard: spec.ruleCard,
    reveal: [`The answer is ${answerText}.`],
    traps,
    check: spec.check,
  }
}

function textPart(spec: { label: string; hint: string; nudge: string; ruleCard: string; check: QnCheck }): Stage {
  const answerText = canonicalAnswer(spec.check)
  return {
    id: 'a',
    kind: 'text',
    label: spec.label,
    hint: spec.hint,
    answerText,
    nudge: spec.nudge,
    ruleCard: spec.ruleCard,
    reveal: [`The answer is ${answerText}.`],
    traps: trapsFor(spec.check),
    check: spec.check,
  }
}

function pack(
  rng: Rng,
  question: QuantumAnswer['question'],
  prompt: string,
  stages: Stage[],
  figure?: QuantumAnswer['figure'],
): QuantumAnswer {
  const numbered = stages.map((stage, index) => ({ ...stage, id: STAGE_IDS[index] ?? 'a' }))
  const pool = numbered.flatMap((stage) => stage.traps.map((trap) => ({ stage, trap })))
  const picked = pool.length > 0 ? rng.pick(pool) : null
  const answer: QuantumAnswer = {
    type: 'quantum',
    question,
    prompt,
    ...(figure ? { figure } : {}),
    stages: numbered,
    expectedDisplay: numbered.map((stage) => `${stage.label}: ${stage.answerText}`).join('; '),
    reveal: numbered.map((stage) => stage.reveal[0]!),
    ruleCards: [...new Set(numbered.map((stage) => stage.ruleCard))],
    ...(picked ? { trap: picked.trap.id, trapStage: picked.stage.id, trapAnswer: picked.trap.text } : {}),
  }
  assertQuantum(answer)
  return answer
}

function instance(spec: { id: string; title: string }, seed: number, knobs: DifficultyKnobs, answer: QuantumAnswer): ProblemInstance {
  return {
    id: problemId(MODULE_ID, spec.id, 1, seed),
    moduleId: MODULE_ID,
    templateId: spec.id,
    skill: spec.id,
    genVersion: 1,
    seed,
    knobs,
    kind: 'quantumNumbers',
    title: spec.title,
    instructions: INSTRUCTIONS,
    statementText: answer.prompt,
    vars: [],
    start: null,
    canonical: [],
    answer,
    graph: { kind: 'none' },
    calc: NO_CALC,
    params: { parts: answer.stages.length },
  }
}

function template(spec: { id: string; title: string; description: string; salt: number }, build: (rng: Rng) => QuantumAnswer): TemplateDef {
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    version: 1,
    knobs: [],
    generate: (seed, knobs) => instance(spec, seed, knobs, build(makeRng(mixSeed(seed, spec.salt)))),
  }
}

const WHICH = ['n', 'l', 'ml', 'ms'] as const

function meaningRows(): Row<{ prompt: string; check: QnCheck; options: string[] }>[] {
  const rows: Row<{ prompt: string; check: QnCheck; options: string[] }>[] = []
  for (const which of WHICH) {
    const heavy = which === 'ml' ? 8 : 4
    rows.push({
      w: heavy,
      item: { prompt: `What does ${JOB[which]} tell you?`, check: { kind: 'tells', which }, options: WHICH.map((id) => TELLS[id]) },
    })
    rows.push({
      w: heavy,
      item: { prompt: `Which symbol is used for ${JOB[which]}?`, check: { kind: 'symbol', which }, options: ['n', 'l', 'ml', 'ms'] },
    })
    rows.push({
      w: heavy,
      item: { prompt: `Which quantum number tells you ${TELLS[which]}?`, check: { kind: 'which-job', which }, options: WHICH.map((id) => JOB[id]) },
    })
  }
  rows.push({
    w: 8,
    item: {
      prompt: 'Which values can the principal quantum number take?',
      check: { kind: 'values-n' },
      options: [VALUES_N, VALUES_N_ZERO, VALUES_MS, 'any whole number'],
    },
  })
  rows.push({
    w: 8,
    item: {
      prompt: 'Which values can the spin quantum number take?',
      check: { kind: 'values-ms' },
      options: [VALUES_MS, VALUES_MS_BAD, VALUES_N, 'any whole number'],
    },
  })
  for (const n of [2, 3, 4, 5, 6]) {
    const options = [formatList(range(0, n - 1)), formatList(range(0, n)), formatList(range(1, Math.max(1, n - 1))), formatList([-1, 0, 1])]
    const check: QnCheck = { kind: 'values-l', n }
    rows.push({ w: 2, item: { prompt: `Which values can the angular momentum quantum number take when the principal quantum number is ${n}?`, check, options } })
    rows.push({ w: 2, item: { prompt: `The principal quantum number is ${n}. Which values can the angular momentum quantum number take?`, check, options } })
  }
  for (const l of [1, 2, 3]) {
    const options = [formatList(range(-l, l)), formatList(range(-l, l).filter((m) => m !== 0)), formatList(range(0, l)), String(l)]
    const check: QnCheck = { kind: 'values-ml', l }
    rows.push({ w: 2, item: { prompt: `Which values can the magnetic quantum number take when the angular momentum quantum number is ${l}?`, check, options } })
    rows.push({ w: 2, item: { prompt: `The angular momentum quantum number is ${l}. Which values can the magnetic quantum number take?`, check, options } })
  }
  return rows
}

function meaning(rng: Rng): QuantumAnswer {
  const row = pickW(rng, meaningRows())
  const stage = choicePart(rng, {
    label: 'Answer',
    nudge: 'Each quantum number has its own job, its own symbol, and its own allowed values.',
    ruleCard: QN_RULE_IDS.four,
    check: row.check,
    options: row.options,
  })
  return pack(rng, 'meaning', row.prompt, [stage])
}

interface BuiltSet {
  q: QNums
  broken: boolean
}

function allowedSet(rng: Rng): BuiltSet {
  // 45 is the top of the 30–45 band, so each break reason stays under 15% of seeds.
  if (rng.int(1, 100) <= 45) {
    const n = rng.int(1, 5)
    const l = rng.int(0, n - 1)
    const ml = rng.int(-l, l)
    const ms2 = rng.pick([1, -1] as const)
    return { q: { n, l, ml, ms2 }, broken: false }
  }
  // An even four-way split of this draw puts one reason on more than 15% of problems.
  // The slots follow the draw so each reason stays under that cap.
  const kind = rng.pick([
    'n', 'n', 'n', 'n', 'n',
    'l', 'l', 'l',
    'ml', 'ml',
    'l',
    'ml',
    'ms', 'ms', 'ms',
    'ml',
    'l',
    'ms', 'ms', 'ms',
  ] as const)
  if (kind === 'n') return { q: { n: 0, l: 0, ml: 0, ms2: rng.pick([1, -1] as const) }, broken: true }
  if (kind === 'l') {
    const n = rng.int(1, 4)
    return { q: { n, l: n, ml: 0, ms2: rng.pick([1, -1] as const) }, broken: true }
  }
  if (kind === 'ml') {
    const n = rng.int(1, 5)
    const l = rng.int(0, n - 1)
    const ml = rng.pick([l + 1, -(l + 1)])
    return { q: { n, l, ml, ms2: rng.pick([1, -1] as const) }, broken: true }
  }
  const n = rng.int(1, 5)
  const l = rng.int(0, n - 1)
  const ml = rng.int(-l, l)
  return { q: { n, l, ml, ms2: rng.pick([0, 2, -2] as const) }, broken: true }
}

function allowed(rng: Rng): QuantumAnswer {
  const built = allowedSet(rng)
  const q = built.q
  let prompt = `Can an electron have the quantum numbers n = ${q.n}, l = ${q.l}, ml = ${formatInt(q.ml)}, and ms = ${formatMs(q.ms2)}?`
  const decision = choicePart(rng, {
    label: 'Decision',
    nudge: 'Check the shell, then the sublevel, then the orientation, then the spin.',
    ruleCard: QN_RULE_IDS.four,
    check: { kind: 'allowed', n: q.n, l: q.l, ml: q.ml, ms2: q.ms2 },
    options: ['Allowed', 'Not allowed'],
  })
  const stages = [decision]
  if (built.broken && breaks(q.n, q.l, q.ml, q.ms2)) {
    prompt = `${prompt} Which quantum number is outside its range?`
    stages.push(
      choicePart(rng, {
        label: 'Which quantum number',
        nudge: 'Only one of the four numbers is outside its range.',
        ruleCard: QN_RULE_IDS.four,
        check: { kind: 'breaks', n: q.n, l: q.l, ml: q.ml, ms2: q.ms2 },
        options: WHICH.map((id) => JOB[id]),
      }),
    )
  }
  return pack(rng, 'allowed', prompt, stages)
}

const WHOLE = 'A whole number.'
const LIST = 'A list of whole numbers, in any order.'
const COUNT_NUDGE = 'Count what the question names: orbitals or electrons.'
const ML_NUDGE = 'Include every orientation, the negative ones and zero.'

interface CountQ {
  prompt: string
  check: QnCheck
  hint: string
  nudge: string
  label: string
}

function countRows(): Row<CountQ>[] {
  const rows: Row<CountQ>[] = []
  const add = (w: number, item: CountQ) => rows.push({ w, item })
  for (const l of [0, 1, 2, 3]) {
    add(2, {
      prompt: `How many orbitals are in ${sublevelPhrase(l)}?`,
      check: { kind: 'sub-orbitals', l },
      hint: WHOLE,
      nudge: COUNT_NUDGE,
      label: 'Orbitals',
    })
    add(2, {
      prompt: `How many orbitals does a sublevel have when the angular momentum quantum number is ${l}?`,
      check: { kind: 'sub-orbitals', l },
      hint: WHOLE,
      nudge: COUNT_NUDGE,
      label: 'Orbitals',
    })
    add(2, {
      prompt: `How many electrons can ${sublevelPhrase(l)} hold?`,
      check: { kind: 'sub-electrons', l },
      hint: WHOLE,
      nudge: COUNT_NUDGE,
      label: 'Electrons',
    })
    add(2, {
      prompt: `How many electrons can a sublevel hold when the angular momentum quantum number is ${l}?`,
      check: { kind: 'sub-electrons', l },
      hint: WHOLE,
      nudge: COUNT_NUDGE,
      label: 'Electrons',
    })
  }
  add(2, { prompt: 'What is the most electrons one orbital can hold?', check: { kind: 'orbital-electrons' }, hint: WHOLE, nudge: COUNT_NUDGE, label: 'Electrons' })
  add(2, { prompt: 'How many electrons can share one orbital?', check: { kind: 'orbital-electrons' }, hint: WHOLE, nudge: COUNT_NUDGE, label: 'Electrons' })
  for (const n of [1, 2, 3, 4, 5, 6]) {
    add(2, {
      prompt: `How many orbitals are in ${shellPhrase(n)}?`,
      check: { kind: 'shell-orbitals', n },
      hint: WHOLE,
      nudge: 'A shell\'s orbitals and its electrons are different counts.',
      label: 'Orbitals',
    })
    add(2, {
      prompt: `How many orbitals does ${shellPhrase(n)} hold?`,
      check: { kind: 'shell-orbitals', n },
      hint: WHOLE,
      nudge: 'A shell\'s orbitals and its electrons are different counts.',
      label: 'Orbitals',
    })
  }
  for (const n of [2, 3, 4, 5, 6]) {
    add(2, {
      prompt: `How many electrons can ${shellPhrase(n)} hold?`,
      check: { kind: 'shell-electrons', n },
      hint: WHOLE,
      nudge: 'A shell\'s orbitals and its electrons are different counts.',
      label: 'Electrons',
    })
    add(2, {
      prompt: `How many electrons are in ${shellPhrase(n)}?`,
      check: { kind: 'shell-electrons', n },
      hint: WHOLE,
      nudge: 'A shell\'s orbitals and its electrons are different counts.',
      label: 'Electrons',
    })
  }
  for (const l of [1, 2, 3]) {
    add(2, {
      prompt: `List the values of the magnetic quantum number when the angular momentum quantum number is ${l}.`,
      check: { kind: 'ml-list', l },
      hint: LIST,
      nudge: ML_NUDGE,
      label: 'Values',
    })
    for (let n = l + 1; n <= 5; n++) {
      const name = sublevelName(n, l)
      if (!name) continue
      add(1, {
        prompt: `List every magnetic quantum number for the ${name} sublevel.`,
        check: { kind: 'ml-list', l, n },
        hint: LIST,
        nudge: ML_NUDGE,
        label: 'Values',
      })
    }
  }
  for (const n of [1, 2, 3, 4]) {
    add(2, {
      prompt: `Which sublevels are in shell ${n}?`,
      check: { kind: 'sublevels', n },
      hint: 'List the sublevels, separated by commas.',
      nudge: 'A shell has one sublevel for each allowed angular momentum quantum number.',
      label: 'Sublevels',
    })
    add(2, {
      prompt: `List the sublevels of shell ${n}.`,
      check: { kind: 'sublevels', n },
      hint: 'List the sublevels, separated by commas.',
      nudge: 'A shell has one sublevel for each allowed angular momentum quantum number.',
      label: 'Sublevels',
    })
  }
  for (const l of [1, 2, 3]) {
    for (let n = l + 1; n <= 5; n++) {
      add(1, {
        prompt: `How many electrons in an atom can have n = ${n} and l = ${l}?`,
        check: { kind: 'nl-electrons', n, l },
        hint: WHOLE,
        nudge: COUNT_NUDGE,
        label: 'Electrons',
      })
    }
  }
  const nlm: { n: number; l: number; ml: number }[] = [
    { n: 3, l: 0, ml: 0 },
    { n: 4, l: 0, ml: 0 },
    { n: 4, l: 3, ml: -3 },
    { n: 5, l: 0, ml: 0 },
    { n: 5, l: 3, ml: 3 },
  ]
  for (const item of nlm) {
    if (answerLeaks(`${item.n} ${item.l} ${formatInt(item.ml)}`, '2')) continue
    add(1, {
      prompt: `How many electrons in an atom can have n = ${item.n}, l = ${item.l}, and ml = ${formatInt(item.ml)}?`,
      check: { kind: 'nlm-electrons', n: item.n, l: item.l, ml: item.ml },
      hint: WHOLE,
      nudge: COUNT_NUDGE,
      label: 'Electrons',
    })
  }
  return rows
}

function count(rng: Rng): QuantumAnswer {
  const row = pickW(rng, countRows())
  const stage = textPart({ ...row, ruleCard: QN_RULE_IDS.count })
  return pack(rng, 'count', row.prompt, [stage])
}

const REALS = ['1s', '2s', '2p', '3s', '3p', '3d', '4s', '4p', '4d', '4f', '5s', '5p', '5d']

function realNames(except: string): string[] {
  return REALS.filter((name) => name !== except)
}

function nameForward(rng: Rng, n: number, l: number): Stage {
  const right = sublevelName(n, l)
  if (!right) throw new Error(`missing name ${n} ${l}`)
  const bad = `${n}${letterOf(n) ?? 'x'}`
  const other = rng.pick(realNames(right).filter((name) => name !== bad))
  return choicePart(rng, {
    label: 'Sublevel',
    nudge: 'The letter comes from the angular momentum quantum number, and that number has to stay smaller than the shell.',
    ruleCard: QN_RULE_IDS.shapes,
    check: { kind: 'name', n, l },
    options: [right, 'Does not exist', bad, other],
  })
}

function nameImpossible(rng: Rng, n: number): Stage {
  const bad = `${n}${letterOf(n) ?? 'x'}`
  const fillers = rng.shuffle(realNames(bad)).slice(0, 2)
  return choicePart(rng, {
    label: 'Sublevel',
    nudge: 'The letter comes from the angular momentum quantum number, and that number has to stay smaller than the shell.',
    ruleCard: QN_RULE_IDS.shapes,
    check: { kind: 'name', n, l: n },
    options: ['Does not exist', bad, fillers[0]!, fillers[1]!],
  })
}

function name(rng: Rng): QuantumAnswer {
  const kind = pickW(rng, [
    { w: 30, item: 'forward' as const },
    { w: 8, item: 'impossible' as const },
    { w: 16, item: 'read-n' as const },
    { w: 16, item: 'read-l' as const },
    { w: 16, item: 'read-ml' as const },
  ])
  if (kind === 'impossible') {
    const n = rng.int(1, 5)
    const prompt = `An electron has the principal quantum number ${n} and the angular momentum quantum number ${n}. What is the sublevel called?`
    return pack(rng, 'name', prompt, [nameImpossible(rng, n)])
  }
  const n = rng.int(1, 5)
  const lMax = kind === 'read-ml' ? Math.min(3, n - 1) : n - 1
  if (lMax < 0 || (kind === 'read-ml' && lMax < 1)) {
    const prompt = `An electron has the principal quantum number ${n} and the angular momentum quantum number 0. What is the sublevel called?`
    return pack(rng, 'name', prompt, [nameForward(rng, n, 0)])
  }
  const l = kind === 'read-ml' ? rng.int(1, lMax) : rng.int(0, lMax)
  const called = sublevelName(n, l)!
  if (kind === 'forward') {
    const prompt = `An electron has the principal quantum number ${n} and the angular momentum quantum number ${l}. What is the sublevel called?`
    return pack(rng, 'name', prompt, [nameForward(rng, n, l)])
  }
  if (kind === 'read-n') {
    const prompt = `The sublevel is ${called}. What is the principal quantum number?`
    return pack(rng, 'name', prompt, [
      textPart({
        label: 'Principal quantum number',
        hint: WHOLE,
        nudge: 'The shell number is written first in the sublevel\'s name.',
        ruleCard: QN_RULE_IDS.shapes,
        check: { kind: 'read-n', n, l },
      }),
    ])
  }
  if (kind === 'read-l') {
    const prompt = `The sublevel is ${called}. What is the angular momentum quantum number?`
    return pack(rng, 'name', prompt, [
      textPart({
        label: 'Angular momentum quantum number',
        hint: WHOLE,
        nudge: 'The letter names the angular momentum quantum number.',
        ruleCard: QN_RULE_IDS.shapes,
        check: { kind: 'read-l', n, l },
      }),
    ])
  }
  const prompt = `The sublevel is ${called}. List every value of the magnetic quantum number.`
  return pack(rng, 'name', prompt, [
    textPart({
      label: 'Magnetic quantum numbers',
      hint: LIST,
      nudge: ML_NUDGE,
      ruleCard: QN_RULE_IDS.shapes,
      check: { kind: 'read-ml', n, l },
    }),
  ])
}

const SHAPE_NUDGE = 'Match the lobes, or the sphere, to the orbital they belong to.'

function shapeChoices(right: OrbitalId): string[] {
  const name = (id: OrbitalId) => orbitalPretty(id)
  if (right === 'px' || right === 'py' || right === 'pz') {
    const others = (['px', 'py', 'pz'] as const).filter((id) => id !== right)
    return [name(right), name(others[0]!), name(others[1]!), name('dxy')]
  }
  if (right === 'dxy' || right === 'dx2y2') {
    const other = right === 'dxy' ? 'dx2y2' : 'dxy'
    return [name(right), name(other), name('dz2'), name('px')]
  }
  if (right === 'dxz') return [name(right), name('dyz'), name('dxy'), name('pz')]
  if (right === 'dyz') return [name(right), name('dxz'), name('dxy'), name('py')]
  if (right === 'dz2') return [name(right), name('dxy'), name('pz'), name('s')]
  return [name('s'), name('px'), name('dxy'), name('dz2')]
}

function shapes(rng: Rng): QuantumAnswer {
  if (rng.int(1, 100) <= 50) {
    const orbital = rng.pick(ORBITAL_IDS)
    const prompt = rng.pick([
      'Which orbital is drawn?',
      'What is the name of the orbital in the picture?',
      'Name the orbital shown.',
      'Which orbital does the picture show?',
    ])
    const stage = choicePart(rng, {
      label: 'Orbital',
      nudge: SHAPE_NUDGE,
      ruleCard: QN_RULE_IDS.magnetic,
      check: { kind: 'shape', orbital },
      options: shapeChoices(orbital),
    })
    return pack(rng, 'shapes', prompt, [stage], { orbital, ariaLabel: orbitalAlt(orbital) })
  }
  const ask = rng.pick([
    'd-along-xy',
    'd-between-xy',
    'd-between-xz',
    'd-between-yz',
    'd-ring',
    'p-x',
    'p-y',
    'p-z',
    'sphere',
    's-orientations',
  ] as const)
  if (ask === 's-orientations') {
    const prompt = 'How many orientations does an s orbital have?'
    const stage = choicePart(rng, {
      label: 'Orientations',
      nudge: SHAPE_NUDGE,
      ruleCard: QN_RULE_IDS.magnetic,
      check: { kind: 'shape-words', ask },
      options: ['1', '3', '5', '7'],
    })
    return pack(rng, 'shapes', prompt, [stage])
  }
  const words: Record<Exclude<typeof ask, 's-orientations'>, string> = {
    'd-along-xy': 'Which d orbital has its lobes along the x and y axes?',
    'd-between-xy': 'Which d orbital has its lobes between the x and y axes?',
    'd-between-xz': 'Which d orbital has its lobes between the x and z axes?',
    'd-between-yz': 'Which d orbital has its lobes between the y and z axes?',
    'd-ring': 'Which d orbital has two lobes along the z axis and a ring in the xy plane?',
    'p-x': 'Which p orbital lies along the x axis?',
    'p-y': 'Which p orbital lies along the y axis?',
    'p-z': 'Which p orbital lies along the z axis?',
    sphere: 'Which orbital is a sphere?',
  }
  const right = (
    {
      'd-along-xy': 'dx2y2',
      'd-between-xy': 'dxy',
      'd-between-xz': 'dxz',
      'd-between-yz': 'dyz',
      'd-ring': 'dz2',
      'p-x': 'px',
      'p-y': 'py',
      'p-z': 'pz',
      sphere: 's',
    } as const
  )[ask]
  const stage = choicePart(rng, {
    label: 'Orbital',
    nudge: SHAPE_NUDGE,
    ruleCard: QN_RULE_IDS.magnetic,
    check: { kind: 'shape-words', ask },
    options: shapeChoices(right),
  })
  return pack(rng, 'shapes', words[ask], [stage])
}

function sets(): QNums[] {
  const out: QNums[] = []
  for (let n = 1; n <= 4; n++) {
    for (let l = 0; l <= n - 1; l++) {
      for (let ml = -l; ml <= l; ml++) {
        out.push({ n, l, ml, ms2: 1 })
        out.push({ n, l, ml, ms2: -1 })
      }
    }
  }
  return out
}

const PAULI_SETS = sets()

function partnerOptions(q: QNums): string[] {
  return [
    formatSet(partnerOf(q)),
    formatSet(q),
    formatSet({ ...q, ml: q.ml + 1 }),
    formatSet({ ...q, n: q.n + 1, ml: 0 }),
  ]
}

function pairOptions(q: QNums): string[] {
  const partner = partnerOf(q)
  return [
    formatPair(q, partner),
    formatPair(q, q),
    formatPair(q, { ...q, ml: q.ml + 1 }),
    formatPair({ ...q, n: q.n + 1, ml: 0 }, partner),
  ]
}

function noDigitOne(n: number): boolean {
  return !answerLeaks(String(n), '1') && !answerLeaks(formatInt(n), '1')
}

function safeCountSets(): { n: number; l: number; ml: number }[] {
  const out: { n: number; l: number; ml: number }[] = []
  for (let n = 2; n <= 5; n++) {
    for (let l = 0; l < n && l <= 3; l++) {
      for (let ml = -l; ml <= l; ml++) {
        if (noDigitOne(n) && noDigitOne(l) && noDigitOne(ml)) out.push({ n, l, ml })
      }
    }
  }
  return out
}

const SAFE_COUNTS = safeCountSets()

function pauli(rng: Rng): QuantumAnswer {
  const roll = rng.int(1, 100)
  if (roll <= 44) {
    const q = rng.pick(PAULI_SETS)
    const prompt = `One electron in an orbital has n = ${q.n}, l = ${q.l}, ml = ${formatInt(q.ml)}, and ms = ${formatMs(q.ms2)}. Which set describes the other electron in that same orbital?`
    const stage = choicePart(rng, {
      label: 'Other electron',
      nudge: 'One orbital\'s two electrons differ in spin only.',
      ruleCard: QN_RULE_IDS.spin,
      check: { kind: 'partner', n: q.n, l: q.l, ml: q.ml, ms2: q.ms2 as 1 | -1 },
      options: partnerOptions(q),
    })
    return pack(rng, 'pauli', prompt, [stage])
  }
  if (roll <= 88) {
    const q = rng.pick(PAULI_SETS)
    const prompt = 'Which pair of sets breaks the Pauli exclusion principle?'
    const stage = choicePart(rng, {
      label: 'Pair',
      nudge: 'Compare the four numbers in each set.',
      ruleCard: QN_RULE_IDS.spin,
      check: { kind: 'pair', n: q.n, l: q.l, ml: q.ml, ms2: q.ms2 as 1 | -1 },
      options: pairOptions(q),
    })
    return pack(rng, 'pauli', prompt, [stage])
  }
  const item = rng.pick(SAFE_COUNTS)
  const ms2 = rng.pick([1, -1] as const)
  const spin = ms2 === 1 ? 'positive one half' : 'negative one half'
  const prompt = `How many electrons in one atom can have n = ${item.n}, l = ${item.l}, ml = ${formatInt(item.ml)}, and a spin of ${spin}?`
  const stage = choicePart(rng, {
    label: 'Electrons',
    nudge: 'One exact set of four quantum numbers belongs to one electron.',
    ruleCard: QN_RULE_IDS.spin,
    check: { kind: 'set-count', n: item.n, l: item.l, ml: item.ml, ms2 },
    options: ['1', '2', '0', '6'],
  })
  return pack(rng, 'pauli', prompt, [stage])
}

export const meaningTemplate = template(
  { id: 'qn.meaning', title: 'What a quantum number tells', description: 'The job, the symbol, and the allowed values of n, l, ml, and ms.', salt: 11 },
  meaning,
)
export const allowedTemplate = template(
  { id: 'qn.allowed', title: 'Allowed sets', description: 'Whether a set of four quantum numbers can belong to an electron, and which number breaks the rule.', salt: 12 },
  allowed,
)
export const countTemplate = template(
  { id: 'qn.count', title: 'Counting orbitals and electrons', description: 'Orbitals and electrons in a sublevel or a shell, and the magnetic quantum numbers.', salt: 13 },
  count,
)
export const nameTemplate = template(
  { id: 'qn.name', title: 'Naming a sublevel', description: 'From n and l to the sublevel name, and back, including sublevels that cannot exist.', salt: 14 },
  name,
)
export const shapesTemplate = template(
  { id: 'qn.shapes', title: 'Orbital shapes', description: 'Name the orbital in the figure, or match a description to s, p, and d orbitals.', salt: 15 },
  shapes,
)
export const pauliTemplate = template(
  { id: 'qn.pauli', title: 'Pauli exclusion principle', description: 'The other electron in an orbital, a pair that breaks the principle, and how many electrons share one set.', salt: 16 },
  pauli,
)

export const QN_TEMPLATES = [meaningTemplate, allowedTemplate, countTemplate, nameTemplate, shapesTemplate, pauliTemplate]
