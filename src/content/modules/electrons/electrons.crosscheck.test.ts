import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ElectronsLightQuestion, ElectronsOrderQuestion } from '@/content/types'
import { countSigFigs } from '@/engine'
import { gradeLightAnswer, gradeSpectrumOrder } from './grade'

/**
 * Reviewer's cross-check of the light templates, written separately from the module: each answer is
 * recomputed from the physics with the book's constants (c = 3.00 x 10^8 m/s, three figures;
 * h = 6.626 x 10^-34 J*s, four figures; 1 nm = 10^-9 m exact) and compared with what the module
 * calls correct, including the number of significant figures. Colour words in the scene must match
 * the light's actual wavelength, and spectrum orders must match an independent ranking.
 */

const C = 3.0e8
const H = 6.626e-34
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
/** 300 generated problems per check: slow under a full parallel run, like the other seed sweeps. */
const SWEEP = { timeout: 120_000 }

/** '620' | '700.' | '1.55 x 10^-6' | '5.75e14' | '3.00' -> number */
function num(text: string): number {
  const n = Number(text.replace(/\s*(x|×|\*)\s*10\^/, 'e').replace(/\.$/, ''))
  if (!Number.isFinite(n)) throw new Error(`unreadable numeral ${text}`)
  return n
}

/** Visible colours by wavelength in nm; her book calls 620 nm orange. */
function colourAt(nm: number): string | null {
  if (nm < 380 || nm > 750) return null
  if (nm < 450) return 'violet'
  if (nm < 495) return 'blue'
  if (nm < 570) return 'green'
  if (nm < 590) return 'yellow'
  if (nm <= 620) return 'orange'
  return 'red'
}

const COLOURS = ['violet', 'blue', 'green', 'yellow', 'orange', 'red']

function light(templateId: string, seed: number) {
  const inst = generateProblem('electrons', templateId, seed, {})
  if (inst.answer.type !== 'electrons' || inst.answer.question.kind !== 'light') throw new Error(`${templateId}/${seed}: not a light question`)
  return { inst, q: inst.answer.question as ElectronsLightQuestion, context: inst.answer.context }
}

/** The physics answer and the figures it should carry. */
function physics(q: ElectronsLightQuestion): { value: number; figs: number } {
  const lambdaM = q.wavelengthText ? num(q.wavelengthText) * (q.wavelengthInNm ? 1e-9 : 1) : undefined
  const nu = q.frequencyText ? num(q.frequencyText) : undefined
  const given = countSigFigs((q.wavelengthText ?? q.frequencyText)!)
  switch (q.formula) {
    case 'freq':
      return { value: C / lambdaM!, figs: Math.min(given, 3) }
    case 'wavelength':
      return { value: (C / nu!) * (q.answerInNm ? 1e9 : 1), figs: Math.min(given, 3) }
    case 'energy-freq':
      return { value: H * nu!, figs: Math.min(given, 4) }
    case 'energy-wave':
      return { value: (H * C) / lambdaM!, figs: Math.min(given, 3) }
  }
}

/** Is `shown` the value rounded to `figs` significant figures? (float check, generous at 1e-9) */
function roundsTo(value: number, shown: number, figs: number): boolean {
  const place = Math.floor(Math.log10(Math.abs(shown))) - figs + 1
  return Math.abs(value - shown) <= 0.5 * 10 ** place * (1 + 1e-9)
}

describe.each(['light.freq', 'light.wavelength', 'light.energy'])('%s over 300 seeds', (templateId) => {
  it('answers match the physics, with the right number of significant figures', SWEEP, () => {
    for (const seed of SEEDS) {
      const { q } = light(templateId, seed)
      const want = physics(q)
      const shown = num(q.expected)
      const label = `${templateId}/${seed} ${q.formula} given ${q.wavelengthText ?? q.frequencyText}${q.wavelengthInNm ? ' nm' : ''} -> ${q.expected} ${q.unit}`
      expect(countSigFigs(q.expected), label).toBe(want.figs)
      expect(roundsTo(want.value, shown, want.figs), label).toBe(true)
      expect(gradeLightAnswer(q, q.expected).status, label).toBe('correct')
    }
  })

  it('units match the formula', SWEEP, () => {
    for (const seed of SEEDS) {
      const { q } = light(templateId, seed)
      const unit = { freq: 'Hz', wavelength: q.answerInNm ? 'nm' : 'm', 'energy-freq': 'J', 'energy-wave': 'J' }[q.formula]
      expect(q.unit, `${templateId}/${seed}`).toBe(unit)
    }
  })

  it('any colour named in the scene is the colour of that light', SWEEP, () => {
    for (const seed of SEEDS) {
      const { q, context } = light(templateId, seed)
      const named = COLOURS.filter((c) => new RegExp(`\\b${c}\\b`, 'i').test(context))
      if (named.length === 0) continue
      const nm = q.wavelengthText
        ? num(q.wavelengthText) * (q.wavelengthInNm ? 1 : 1e9)
        : (C / num(q.frequencyText!)) * 1e9
      expect(named, `${templateId}/${seed}: "${context}" is ${nm.toFixed(0)} nm`).toEqual([colourAt(nm)])
    }
  })
})

describe('light.spectrum over 300 seeds', () => {
  // Independent ranking, longest wavelength first (lowest frequency and energy first).
  const LONG_FIRST = ['radio', 'microwave', 'infrared', 'visible', 'ultraviolet', 'xray', 'gamma', 'red', 'orange', 'yellow', 'green', 'blue', 'violet']

  it('the expected order matches the physics, and it grades correct while the reverse is named', SWEEP, () => {
    for (const seed of SEEDS) {
      const inst = generateProblem('electrons', 'light.spectrum', seed, {})
      if (inst.answer.type !== 'electrons' || inst.answer.question.kind !== 'order') throw new Error('not an order question')
      const q = inst.answer.question as ElectronsOrderQuestion
      const longFirst = [...q.items].map((i) => i.id).sort((a, b) => LONG_FIRST.indexOf(a) - LONG_FIRST.indexOf(b))
      const wantLongFirst = (q.quantity === 'wavelength') === (q.direction === 'decreasing')
      const want = wantLongFirst ? longFirst : [...longFirst].reverse()
      expect(q.order, `spectrum/${seed} ${q.direction} ${q.quantity}`).toEqual(want)
      expect(gradeSpectrumOrder(q, want).status).toBe('correct')
      expect(gradeSpectrumOrder(q, [...want].reverse()).pattern?.id).toBe('lt_order_reversed')
    }
  })
})
