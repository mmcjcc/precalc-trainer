import { ERROR_PATTERNS } from '@/engine'
import type { ErrorPatternId, ErrorPatternInfo } from '@/shared/types'

export const SATRW_MISTAKE_IDS = [
  'rw_comma_splice',
  'rw_run_on',
  'rw_half_pair',
  'rw_restrictive_commas',
  'rw_subject_verb_comma',
  'rw_nearest_noun',
  'rw_pronoun_number',
  'rw_pronoun_ambiguous',
  'rw_transition_contrast',
  'rw_transition_cause',
  'rw_transition_example',
  'rw_transition_addition',
  'rw_transition_sequence',
] as const

export type SatRwMistakeId = (typeof SATRW_MISTAKE_IDS)[number]

export const SATRW_ERROR_PATTERNS: Record<SatRwMistakeId, ErrorPatternInfo> = {
  rw_comma_splice: {
    id: 'rw_comma_splice' as ErrorPatternId,
    title: 'Comma splice between two complete sentences',
    lesson:
      'A comma by itself cannot join two independent clauses (complete sentences). Join them with a period, a semicolon, or a comma followed by a coordinating conjunction (for, and, nor, but, or, yet, so).',
    example:
      'Wrong: The mirror cooled overnight, the astronomers began observing. → Right: The mirror cooled overnight, so the astronomers began observing.',
  },
  rw_run_on: {
    id: 'rw_run_on' as ErrorPatternId,
    title: 'Run-on sentence with missing boundary punctuation',
    lesson:
      'Two independent clauses cannot run together with no punctuation, or with a coordinating conjunction and no comma before it. Separate the clauses with a period, a semicolon, or a comma plus a coordinating conjunction.',
    example:
      'Wrong: The conservatory restored the organ the acoustics improved. → Right: The conservatory restored the organ; the acoustics improved.',
  },
  rw_half_pair: {
    id: 'rw_half_pair' as ErrorPatternId,
    title: 'Unpaired comma around a nonessential phrase',
    lesson:
      'A nonrestrictive (nonessential) appositive or clause in the middle of a sentence must be set off with a matching pair of commas—one at the start and one at the end. Never open a nonessential phrase with a comma and forget the closing comma (or vice versa).',
    example:
      'Wrong: The botanist used a hand lens, a compact magnifying glass to inspect the spores. → Right: The botanist used a hand lens, a compact magnifying glass, to inspect the spores.',
  },
  rw_restrictive_commas: {
    id: 'rw_restrictive_commas' as ErrorPatternId,
    title: 'Commas around a restrictive identifier',
    lesson:
      'A restrictive appositive or modifier tells which specific person, work, or thing is meant (such as "the astronomer Maria Mitchell" or "the novel Middlemarch"). Because that name is essential to identify the noun, do not set it off with commas.',
    example:
      'Wrong: The astronomer, Maria Mitchell, discovered a comet in 1847. → Right: The astronomer Maria Mitchell discovered a comet in 1847.',
  },
  rw_subject_verb_comma: {
    id: 'rw_subject_verb_comma' as ErrorPatternId,
    title: 'Single comma separating subject from verb',
    lesson:
      'Do not place a single comma directly between a subject and its main verb, even when the subject is long or includes a name.',
    example:
      'Wrong: The astronomer Maria Mitchell, discovered a comet in 1847. → Right: The astronomer Maria Mitchell discovered a comet in 1847.',
  },
  rw_nearest_noun: {
    id: 'rw_nearest_noun' as ErrorPatternId,
    title: 'Verb agrees with nearby noun instead of the true subject',
    lesson:
      'A verb must agree in number (singular or plural) with its true head subject, not with a closer noun inside an interrupting prepositional phrase or relative clause. Mentally cross out the interrupting phrase to check whether the subject is singular or plural.',
    example:
      'Wrong: The catalog of rare botanical illustrations reveal how plants were classified. → Right: The catalog of rare botanical illustrations reveals how plants were classified.',
  },
  rw_pronoun_number: {
    id: 'rw_pronoun_number' as ErrorPatternId,
    title: 'Pronoun does not match its antecedent in number',
    lesson:
      'A pronoun must match its antecedent noun in number: use singular "it" or "its" for a singular thing, institution, or group, and plural "they" or "their" for a plural noun.',
    example:
      'Wrong: When the conservatory renovated the hall, their panels were replaced. → Right: When the conservatory renovated the hall, its panels were replaced.',
  },
  rw_pronoun_ambiguous: {
    id: 'rw_pronoun_ambiguous' as ErrorPatternId,
    title: 'Ambiguous or non-possessive pronoun reference',
    lesson:
      'When two nouns of the same number could both be the antecedent, a bare pronoun like "it" or "that" leaves the meaning ambiguous—repeat the specific noun instead. Also watch for contractions ("it\'s" = it is, "they\'re" = they are) where a possessive pronoun ("its", "their") is required.',
    example:
      'Wrong: When the curator compared the portrait with the sketch, it showed grid lines. → Right: When the curator compared the portrait with the sketch, the portrait showed grid lines.',
  },
  rw_transition_contrast: {
    id: 'rw_transition_contrast' as ErrorPatternId,
    title: 'Contrast transition used where ideas do not contrast',
    lesson:
      'Transitions like "However,", "Nevertheless,", and "By contrast," signal an opposing or surprising point. Do not use a contrast transition when the second sentence gives a result, an example, an added point, or the next step in a sequence.',
    example:
      'Wrong: Kelp forests shelter young fish. However, they buffer shorelines from storm waves. → Right: Kelp forests shelter young fish. Moreover, they buffer shorelines from storm waves.',
  },
  rw_transition_cause: {
    id: 'rw_transition_cause' as ErrorPatternId,
    title: 'Cause-and-effect transition used without a cause-and-effect link',
    lesson:
      'Transitions like "Therefore,", "Consequently,", and "As a result," introduce a direct consequence of the previous sentence. Do not use them when the second sentence contrasts with, illustrates, or merely adds to the first sentence.',
    example:
      'Wrong: Early maps depicted the plateau as arid. Therefore, later surveys found springs. → Right: Early maps depicted the plateau as arid. However, later surveys found springs.',
  },
  rw_transition_example: {
    id: 'rw_transition_example' as ErrorPatternId,
    title: 'Example transition used where the second sentence is not an example',
    lesson:
      'Transitions like "For example,", "For instance,", and "Specifically," introduce a concrete case that illustrates a broader claim in the first sentence. Do not use them for a contrasting claim, a result, or a chronological next step.',
    example:
      'Wrong: The potter wedged the clay. For example, she centered it on the wheel. → Right: The potter wedged the clay. Next, she centered it on the wheel.',
  },
  rw_transition_addition: {
    id: 'rw_transition_addition' as ErrorPatternId,
    title: 'Addition transition used where ideas do not simply add',
    lesson:
      'Transitions like "Furthermore,", "Moreover,", and "In addition," add a second parallel point supporting the same direction of thought. Do not use them when the second sentence contradicts the first, states its result, or gives a specific example of it.',
    example:
      'Wrong: The bridge timbers had rotted. Moreover, engineers closed the span for repairs. → Right: The bridge timbers had rotted. Consequently, engineers closed the span for repairs.',
  },
  rw_transition_sequence: {
    id: 'rw_transition_sequence' as ErrorPatternId,
    title: 'Sequence transition used where sentences are not steps in time',
    lesson:
      'Transitions like "Subsequently,", "Next,", and "Afterward," mark the next chronological event in a timeline or procedure. Do not use a sequence transition when the second sentence gives a contrast, a logical example, or a parallel reason.',
    example:
      'Wrong: Many alpine plants conserve heat. Subsequently, cushion plants grow in low mats. → Right: Many alpine plants conserve heat. For instance, cushion plants grow in low mats.',
  },
}

/**
 * Registers the SAT Reading & Writing error patterns into the shared ERROR_PATTERNS catalog idempotently.
 */
export function registerSatRwMistakes(): void {
  const catalog = ERROR_PATTERNS as Record<string, ErrorPatternInfo>
  for (const id of SATRW_MISTAKE_IDS) {
    if (!(id in catalog)) {
      catalog[id] = SATRW_ERROR_PATTERNS[id]
    }
  }
}

registerSatRwMistakes()
