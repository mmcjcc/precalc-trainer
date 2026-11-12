/**
 * Problems worked by hand (the working is in each comment), built with the templates' own builders and graded the way
 * the screen grades them: the answers she would type, the slips each names, the notes that log nothing.
 */
import { describe, expect, it } from 'vitest'
import type { TrigPart } from '@/content/types'
import { ambiguousProblem } from './ambiguous'
import { heronProblem, sasAreaProblem } from './area'
import { chooseProblem } from './choose'
import type { Drafted } from './common'
import { sasProblem, sssProblem } from './cosines'
import { EARLY_NOTE, gradeObliquePart } from './grade'
import { sinesProblem } from './sines'

function part(d: Drafted, id: string): TrigPart {
  const p = d.stages.find((s) => s.id === id)
  if (!p) throw new Error(`no part ${id}`)
  return p
}

function grade(d: Drafted, id: string, text: string) {
  return gradeObliquePart(part(d, id), d.early[id] ?? [], text)
}

const right = (d: Drafted, id: string, text: string) => expect(grade(d, id, text).verdict, `${id} ${text}`).toBe('correct')
const named = (d: Drafted, id: string, text: string, mistake: string) => {
  const g = grade(d, id, text)
  expect(g.verdict === 'mistake' ? g.mistake : g.verdict, `${id} ${text}`).toBe(mistake)
}
const note = (d: Drafted, id: string, text: string) => expect(grade(d, id, text).verdict, `${id} ${text}`).toBe('invalid')

describe('the law of sines', () => {
  // A = 40°, B = 60°, a = 10. C = 180 − 40 − 60 = 80°. b = 10 sin 60° / sin 40° = 8.66025 / 0.64279 = 13.4730 → 13.5.
  const d = sinesProblem({ kind: 'AAS', given: { A: 40, B: 60 }, known: 'A', knownLen: 10, asked: 'B', mirror: false })

  it('C = 80°, b ≈ 13.5', () => {
    expect(part(d, 'third').answerText).toBe('80')
    expect(part(d, 'side').answerText).toBe('13.5')
    right(d, 'third', '80')
    right(d, 'third', '80°')
    right(d, 'side', '13.5')
    right(d, 'side', '13.47')
    right(d, 'side', '13.473')
  })

  it('names the crossed pair and RADIAN mode', () => {
    // 10 sin 40° / sin 60° = 6.42788 / 0.86603 = 7.4223 → 7.4.
    named(d, 'side', '7.4', 'ot_sines_wrong_pair')
    // In RADIAN mode: sin(60) = −0.30481, sin(40) = 0.74511, so 10 · (−0.30481) / 0.74511 = −4.0908 → −4.1.
    named(d, 'side', '-4.1', 'trig_radian_mode')
  })

  it('rounded too early, too far, or with a degree sign: a note, not an attempt', () => {
    // sin 60° ≈ 0.87 and sin 40° ≈ 0.64 written down: 10 · 0.87 / 0.64 = 13.59 → 13.6.
    expect(grade(d, 'side', '13.6')).toEqual({ verdict: 'invalid', message: EARLY_NOTE })
    note(d, 'side', '13')
    note(d, 'side', '13.5°')
    note(d, 'side', 'thirteen')
  })

  it('the third angle not found first', () => {
    // A = 40°, B = 60°, a = 10, asked c: c = 10 sin 80° / sin 40° = 9.84808 / 0.64279 = 15.3209 → 15.3.
    // B used where C belongs: 10 sin 60° / sin 40° = 13.4730 → 13.5.
    const c = sinesProblem({ kind: 'AAS', given: { A: 40, B: 60 }, known: 'A', knownLen: 10, asked: 'C', mirror: false })
    expect(part(c, 'side').answerText).toBe('15.3')
    named(c, 'side', '13.5', 'ot_third_angle_skipped')
  })

  it('ASA: the side between the two angles is across from the third', () => {
    // A = 50°, B = 70°, c = 12 (between them). C = 60°. a = 12 sin 50° / sin 60° = 9.19253 / 0.86603 = 10.6146 → 10.6.
    // B used where C belongs: 12 sin 50° / sin 70° = 9.19253 / 0.93969 = 9.7825 → 9.8.
    const asa = sinesProblem({ kind: 'ASA', given: { A: 50, B: 70 }, known: 'C', knownLen: 12, asked: 'A', mirror: true })
    expect(part(asa, 'third').answerText).toBe('60')
    expect(part(asa, 'side').answerText).toBe('10.6')
    named(asa, 'side', '9.8', 'ot_third_angle_skipped')
  })
})

describe('the law of cosines', () => {
  // a = 7, b = 10, C = 50°: c² = 49 + 100 − 140 cos 50° = 149 − 89.990 = 59.010, c = 7.6818 → 7.7.
  const d = sasProblem({ at: 'C', C: 50, x: 7, y: 10, mirror: false })

  it('c ≈ 7.7, and its slips', () => {
    expect(part(d, 'side').answerText).toBe('7.7')
    right(d, 'side', '7.68')
    // √(49 + 100) = 12.2066 → 12.2.
    named(d, 'side', '12.2', 'ot_cosines_term_dropped')
    // c² itself: 59.0 (to the tenth).
    named(d, 'side', '59.0', 'ot_square_root_skipped')
    named(d, 'side', '59', 'ot_square_root_skipped')
    // (149 − 140) cos 50° = 5.7851, √ = 2.4052 → 2.4.
    named(d, 'side', '2.4', 'ot_cosines_order')
    // RADIAN mode: cos(50) = 0.96497, 149 − 135.096 = 13.904, √ = 3.7288 → 3.7.
    named(d, 'side', '3.7', 'trig_radian_mode')
  })

  it('an obtuse angle: the term adds', () => {
    // a = 6, b = 9, C = 120°: c² = 36 + 81 − 108 cos 120° = 117 + 54 = 171, c = 13.0767 → 13.1.
    // With the cosine taken as positive: 117 − 54 = 63, √63 = 7.9373 → 7.9.
    const o = sasProblem({ at: 'C', C: 120, x: 6, y: 9, mirror: false })
    expect(part(o, 'side').answerText).toBe('13.1')
    named(o, 'side', '7.9', 'ot_cos_sign_obtuse')
  })

  it('sides 5, 6, 9: the largest angle ≈ 109.5°', () => {
    // cos C = (25 + 36 − 81) / 60 = −1/3, C = 109.4712° → 109.5.
    const s = sssProblem({ sides: { A: 5, B: 6, C: 9 }, asked: 'C', largest: true, mirror: false })
    expect(part(s, 'angle').answerText).toBe('109.5')
    right(s, 'angle', '109.5°')
    right(s, 'angle', '109.47')
    // The sign lost: cos⁻¹(1/3) = 70.5288 → 70.5. In radians: 1.9106 → 1.9.
    named(s, 'angle', '70.5', 'ot_cos_sign_obtuse')
    named(s, 'angle', '1.9', 'trig_radian_mode')
    // Across from 5: cos = (36 + 81 − 25)/108 = 0.85185 → 31.5863 → 31.6. Across from 6: (25 + 81 − 36)/90 → 38.9.
    named(s, 'angle', '31.6', 'ot_cosines_wrong_side')
    named(s, 'angle', '38.9', 'ot_cosines_wrong_side')
  })
})

describe('the ambiguous case', () => {
  it('A = 30°, a = 5, b = 8: two triangles, B ≈ 53.1° and 126.9°', () => {
    // h = 8 sin 30° = 4 < 5 < 8: two. sin B = 8 · 0.5 / 5 = 0.8, B = 53.1301° → 53.1; 180 − 53.1301 = 126.8699 → 126.9.
    const d = ambiguousProblem({ A: 30, a: 5, b: 8 })
    expect(d.stages.map((s) => s.id)).toEqual(['count', 'B1', 'B2'])
    right(d, 'count', 'two')
    named(d, 'count', 'one', 'ot_ssa_second_missed')
    expect(part(d, 'B1').answerText).toBe('53.1')
    expect(part(d, 'B2').answerText).toBe('126.9')
    right(d, 'B2', '126.9°')
    named(d, 'B2', '53.1', 'ot_sine_acute_taken')
    // Side a paired with B: sin B = 5 · 0.5 / 8 = 0.3125, B = 18.2096 → 18.2.
    named(d, 'B1', '18.2', 'ot_sines_wrong_pair')
  })

  it('A = 30°, a = 3, b = 8: no triangle', () => {
    // h = 8 sin 30° = 4 > 3: side a cannot reach.
    const d = ambiguousProblem({ A: 30, a: 3, b: 8 })
    expect(d.stages.map((s) => s.id)).toEqual(['count'])
    right(d, 'count', 'none')
    named(d, 'count', 'two', 'ot_ssa_two_claimed')
    expect(grade(d, 'count', 'one').verdict).toBe('wrong')
  })

  it('A = 40°, a = 12, b = 9: one triangle, B ≈ 28.8°', () => {
    // h = 9 sin 40° = 5.785; a = 12 > b: one. sin B = 9 · 0.64279 / 12 = 0.48209, B = 28.8228 → 28.8.
    const d = ambiguousProblem({ A: 40, a: 12, b: 9 })
    expect(d.stages.map((s) => s.id)).toEqual(['count', 'B'])
    named(d, 'count', 'two', 'ot_ssa_two_claimed')
    expect(part(d, 'B').answerText).toBe('28.8')
  })
})

describe('area', () => {
  it('sides 5, 6, 7: Heron gives 14.7', () => {
    // s = 9, 9 · 4 · 3 · 2 = 216, √216 = 14.6969 → 14.7.
    const d = heronProblem({ sides: { A: 5, B: 6, C: 7 }, mirror: false })
    expect(part(d, 'area').answerText).toBe('14.7')
    // The perimeter for s: 18 · 13 · 12 · 11 = 30888, √30888 = 175.7498 → 175.7. The root skipped: 216.0.
    named(d, 'area', '175.7', 'ot_heron_perimeter')
    named(d, 'area', '216', 'ot_square_root_skipped')
  })

  it('a = 8, b = 11, C = 40°: ½ab sin C ≈ 28.3', () => {
    // ½ · 88 · sin 40° = 44 · 0.64279 = 28.2827 → 28.3. Without the ½: 56.5654 → 56.6. With cos: 44 · 0.76604 = 33.7059
    // → 33.7. RADIAN mode: sin(40) = 0.74511, 44 · 0.74511 = 32.785 → 32.8.
    const d = sasAreaProblem({ at: 'C', C: 40, x: 8, y: 11, mirror: false })
    expect(part(d, 'area').answerText).toBe('28.3')
    named(d, 'area', '56.6', 'ot_area_half_dropped')
    named(d, 'area', '33.7', 'ot_area_cosine')
    named(d, 'area', '32.8', 'trig_radian_mode')
  })
})

describe('which law starts', () => {
  it('SAS: the law of cosines; the law of sines has no pair', () => {
    const d = chooseProblem({ case: 'SAS', sas: { at: 'C', C: 50, x: 7, y: 10, mirror: false } })
    right(d, 'law', 'cosines')
    named(d, 'law', 'sines', 'ot_sines_no_pair')
    named(d, 'law', 'neither', 'ot_right_assumed')
    expect(part(d, 'side').answerText).toBe('7.7')
  })

  it('AAS: the law of sines', () => {
    const d = chooseProblem({ case: 'AAS', sines: { kind: 'AAS', given: { A: 40, B: 60 }, known: 'A', knownLen: 10, asked: 'B', mirror: false } })
    right(d, 'law', 'sines')
    named(d, 'law', 'cosines', 'ot_cosines_for_pair')
    expect(part(d, 'side').answerText).toBe('13.5')
  })

  it('a right angle with legs 6 and 8: neither law; the hypotenuse is 10.0', () => {
    // √(36 + 64) = 10. Not rooted: 100. The squares subtracted: √28 = 5.2915 → 5.3.
    const d = chooseProblem({ case: 'legs', right: { kind: 'legs', right: 'C', x: 6, y: 8, at: 'A', fn: 'sin', mirror: false } })
    right(d, 'law', 'neither')
    named(d, 'law', 'cosines', 'ot_right_missed')
    expect(part(d, 'side').answerText).toBe('10.0')
    right(d, 'side', '10')
    named(d, 'side', '100', 'trig_side_not_rooted')
    named(d, 'side', '5.3', 'trig_pythag_subtracted')
  })

  it('a right angle, an acute angle and the hypotenuse: SOH CAH TOA', () => {
    // C = 90°, A = 35°, c = 20. a = 20 sin 35° = 11.4715 → 11.5; cos instead: 20 cos 35° = 16.3830 → 16.4.
    const d = chooseProblem({ case: 'ratio', right: { kind: 'ratio', right: 'C', x: 35, y: 20, at: 'A', fn: 'sin', mirror: false } })
    expect(part(d, 'side').answerText).toBe('11.5')
    named(d, 'side', '16.4', 'trig_opposite_adjacent_swapped')
  })
})
