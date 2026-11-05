import { mixSeed, mulberry32 } from '@/content/rng'
import type { SatRwAnswer, SatRwOption } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'
import './mistakes'

export type SatRwGrade =
  | {
      verdict: 'invalid'
      message: string
    }
  | {
      verdict: 'correct'
      optionId: 'A' | 'B' | 'C' | 'D'
      message: string
      explanation: string
    }
  | {
      verdict: 'mistake'
      optionId: 'A' | 'B' | 'C' | 'D'
      mistake: ErrorPatternId
      witness: string
      message: string
      explanation: string
    }

const CHOICE_LETTERS: readonly ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D']

export interface RawSatRwCandidate {
  text: string
  correct: boolean
  mistake?: ErrorPatternId
  nudge?: string
}

/**
 * Deterministically shuffles the four candidates (1 right + 3 wrong) using the seed and assigns
 * choice letters 'A', 'B', 'C', 'D'.
 */
export function buildSatRwOptions(
  seed: number,
  salt: number,
  candidates: readonly [RawSatRwCandidate, RawSatRwCandidate, RawSatRwCandidate, RawSatRwCandidate],
): {
  options: SatRwOption[]
  correctId: 'A' | 'B' | 'C' | 'D'
  correctText: string
} {
  const rng = mulberry32(mixSeed(seed, salt))
  const indices = [0, 1, 2, 3]
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = indices[i]!
    indices[i] = indices[j]!
    indices[j] = tmp
  }

  let correctId: 'A' | 'B' | 'C' | 'D' = 'A'
  let correctText = ''
  const options: SatRwOption[] = indices.map((rawIdx, pos) => {
    const raw = candidates[rawIdx]!
    const id = CHOICE_LETTERS[pos]!
    if (raw.correct) {
      correctId = id
      correctText = raw.text
      return {
        id,
        text: raw.text,
      }
    }
    return {
      id,
      text: raw.text,
      mistake: raw.mistake,
      nudge: raw.nudge,
    }
  })

  return { options, correctId, correctText }
}

/**
 * Pure grader for any SAT Reading & Writing single-stage choice item.
 * Accepts either the choice letter ('A' | 'B' | 'C' | 'D', case-insensitive) or the exact option text.
 */
export function gradeSatRwChoice(answer: SatRwAnswer, rawInput: string): SatRwGrade {
  const trimmed = rawInput.trim()
  if (!trimmed) {
    return {
      verdict: 'invalid',
      message: 'Pick one of the four choices first.',
    }
  }

  const upper = trimmed.toUpperCase()
  const matched =
    answer.options.find((opt) => opt.id === upper) ??
    answer.options.find((opt) => opt.text.trim() === trimmed)

  if (!matched) {
    return {
      verdict: 'invalid',
      message: 'Pick one of the four choices (A, B, C, or D).',
    }
  }

  const explanation = answer.reveal.join(' ')

  if (matched.id === answer.correctId) {
    return {
      verdict: 'correct',
      optionId: matched.id,
      message: answer.correctMessage,
      explanation,
    }
  }

  const mistake = (matched.mistake ?? ('rw_comma_splice' as ErrorPatternId))
  const nudge = matched.nudge ?? 'Check how this choice fits the grammar and meaning of the sentence.'

  return {
    verdict: 'mistake',
    optionId: matched.id,
    mistake,
    witness: nudge,
    message: nudge,
    explanation,
  }
}
