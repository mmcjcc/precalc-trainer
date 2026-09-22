/**
 * Content-layer contracts: problem instances, templates, module registry.
 * Content imports engine + notation + shared. UI imports content.
 */
import type {
  AtomQuestion,
  CalcPanels,
  ChipId,
  ErrorPatternId,
  GraphSpec,
  ModuleId,
  PropertyTag,
  RelOp,
  SigFigTask,
  SolutionSet,
  VarName,
} from '@/shared/types'

export type ProblemKind = 'inequality' | 'numberLine' | 'evenOdd' | 'inverse' | 'drill' | 'sigFigs' | 'atoms' | 'diffQuotient' | 'graphFeatures'

/** Difficulty knobs (all optional; templates document which they honor). */
export interface DifficultyKnobs {
  /** More steps (distribute + combine variants). 1 = shortest. */
  steps?: 1 | 2 | 3
  /** Fraction coefficients allowed. */
  fractions?: boolean
  /** Negative leading coefficient (forces the divide-by-negative flip). */
  negativeLead?: boolean
  /** Significant figures: every problem has a number written in scientific notation. URL flag `s`. */
  sciNotation?: boolean
  /** Significant figures: every calculation has an exact (counted or defined) number in it. URL flag `e`. */
  exactNumbers?: boolean
}

export type RuleCardId = string

export interface RuleCard {
  id: RuleCardId
  title: string
  /** Same wording as her study decks. Plain text; may include app-syntax math. */
  body: string
  example?: string
}

/** One line of the canonical solution path. */
export interface CanonicalStep {
  /** The line in app calculator syntax, e.g. "-5x + 6 <= 3". */
  text: string
  tag: PropertyTag
  /** Hint rung 1 for producing THIS line from the previous one. */
  nudge: string
  /** Hint rung 2: which rule card to show. */
  ruleCard: RuleCardId
  /**
   * Structural stage this line reaches (progress = highest stage satisfied by the student's
   * current line). Stage predicates live in the module (content/modules/<m>/stages.ts).
   */
  stage: string
}

export interface CheckValue {
  /** Friendly integer input. */
  k: number
  /** f(k), an integer by construction. */
  fk: number
  /** For not-one-to-one quadratics: the twin input with the same output. */
  twin?: number
}

export type OneToOneReason = 'fails_hlt' | 'even_power_pm' | 'repeated_y'
export type Parity = 'even' | 'odd' | 'neither'
export type ParityReason = 'domain_asymmetric' | 'values'

/** How the significant-figures UI collects the answer. */
export type SigFigEntry =
  /** A whole number of figures (the UI may also let her tap the digits: engine `gradeSigFigTaps`). */
  | 'count'
  /** A numeral in any accepted spelling; offer a power-of-ten box (engine `composeSigFigText`). */
  | 'numeral'

/** One number of a significant-figures problem as it is printed: numeral, unit, and what it is. */
export interface SigFigQuantity {
  /** Exactly the task's term text (ASCII, engine-parseable), e.g. "12.50", "1.20 x 10^3". */
  text: string
  /** Pretty numeral, e.g. "1.20 × 10³". */
  display: string
  /** "g", "mL", "cm", "°C"; "" for a pure number. */
  unit: string
  /** What the number is, e.g. "mass of the sample". */
  label: string
  /** Rule 6: counted or defined. */
  exact: boolean
  /** Why it is exact: "counted", "defined: 100 cm = 1 m". */
  note?: string
}

/** One element as a periodic-table lookup shown beside an atomic-structure question. */
export interface AtomPeriodicEntry {
  z: number
  symbol: string
  name: string
}

/** One labelled turning point of a "reading a graph" problem. */
export interface GraphFeaturesTurn {
  x: number
  y: number
  kind: 'min' | 'max'
}

export type AnswerSpec =
  | {
      /**
       * Difference quotient (f(x + h) − f(x))/h. Grade with the ENGINE: `checkFxhLine` for the f(x + h)
       * line, `checkDqLine` for every line after the built start line; the problem is finished when
       * `checkDqLine` says the line is `simplified` (equivalent AND defined at h = 0).
       */
      type: 'diffQuotient'
      /** f(x) in app syntax, e.g. "3x^2 + 2x - 1". */
      f: string
      /** f(x + h): every x replaced by (x + h), unexpanded (the canonical stage-1 line). */
      fxh: string
      /** The simplified difference quotient in x and h, e.g. "6x + 3h + 2". */
      simplified: string
      /** Exclusions shown with the answer, "h != 0" first (then e.g. "x != 0", "x + h != 0"). */
      restrictions: string[]
      /** Extra sentence for the completion card ('' when none), e.g. why a line's answer is its slope. */
      note: string
    }
  | {
      /**
       * Atomic structure (chemistry). Grade with the ENGINE by `question.kind`: `gradeParticles`,
       * `gradeNotation`, `gradeAverageMass` (a SigFigGrade), `gradeAbundance`. Never compare text.
       */
      type: 'atoms'
      question: AtomQuestion
      /** The question in one line, plain words (not app syntax). */
      prompt: string
      /** One sentence that sets the scene ('' when there is nothing to add). */
      context: string
      /** KaTeX of the particle when it is shown as a nuclear symbol (particles, symbol form). */
      latex?: string
      /** Periodic-table lookups to show beside the question (the element, or a strip of neighbors). */
      periodic: AtomPeriodicEntry[]
      /** Unit printed beside the answer box: 'u' (average mass), '%' (abundance), '' otherwise. */
      unit: string
      /** Canonical answer per box, in box order (for "show the answer" only). */
      expected: string[]
      /** The whole answer, pretty: "17 protons, 20 neutrons, 18 electrons", "²³₁₁Na⁺", "35.45 u". */
      expectedDisplay: string
      /** Hint rung 1 (never contains the answer). */
      nudge: string
      /** Hint rung 2: id of the rule card to show first (in the module's `ruleCards`). */
      ruleCard: RuleCardId
      /** Every rule card this problem leans on, most relevant first (includes `ruleCard`). */
      ruleCards: RuleCardId[]
      /** Hint rung 3 and the after-correct explanation (reveals the answer). */
      reveal: string[]
      /** Scenario this seed was built around, e.g. "cation-symbol", "element-x-three". */
      trap: string
    }
  | {
      /**
       * Significant figures (chemistry). Grade with the ENGINE: `gradeSigFigAnswer(task, typed)`;
       * never compare against `expected` as text (many spellings are right).
       */
      type: 'sigFigs'
      /** The engine task, JSON-safe. */
      task: SigFigTask
      entry: SigFigEntry
      /** The question in one line, numerals pretty-printed: "12.50 g ÷ 4.1 mL", "Round 1999 m to 2 significant figures". */
      prompt: string
      /** One chemistry-flavoured sentence that sets the scene ("" when the bare numeral is the question). */
      context: string
      /** The task's numbers in reading order (same order as engine `sigFigTaskTerms(task)`). */
      quantities: SigFigQuantity[]
      /** Unit to print beside the answer box ("" = none), e.g. "g/mL". */
      unit: string
      /** Canonical answer, ASCII and engine-parseable ("3.0", "2.0 x 10^3", "2000."); a count for entry 'count'. */
      expected: string
      /** The same, pretty ("2.0 × 10³"). */
      expectedDisplay: string
      /** Equally right spellings (ASCII), e.g. the scientific twin of "12000". */
      alternates: string[]
      /** Hint rung 1. */
      nudge: string
      /** Hint rung 2: id of the rule card to show first (in the module's `ruleCards`). */
      ruleCard: RuleCardId
      /** Every rule card this problem leans on, most relevant first (includes `ruleCard`). */
      ruleCards: RuleCardId[]
      /** Hint rung 3 and the after-correct explanation: the engine's steps. Reveals the answer. */
      reveal: string[]
      /** Named trap this seed was built around, e.g. "quotient-significant-zero". */
      trap: string
    }
  | {
      type: 'set'
      set: SolutionSet
      /** Canonical strings for "show the answer". */
      interval: string
      setBuilder: string
      requireInterval: boolean
      requireSetBuilder: boolean
    }
  | {
      type: 'parity'
      f: string
      verdict: Parity
      reason: ParityReason
      /** Canonical f(−x) lines (app syntax): first unsimplified, last simplified. */
      fNegX: string[]
      /** Canonical −f(x) lines (app syntax): first unsimplified, last simplified. */
      negF: string[]
      /** Plug-in check value. */
      k: number
    }
  | {
      type: 'inverse'
      oneToOne: boolean
      reason?: OneToOneReason
      /** f⁻¹(x) in app syntax when one-to-one. */
      inverse?: string
      /** Restriction on the inverse's input, e.g. "x >= 0" (rare in v1). */
      restriction?: string
      /** Bonus restricted-domain inverse for the NOT case, e.g. "sqrt((x+7)/4)" on x ≥ h. */
      bonusInverse?: string
    }
  | {
      /**
       * Reading a graph (precalculus). Grade with `gradeGraphFeatures` (content): intervals through the
       * notation parser, points as "(x, y)" / "and" / "none". The graph on `instance.graph` is the question.
       */
      type: 'graphFeatures'
      /** W: two local mins, both ends up. M: the mirror. S: one max and one min, ends opposite. */
      shape: 'W' | 'M' | 'S'
      /** Turning points left to right. The curve passes through each with zero slope. */
      turns: GraphFeaturesTurn[]
      /** y → +∞ ('up') or −∞ ('down') as x → −∞. */
      leftEnd: 'up' | 'down'
      /** y → +∞ ('up') or −∞ ('down') as x → +∞. */
      rightEnd: 'up' | 'down'
      /** Canonical interval strings (decimal quarters, open at each turn). */
      increasing: string
      decreasing: string
      increasingSet: SolutionSet
      decreasingSet: SolutionSet
      /** 'none' or one point "(x, y)". */
      globalMax: string
      globalMin: string
      /** 'none' or points joined with "and", left to right. Includes the global extremum when there is one. */
      localMax: string
      localMin: string
      globalMaxPoint: { x: number; y: number } | null
      globalMinPoint: { x: number; y: number } | null
      localMaxPoints: { x: number; y: number }[]
      localMinPoints: { x: number; y: number }[]
      /** Hint rung 1 (never contains the answer). */
      nudge: string
      /** Hint rung 2 before any named mistake: id of the rule card to show first. */
      ruleCard: RuleCardId
      /** Every rule card this problem leans on, most relevant first (includes `ruleCard`). */
      ruleCards: RuleCardId[]
      /** Hint rung 3 and the after-correct explanation (reveals the answer). */
      reveal: string[]
    }
  | {
      type: 'drill'
      question: 'which_property' | 'legal_or_illegal'
      verdict: 'legal' | 'illegal'
      chip?: ChipId
      patternId?: ErrorPatternId
      lesson: string
    }

export interface ProblemInstance {
  /** `${moduleId}/${templateId}@${genVersion}/${seedBase36}` */
  id: string
  moduleId: ModuleId
  templateId: string
  /** Skill key for progress = templateId. */
  skill: string
  genVersion: number
  seed: number
  knobs: DifficultyKnobs
  kind: ProblemKind
  /** e.g. "Solve the inequality" */
  title: string
  /** Plain-English instructions, e.g. "Solve for x. Give the answer in interval AND set notation." */
  instructions: string
  /** Problem statement in app syntax (rendered via engine toLatex). */
  statementText: string
  vars: VarName[]
  /** First line placed in the worked column (null for answer-only kinds). */
  start: string | null
  /** Canonical path (empty for answer-only kinds). For inverses: swap-first ordering. */
  canonical: CanonicalStep[]
  /** Inverses only: solve-for-x-first, swap-last ordering. */
  canonicalAlt?: CanonicalStep[]
  answer: AnswerSpec
  graph: GraphSpec
  calc: CalcPanels
  check?: CheckValue
  /** Template parameters (for debugging/tests). */
  params: Record<string, number | string | boolean>
}

export interface KnobDef {
  key: keyof DifficultyKnobs
  label: string
  default: DifficultyKnobs[keyof DifficultyKnobs]
}

export interface TemplateDef {
  /** e.g. "ineq.distribute-negative", "inv.cbrt-shift" */
  id: string
  title: string
  description: string
  /** Bump whenever RNG consumption order changes. */
  version: number
  knobs: KnobDef[]
  generate: (seed: number, knobs: DifficultyKnobs) => ProblemInstance
}

/** Progress anchoring: where is the student's current line on the canonical path? */
export interface ProgressInfo {
  /** Stages satisfied so far (0..total). */
  stage: number
  total: number
  /** Short label of the current stage, e.g. "x-terms collected". */
  label: string
  /** Index into `canonical` (or `canonicalAlt`) of the highest line equivalent to the current line, or -1. */
  anchorIndex: number
  /** Which path the anchor came from. */
  path: 'canonical' | 'alt' | 'none'
}

export interface ModuleDef {
  id: ModuleId
  /** School subject for grouping on the home page. Absent = precalculus. */
  subject?: string
  title: string
  blurb: string
  order: number
  templates: TemplateDef[]
  ruleCards: RuleCard[]
  /**
   * Compute progress from the student's current line (app syntax) for an instance of this module.
   * Must be pure and fast (it runs after every accepted step).
   */
  progress: (instance: ProblemInstance, currentLine: string | null, swapped: boolean) => ProgressInfo
  /**
   * The next canonical step to reveal/hint from the student's current state, or null when the
   * current line is already the final canonical line. Anchors on the current line, not on step count.
   */
  nextStep: (instance: ProblemInstance, currentLine: string | null, swapped: boolean) => CanonicalStep | null
  /**
   * Is the current line in finished form (e.g. x isolated for inequalities)? Flows use this — not
   * the progress anchor — to open the final-answer card. Omitted for answer-only modules.
   */
  solved?: (instance: ProblemInstance, currentLine: string | null) => boolean
}

/** Properties drill item (module 5). */
export interface DrillItem {
  id: string
  family: string
  mode: 'relation' | 'expression'
  before: string
  after: string
  relOp?: RelOp
  question: 'which_property' | 'legal_or_illegal'
  verdict: 'legal' | 'illegal'
  chip?: ChipId
  patternId?: ErrorPatternId
  lesson: string
  /** Id of the legal/illegal twin item. */
  twinId?: string
}
