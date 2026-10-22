/**
 * Honors geometry Unit 6, worked by hand. Each case is one fixed seed, solved on paper first; the test pins the prompt,
 * the answers, and the value of each slip. A change to a generator that moves these numbers has to be worked again.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { ModuleId } from '@/shared/types'
import { gradeGeoStage } from './grade'

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed}`)
  return p.answer
}

const answers = (a: GeometryAnswer) => a.stages.map((s) => s.answerText)
const grade = (a: GeometryAnswer, stage: string, text: string) => gradeGeoStage(a, stage as never, text)
const slip = (a: GeometryAnswer, stage: string, text: string, id: string) => expect(grade(a, stage, text), `${stage} ${text}`).toMatchObject({ verdict: 'mistake', mistake: id })

describe('proportions, worked by hand', () => {
  it('gr.proportion/1: a binomial in the numerator', () => {
    // 2 · 21 = 7(x + 1): 42 = 7x + 7, so x = 5. Multiplying only the x: 42 = 7x + 1, x = 41/7.
    // Each fraction's own top times bottom: 2 · 7 = 21(x + 1), x = −1/3. One ratio turned over: 2(x + 1) = 7 · 21, x = 145/2.
    const a = answerOf('geoRatios', 'gr.proportion', 1)
    expect(a.prompt).toBe('Solve for x: 2/7 = (x + 1)/21.')
    expect(answers(a)).toEqual(['5'])
    slip(a, 'x', '41/7', 'geo_proportion_distribute')
    slip(a, 'x', '-1/3', 'geo_cross_multiplied_wrong')
    slip(a, 'x', '145/2', 'geo_one_ratio_inverted')
    expect(grade(a, 'x', 'x = 5').verdict).toBe('correct')
  })

  it('gr.proportion/4: x in a denominator', () => {
    // 10x = 5 · 16 = 80, x = 8. Own products: 10 · 16 = 5x, x = 32. Turned over: 10 · 5 = 16x, x = 25/8.
    const a = answerOf('geoRatios', 'gr.proportion', 4)
    expect(a.prompt).toBe('Solve the proportion 10/16 = 5/x for x.')
    expect(answers(a)).toEqual(['8'])
    slip(a, 'x', '32', 'geo_cross_multiplied_wrong')
    slip(a, 'x', '25/8', 'geo_one_ratio_inverted')
  })

  it('gr.proportion/36: a binomial on both sides', () => {
    // 7(x + 12) = 12(x − 3): 7x + 84 = 12x − 36, so 5x = 120 and x = 24. Not distributing: 7x + 12 = 12x − 3, x = 3.
    const a = answerOf('geoRatios', 'gr.proportion', 36)
    expect(a.prompt).toBe('Solve the proportion (x + 12)/12 = (x − 3)/7 for x.')
    expect(answers(a)).toEqual(['24'])
    slip(a, 'x', '3', 'geo_proportion_distribute')
    slip(a, 'x', '-33', 'geo_cross_multiplied_wrong')
  })

  it('gr.proportion/8: the geometric mean', () => {
    // x² = 18 · 2 = 36, x = 6. The average (18 + 2)/2 = 10; the product 36 is x², not x.
    const a = answerOf('geoRatios', 'gr.proportion', 8)
    expect(a.prompt).toBe('Find the geometric mean of 18 and 2.')
    expect(answers(a)).toEqual(['6'])
    slip(a, 'x', '10', 'geo_geometric_as_arithmetic')
    slip(a, 'x', '36', 'geo_mean_not_rooted')
  })

  it('gr.proportion/22 and /18: a ratio from an equation', () => {
    // 2h = 5u: divide by 2u, h/u = 5/2. Upside down: 2/5.
    const a = answerOf('geoRatios', 'gr.proportion', 22)
    expect(a.prompt).toBe('If 2h = 5u, find the ratio of h to u.')
    expect(answers(a)).toEqual(['5/2'])
    expect(grade(a, 'result', '5:2').verdict).toBe('correct')
    expect(grade(a, 'result', '2.5').verdict).toBe('correct')
    slip(a, 'result', '2/5', 'geo_one_ratio_inverted')
    slip(a, 'result', '2:5', 'geo_one_ratio_inverted')
    // d/12 = u/3: d/u = 12/3 = 4, so u/d = 1/4.
    const b = answerOf('geoRatios', 'gr.proportion', 18)
    expect(b.prompt).toBe('If d/12 = u/3, find the ratio of u to d.')
    expect(answers(b)).toEqual(['1/4'])
    slip(b, 'result', '4', 'geo_one_ratio_inverted')
  })

  it('gr.proportion/10: the sum property is the one that must be true', () => {
    // e/y = g/d: (e + g)/(y + d) = e/y cross-multiplies to ey + gy = ey + ed, so gy = ed, the cross products.
    // ey = gd multiplies each fraction's own top and bottom; y/e = g/d turns one ratio over; (e + 1)/y = (g + 1)/d is false.
    const a = answerOf('geoRatios', 'gr.proportion', 10)
    expect(a.prompt).toBe('If e/y = g/d, which equation must also be true?')
    const text = (id: string) => a.stages[0]!.choices!.find((c) => c.id === id)!.text
    expect(text(a.stages[0]!.answerText)).toBe('(e + g)/(y + d) = e/y')
    slip(a, 'a', 'cross', 'geo_cross_multiplied_wrong')
    slip(a, 'a', 'flip', 'geo_one_ratio_inverted')
    expect(grade(a, 'a', 'plain').verdict).toBe('wrong')
  })
})

describe('similar polygons, worked by hand', () => {
  it('gr.polygons/2: triangles, a side in x', () => {
    // △BAZ ~ △HQP: B↔H, A↔Q, Z↔P. BA = 48 and HQ = 36 correspond: the scale factor of BAZ to HQP is 48/36 = 4/3.
    // PH ↔ ZB = 32, so PH = 32 · 3/4 = 24: x + 4 = 24, x = 20. The side drawn where PH is drawn is BA = 48: 36 = x + 4, x = 32.
    const a = answerOf('geoRatios', 'gr.polygons', 2)
    expect(a.prompt).toBe('In the figure, △BAZ ~ △HQP. Find the scale factor of △BAZ to △HQP, then x, then PH.')
    expect(answers(a)).toEqual(['4/3', '20', '24'])
    expect(grade(a, 'a', '4:3').verdict).toBe('correct')
    slip(a, 'a', '3/4', 'geo_scale_factor_inverted')
    slip(a, 'x', '32', 'geo_matched_by_position')
    slip(a, 'result', '20', 'geo_answered_x')
  })

  it('gr.polygons/3: an angle in x, and the third angle by the angle sum', () => {
    // △EDC ~ △PRQ: E↔P, D↔R, C↔Q. DC = 12 ↔ RQ = 8, so the scale factor of PRQ to EDC is 8/12 = 2/3.
    // Angle R ↔ angle D = 45°: 3x = 45, x = 15. Angle P ↔ angle E = 180 − 45 − 62 = 73.
    // Supplementary: 3x = 135, x = 45. Scaled: 3x = 45 ÷ 3/2 = 30, x = 10.
    const a = answerOf('geoRatios', 'gr.polygons', 3)
    expect(a.prompt).toBe('In the figure, △EDC ~ △PRQ. Find the scale factor of △PRQ to △EDC, then x, then m∠P.')
    expect(answers(a)).toEqual(['2/3', '15', '73'])
    slip(a, 'x', '45', 'geo_corresponding_supplementary')
    slip(a, 'x', '10', 'geo_angle_scaled')
    slip(a, 'result', '107', 'geo_corresponding_supplementary')
    expect(grade(a, 'result', '73°').verdict).toBe('correct')
  })

  it('gr.polygons/7: quadrilaterals and the perimeter', () => {
    // DCBA ~ ZYWV. WV = 20 ↔ BA = 8: the scale factor of ZYWV to DCBA is 20/8 = 5/2. ZY ↔ DC = 14: ZY = 35 = 5x + 20, x = 3.
    // The perimeter of DCBA is 14 + 18 + 8 + 10 = 50, so ZYWV's is 50 · 5/2 = 125. Squared: 50 · 25/4 = 625/2.
    const a = answerOf('geoRatios', 'gr.polygons', 7)
    expect(a.prompt).toBe('In the figure, DCBA ~ ZYWV. Find the scale factor of ZYWV to DCBA, then x, then the perimeter of ZYWV.')
    expect(answers(a)).toEqual(['5/2', '3', '125'])
    slip(a, 'result', '625/2', 'geo_perimeter_ratio_squared')
    slip(a, 'result', '20', 'geo_scale_factor_inverted')
  })
})

describe('proving triangles similar, worked by hand', () => {
  it('gt.prove/14: two proportional sides and an angle that is not between them prove nothing', () => {
    // TS/CE = 18/24 = 3/4 and SV/EY = 12/16 = 3/4, but the arcs are at T and C, across from SV and EY: SSA.
    const a = answerOf('geoSimilarTriangles', 'gt.prove', 14)
    expect(a.figure.ariaLabel).toContain('Angles T and C each have one arc.')
    expect(answers(a)).toEqual(['none'])
    slip(a, 'a', 'SAS', 'geo_ssa_as_similarity')
    slip(a, 'a', 'SSS', 'geo_sss_two_pairs')
  })

  it('gt.prove/15: two angles of each triangle, one found by the angle sum', () => {
    // In TWB the third angle is T = 180 − 56 − 82 = 42. So B ≅ P (56°) and T ≅ H (42°): AA.
    const a = answerOf('geoSimilarTriangles', 'gt.prove', 15)
    expect(a.figure.ariaLabel).toBe('Triangles TWB and PHS. In triangle TWB, angle B is labeled 56° and angle W is labeled 82°. In triangle PHS, angle P is labeled 56° and angle H is labeled 42°.')
    expect(answers(a)).toEqual(['AA'])
    slip(a, 'a', 'none', 'geo_similarity_test_missed')
  })

  it('gt.prove/5: a shared angle and proportional sides', () => {
    // HV/HD = 6/9 and HQ/HF = 8/12, both 2/3, around the shared angle H: SAS. Only two pairs of sides: not SSS.
    const a = answerOf('geoSimilarTriangles', 'gt.prove', 5)
    expect(a.prompt).toBe('Which postulate or theorem, if any, proves that triangles HVQ and HDF are similar?')
    expect(answers(a)).toEqual(['SAS'])
    slip(a, 'a', 'none', 'geo_shared_angle_missed')
    slip(a, 'a', 'SSS', 'geo_sss_two_pairs')
  })

  it('gt.prove/19: vertical angles count', () => {
    // CQ and YW cross at T: the angles at T are vertical. With the arcs at C and Q: AA.
    const a = answerOf('geoSimilarTriangles', 'gt.prove', 19)
    expect(answers(a)).toEqual(['AA'])
    slip(a, 'a', 'none', 'geo_vertical_angles_missed')
    expect(grade(a, 'a', 'SAS').verdict).toBe('wrong')
  })
})

describe('using similar triangles, worked by hand', () => {
  it('gt.solve/3: a segment parallel to a side', () => {
    // YQ ∥ SC: △VYQ ~ △VSC. YQ/SC = VY/VS: 6/x = 4/6, so 4x = 36 and x = 9. A piece over a piece, 6/x = 4/2: x = 3.
    const a = answerOf('geoSimilarTriangles', 'gt.solve', 3)
    expect(a.prompt).toBe('In the figure, YQ ∥ SC, VY = 4, YS = 2, YQ = 6, and SC = x. Choose the true similarity statement, then find x.')
    const text = (id: string) => a.stages[0]!.choices!.find((c) => c.id === id)!.text
    expect(text(a.stages[0]!.answerText)).toBe('△VYQ ~ △VSC')
    expect(answers(a)[1]).toBe('9')
    slip(a, 'x', '3', 'geo_part_over_whole')
    slip(a, 'a', 's-VCS', 'geo_vertices_out_of_order')
  })

  it('gt.solve/22: the angle at D matches the angle at the far vertex', () => {
    // ∠GYT ≅ ∠GPU and G is shared: Y ↔ P and T ↔ U, △GYT ~ △GPU. GY/GP = GT/GU: 5/15 = 4/(5 + x), so 5x + 25 = 60 and x = 7.
    // Pairing by position (GY with GU): 5/(5 + x) = 4/15, so 75 = 20 + 4x and x = 55/4.
    const a = answerOf('geoSimilarTriangles', 'gt.solve', 22)
    expect(a.prompt).toBe('In the figure, ∠GYT ≅ ∠GPU, GY = 5, YU = x, GT = 4, and TP = 11. Choose the true similarity statement, then find x.')
    const text = (id: string) => a.stages[0]!.choices!.find((c) => c.id === id)!.text
    expect(text(a.stages[0]!.answerText)).toBe('△GYT ~ △GPU')
    slip(a, 'a', 's-GUP', 'geo_matched_by_position')
    expect(answers(a)[1]).toBe('7')
    slip(a, 'x', '55/4', 'geo_matched_by_position')
  })

  it('gt.solve/8: the altitude to the hypotenuse', () => {
    // GE = 9 + 7 = 16. △EPD ~ △EDG: EP/ED = ED/EG, so x² = 7 · 16 = 112 and x = 4√7.
    // The average (7 + 16)/2 = 23/2; 112 is x²; the far segment, √(9 · 16) = 12.
    const a = answerOf('geoSimilarTriangles', 'gt.solve', 8)
    expect(a.prompt).toBe('In right triangle GED, ∠GDE is a right angle and DP is the altitude to the hypotenuse, with GP = 9 and PE = 7. Choose the true similarity statement, then find x, the length of ED.')
    expect(answers(a)[1]).toBe('4√7')
    expect(grade(a, 'x', '4sqrt(7)').verdict).toBe('correct')
    expect(grade(a, 'x', 'sqrt(112)').verdict).toBe('invalid')
    slip(a, 'x', '23/2', 'geo_geometric_as_arithmetic')
    slip(a, 'x', '112', 'geo_mean_not_rooted')
    slip(a, 'x', '12', 'geo_matched_by_position')
  })

  it('gt.solve/1 and /5: shadows and a mirror', () => {
    // 5/12 = x/24, so 12x = 120 and x = 10 ft. Crossed: 5/24 = x/12, x = 5/2.
    const a = answerOf('geoSimilarTriangles', 'gt.solve', 1)
    expect(answers(a)[1]).toBe('10')
    expect(grade(a, 'x', '10 ft').verdict).toBe('correct')
    expect(grade(a, 'x', '10 feet').verdict).toBe('correct')
    slip(a, 'x', '5/2', 'geo_shadows_crossed')
    // 4/12 = x/42, so 12x = 168 and x = 14 ft. Crossed: 4/42 = x/12, x = 8/7.
    const b = answerOf('geoSimilarTriangles', 'gt.solve', 5)
    expect(b.prompt.startsWith('A mirror lies on the ground at E, 42 feet from the base of a tree.')).toBe(true)
    expect(answers(b)[1]).toBe('14')
    slip(b, 'x', '8/7', 'geo_shadows_crossed')
    expect(grade(b, 'x', '14 m').verdict).toBe('invalid')
  })
})

describe('proportional parts, worked by hand', () => {
  it('gp.splitter/1: the Triangle Proportionality Theorem', () => {
    // FG/GV = FQ/QS: 16/20 = (x + 8)/15, so 240 = 20x + 160 and x = 4; FQ = 12.
    // A piece over the whole side: 16/20 = (x + 8)/(x + 23), so 16x + 368 = 20x + 160 and x = 52.
    const a = answerOf('geoProportionalParts', 'gp.splitter', 1)
    expect(a.prompt).toBe('In triangle FVS, G is on FV, Q is on FS, and GQ ∥ VS. FG = 16, GV = 20, FQ = x + 8, and QS = 15. Find x, then FQ.')
    expect(answers(a)).toEqual(['4', '12'])
    slip(a, 'x', '52', 'geo_part_over_whole')
    slip(a, 'result', '4', 'geo_answered_x')
  })

  it('gp.splitter/2: the converse, not parallel', () => {
    // CE/ET = 15/10 = 3/2 and CR/RS = 12/20 = 3/5: not equal, so ER is not parallel to TS.
    // A piece over the whole side, CE/CT = 15/25 = 3/5, matches CR/RS and would say parallel.
    const a = answerOf('geoProportionalParts', 'gp.splitter', 2)
    expect(a.prompt).toBe('In triangle CTS, E is on CT and R is on CS, with CE = 15, ET = 10, CR = 12, and RS = 20. The figure is not drawn to scale. Is ER parallel to TS?')
    expect(answers(a)).toEqual(['no'])
    slip(a, 'a', 'yes', 'geo_part_over_whole')
  })

  it('gp.splitter/13: a parallel through a midpoint', () => {
    // G is the midpoint of EH, so UH = 2 · SG: 3x − 17 = 4x − 28, x = 11, SG = 8. The other way round, 2x − 14 = 6x − 34: x = 5.
    const a = answerOf('geoProportionalParts', 'gp.splitter', 13)
    expect(a.prompt).toBe('In triangle EUH, S is the midpoint of EU, G is on EH, and SG ∥ UH. SG = 2x − 14 and UH = 3x − 17. Find x, then SG.')
    expect(answers(a)).toEqual(['11', '8'])
    slip(a, 'x', '5', 'geo_midsegment_doubled')
    slip(a, 'result', '16', 'geo_midsegment_doubled')
  })

  it('gp.bisector/1: the Triangle Angle-Bisector Theorem', () => {
    // WY/YG = BW/BG: 21/12 = 28/x, so 21x = 336 and x = 16. Swapped, 21/12 = x/28: x = 49.
    // A piece over the whole, 21/33 = 28/x: x = 44. Own products, 21 · 12 = 28x: x = 9.
    const a = answerOf('geoProportionalParts', 'gp.bisector', 1)
    expect(a.prompt).toBe('In triangle BWG, BY bisects ∠WBG, with Y on WG. BW = 28, BG = x, WY = 21, and YG = 12. Find x.')
    expect(answers(a)).toEqual(['16'])
    slip(a, 'x', '49', 'geo_bisector_ratio_swapped')
    slip(a, 'x', '44', 'geo_part_over_whole')
    slip(a, 'x', '9', 'geo_cross_multiplied_wrong')
  })

  it('gp.bisector/5: three parallel lines', () => {
    // BE/ES = DV/VQ: 6/10 = 12/x, so 6x = 120 and x = 20. Crosswise, 6/10 = x/12: x = 36/5.
    // A piece over the whole, 6/16 = 12/x: x = 32. Own products, 6 · 10 = 12x: x = 5.
    const a = answerOf('geoProportionalParts', 'gp.bisector', 5)
    expect(a.prompt).toBe('Three parallel lines cut one transversal at B, E, and S and another at D, V, and Q. BE = 6, ES = 10, DV = 12, and VQ = x. The figure is not drawn to scale. Find x.')
    expect(answers(a)).toEqual(['20'])
    slip(a, 'x', '36/5', 'geo_one_ratio_inverted')
    slip(a, 'x', '32', 'geo_part_over_whole')
    slip(a, 'x', '5', 'geo_cross_multiplied_wrong')
  })
})
