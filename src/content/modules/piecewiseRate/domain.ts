/**
 * pw.domain: domain and range of a piecewise formula, in interval notation.
 * The range is each piece's image on its own interval, then the union.
 */
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import { rat, setToInterval, setsEqual } from '@/notation'
import { buildMore } from './build'
import { domainSlips, gradePwSet, rangeSlips } from './grade'
import {
  SLOPES,
  agreesWithEngine,
  domainOf,
  piece,
  rangeFromX,
  rangeOf,
  showMinus,
  sketchOf,
  storedPiece,
  unrestrictedRange,
  type BuiltPiece,
  type Expr,
} from './model'
import { PW_RULE_IDS } from './rules'

const VERSION = 1
const TRIES = 48

const TRAPS = ['pw_domain_gap', 'pw_domain_closed', 'pw_range_from_x', 'pw_range_unrestricted'] as const

function expr(rng: Rng, linear: boolean): Expr {
  if (linear) return { kind: 'linear', m: rng.pick(SLOPES), b: rat(rng.int(-4, 4)) }
  const roll = rng.int(1, 8)
  if (roll <= 2) return { kind: 'const', c: rat(rng.int(-4, 5)) }
  if (roll === 3) return { kind: 'square' }
  if (roll === 4) return { kind: 'abs' }
  return { kind: 'linear', m: rng.pick(SLOPES), b: rat(rng.int(-3, 3)) }
}

function tryPieces(rng: Rng, needGap: boolean): BuiltPiece[] | null {
  const gap = needGap || rng.chance(0.45)
  const a = rng.int(-6, -2)
  const b = rng.int(a + 1, 1)
  const hole = gap ? rng.int(1, 2) : 0
  const c = b + hole
  const d = rng.int(c + 1, 6)
  if (d > 6) return null
  // Left leaves a open. With a gap, b is included and the next piece starts later.
  // Without a gap, b is open on the left and owned by the right piece. d is always open.
  const left = piece(expr(rng, false), a, b, false, gap)
  const right = piece(expr(rng, true), gap ? c : b, d, true, false)
  const pieces = [left, right]
  if (rng.chance(0.4) && d <= 4) {
    const e = rng.int(d + 1, 5)
    const f = rng.int(e, 6)
    if (f <= 6 && e <= f) pieces.push(piece(expr(rng, false), e, f, true, true))
  }
  if (!agreesWithEngine(pieces)) return null
  const domain = domainOf(pieces)
  const range = rangeOf(pieces)
  const slipsD = domainSlips(pieces)
  const slipsR = rangeSlips(pieces)
  if (needGap && !slipsD.some((s) => s.id === 'pw_domain_gap')) return null
  if (!slipsD.some((s) => s.id === 'pw_domain_closed')) return null
  if (!slipsR.some((s) => s.id === 'pw_range_from_x')) return null
  if (!slipsR.some((s) => s.id === 'pw_range_unrestricted')) return null
  // A nonzero linear on a bounded interval makes the unrestricted image all reals, wider than the true range.
  if (setsEqual(unrestrictedRange(pieces), range)) return null
  const fromX = rangeFromX(pieces)
  if (!fromX || setsEqual(fromX, range)) return null
  if (setsEqual(domain, range)) return null
  return pieces
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  const trap = TRAPS[(seed >>> 0) % TRAPS.length]!
  const drawn = (seed >>> 0) % 2 === 0
  for (let n = 0; n < TRIES; n++) {
    const pieces = tryPieces(rng, trap === 'pw_domain_gap')
    if (!pieces) continue
    const stored = pieces.map(storedPiece)
    const domainText = setToInterval(domainOf(pieces))
    const rangeText = setToInterval(rangeOf(pieces))
    const traps = [...domainSlips(pieces), ...rangeSlips(pieces)]
      .map((s) => ({ id: s.id, text: setToInterval(s.set), witness: '' }))
      .filter((s) => s.text !== domainText && s.text !== rangeText)
    if (!traps.some((t) => t.id === trap)) continue
    const domainGrade = gradePwSet(stored, 'domain', domainText)
    const rangeGrade = gradePwSet(stored, 'range', rangeText)
    if (domainGrade.verdict !== 'correct' || rangeGrade.verdict !== 'correct') continue
    const promised = traps.find((t) => t.id === trap)!
    const kind = trap.startsWith('pw_domain') ? 'domain' : 'range'
    if (gradePwSet(stored, kind, promised.text).verdict !== 'mistake') continue
    const prompt = 'Give the domain and the range of f in interval notation.'
    const reveal = [
      `The domain is ${showMinus(domainText)}.`,
      `The range is ${showMinus(rangeText)}.`,
    ]
    return buildMore({
      templateId: 'pw.domain',
      version: VERSION,
      seed,
      knobs,
      title: 'Domain and range',
      instructions: prompt,
      statementText: 'f is the piecewise function below.',
      answer: {
        question: 'domain',
        prompt,
        pieces: stored,
        domainText,
        rangeText,
        parts: [
          {
            key: 'domain',
            label: 'Domain',
            placeholder: 'interval notation',
            nudge: 'The domain is every x a piece includes. An open end stays out, and so does a hole between pieces.',
            ruleCard: PW_RULE_IDS.domain,
            reveal: [`The domain is ${showMinus(domainText)}.`],
            answerText: domainText,
          },
          {
            key: 'range',
            label: 'Range',
            placeholder: 'interval notation',
            nudge: 'The range is the y-values each piece reaches on its own interval, not the x-values at the edges.',
            ruleCard: PW_RULE_IDS.range,
            reveal: [`The range is ${showMinus(rangeText)}.`],
            answerText: rangeText,
          },
        ],
        traps,
        sketch: drawn ? sketchOf(pieces) : undefined,
        nudge: 'The domain is every x a piece includes. The range is the heights those pieces reach.',
        ruleCard: PW_RULE_IDS.domain,
        ruleCards: [PW_RULE_IDS.domain, PW_RULE_IDS.range],
        reveal,
        trap,
      },
    })
  }
  throw new Error(`pw.domain/${trap}: no function for seed ${seed}`)
}

export const domainTemplate: TemplateDef = {
  id: 'pw.domain',
  title: 'Domain and range of a piecewise function',
  description: 'Two or three pieces. Give the domain and the range in interval notation. Some functions have a gap, and some are also drawn after you finish.',
  version: VERSION,
  knobs: [],
  generate,
}
