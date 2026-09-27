import { describe, expect, it } from 'vitest'
import type { SigFigTask } from '@/shared/types'
import { gradeSigFigAnswer } from './index'

/**
 * Light calculations from her textbook (CK-12 Introductory Chemistry, chapter 5), run through the
 * significant-figures engine exactly as the light templates set them up. The expected answers are the
 * book's own worked examples or hand calculations, written independently of the light module, so a
 * template that builds its task wrongly shows up here and in that module's cross-check.
 *
 * Constants as the book prints them: c = 3.00 x 10^8 m/s, h = 6.626 x 10^-34 J*s (measured values,
 * so they count toward significant figures). 1 nm = 10^-9 m is exact.
 */

const C = { text: '3.00e8' }
const H = { text: '6.626e-34' }
const NM = { text: '1e-9', exact: true }

const correct = (task: SigFigTask, answer: string) => expect(gradeSigFigAnswer(task, answer).status).toBe('correct')
const wrong = (task: SigFigTask, answer: string) => expect(gradeSigFigAnswer(task, answer).status).toBe('wrong')

describe('frequency from wavelength, nu = c / lambda', () => {
  // CK-12 5.2 worked example: orange light, 620 nm -> 4.8 x 10^14 Hz (620 has two figures).
  const task: SigFigTask = { kind: 'muldiv', terms: [C, { text: '620' }, NM], ops: ['/', '/'] }

  it("matches the book's answer, 4.8 x 10^14 Hz", () => {
    correct(task, '4.8e14')
    correct(task, '4.8 x 10^14')
  })

  it('rejects too many figures and the unconverted nanometres', () => {
    wrong(task, '4.84e14')
    wrong(task, '4.8e5')
  })
})

describe('energy of a photon, E = h nu', () => {
  // CK-12 5.3 worked example: 5.75 x 10^14 Hz -> 3.81 x 10^-19 J.
  const task: SigFigTask = { kind: 'muldiv', terms: [H, { text: '5.75e14' }], ops: ['*'] }

  it("matches the book's answer, 3.81 x 10^-19 J", () => correct(task, '3.81e-19'))
  it('rejects dividing h by the frequency', () => wrong(task, '1.15e-48'))
})

describe('energy from wavelength, E = hc / lambda', () => {
  // 700. nm (three figures): 6.626e-34 * 3.00e8 / 7.00e-7 = 2.8397e-19 -> 2.84 x 10^-19 J.
  const task: SigFigTask = { kind: 'muldiv', terms: [H, C, { text: '700.' }, NM], ops: ['*', '/', '/'] }

  it('gives 2.84 x 10^-19 J', () => correct(task, '2.84e-19'))
})

describe('wavelength from frequency, lambda = c / nu', () => {
  // 4.50 x 10^14 Hz: 3.00e8 / 4.50e14 = 6.667e-7 m -> 6.67 x 10^-7 m, or 667 nm.
  const inMetres: SigFigTask = { kind: 'muldiv', terms: [C, { text: '4.50e14' }], ops: ['/'] }
  const inNm: SigFigTask = { kind: 'muldiv', terms: [C, { text: '4.50e14' }, NM], ops: ['/', '/'] }

  it('gives 6.67 x 10^-7 m', () => correct(inMetres, '6.67e-7'))
  it('gives 667 nm', () => correct(inNm, '667'))
})
