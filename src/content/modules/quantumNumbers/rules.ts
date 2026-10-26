/**
 * Rule cards for quantum numbers. Hint rung 2, while she can still answer.
 * Bodies that name every option (all four quantum numbers, all nine orbitals) single none of them out.
 * Examples and the lines under the answer boxes stay off any answer a template can generate.
 */
import type { RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'

export const QN_RULE_IDS = {
  four: 'qn-four',
  shapes: 'qn-shapes',
  count: 'qn-count',
  magnetic: 'qn-magnetic',
  spin: 'qn-spin',
} as const

export const QN_RULES: readonly RuleCard[] = [
  {
    id: QN_RULE_IDS.four,
    title: 'The four quantum numbers',
    body: [
      'Every electron is described by four quantum numbers.',
      'The principal quantum number, symbol n, tells you the energy level and the orbital\'s size. It is a positive whole number, and the shells begin with the first one.',
      'The angular momentum quantum number, symbol l, tells you the sublevel and the orbital\'s shape. It is a whole number from zero up to, but not including, the shell.',
      'The magnetic quantum number, symbol ml, tells you the orbital\'s orientation. It runs from the negative of l, through zero, to the positive of l.',
      'The spin quantum number, symbol ms, tells you the electron\'s spin. The two spins are opposite halves.',
    ].join(' '),
    example: 'a shell numbered zero ✗ → shells begin with the first one',
  },
  {
    id: QN_RULE_IDS.shapes,
    title: 'Sublevels and shapes',
    body: 'The shape number picks the sublevel and the shape. Zero is an s orbital, a sphere. One is a p orbital, two lobes. Two is a d orbital, four lobes or a ring. Three is an f orbital, a more complicated shape. The pictures are s, px, py, pz, dxy, dxz, dyz, dx²−y² and dz². The shape number has to stay smaller than the shell, so a letter that would need it to equal the shell is not a real sublevel.',
    example: 'a p orbital on the first shell ✗ → that sublevel is not real',
  },
  {
    id: QN_RULE_IDS.count,
    title: 'Counting orbitals and electrons',
    body: 'A sublevel has one more orbital than twice its angular momentum quantum number: one, then three, five, and seven. Each orbital holds two electrons, so a sublevel holds twice as many electrons as orbitals. A shell holds the shell number times itself in orbitals, and twice that many electrons. The magnetic quantum numbers run from the negative end, through zero, to the positive end. A shell holds one sublevel for each angular momentum quantum number it can have.',
    example: 'the electron count where the orbitals were asked ✗ → count the orbitals',
  },
  {
    id: QN_RULE_IDS.magnetic,
    title: 'Magnetic quantum number',
    body: 'Orientation is which way an orbital points around the nucleus. An s orbital is a sphere, so the way it points does not matter. The p orbitals lie along the axes: px, py and pz. The d orbitals are dxy, dxz and dyz between the axes, dx²−y² along the x and y axes, and dz² along the z axis with a ring. A larger shell makes that same shape larger.',
    example: 'between the axes swapped with along the axes ✗ → follow where the lobes sit',
  },
  {
    id: QN_RULE_IDS.spin,
    title: 'Spin and the Pauli exclusion principle',
    body: 'Spin has two values, positive one half and negative one half. One orbital holds two electrons, and those two have opposite spins. The Pauli exclusion principle says no two electrons in an atom have the same four quantum numbers. The orbital-diagram card Pauli exclusion principle is the same rule drawn with boxes and arrows.',
    example: 'the same spin for both electrons in one orbital ✗ → the spins are opposite',
  },
]

/** Which card to put first when she hits this slip. */
export const QN_RULE_FOR: Partial<Record<ErrorPatternId, string>> = {
  qn_l_equals_n: QN_RULE_IDS.shapes,
  qn_ml_out_of_range: QN_RULE_IDS.magnetic,
  qn_ms_integer: QN_RULE_IDS.spin,
  qn_n_zero: QN_RULE_IDS.four,
  qn_shell_orbitals_as_electrons: QN_RULE_IDS.count,
  qn_shell_electrons_as_orbitals: QN_RULE_IDS.count,
  qn_sublevel_electrons_as_orbitals: QN_RULE_IDS.count,
  qn_ml_missing_zero: QN_RULE_IDS.magnetic,
  qn_ml_nonnegative: QN_RULE_IDS.magnetic,
  qn_ml_as_l: QN_RULE_IDS.magnetic,
  qn_ml_as_n: QN_RULE_IDS.magnetic,
  qn_dxy_dx2y2_swapped: QN_RULE_IDS.magnetic,
  qn_p_axis_mixed: QN_RULE_IDS.magnetic,
  qn_same_spin: QN_RULE_IDS.spin,
  qn_same_four: QN_RULE_IDS.spin,
}
