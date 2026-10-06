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

export type ProblemKind = 'inequality' | 'numberLine' | 'evenOdd' | 'inverse' | 'drill' | 'sigFigs' | 'atoms' | 'diffQuotient' | 'graphFeatures' | 'domainRange' | 'composition' | 'functionOps' | 'transformations' | 'piecewiseRate' | 'electrons' | 'quadratics' | 'polyDivision' | 'polyZeros'

/** One operation the function-operations module asks for. `o` is composition. */
export type FunctionOpsOp =
  | 'f+g'
  | 'f-g'
  | 'g-f'
  | 'fg'
  | 'gg'
  | 'fgf'
  | 'f/g'
  | 'f+f+g'
  | 'fog'
  | 'gof'
  | 'fof'
  | 'fogog'

/** Parent functions the transformations engine accepts. Matches `ParentName`. */
export type TransformParent = 'square' | 'cube' | 'sqrt' | 'cbrt' | 'abs' | 'reciprocal'
/** How a transformation problem wrote the inside of f. */
export type TransformForm = 'factored' | 'unfactored'

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

/**
 * One constant on a light-calculation card. c and h are measured; 1 nm = 10⁻⁹ m is exact.
 * Electron-configuration problems (a later engine) will not use this card.
 */
export interface LightConstantInfo {
  /** "c", "h", or "1 nm". */
  symbol: string
  /** Pretty value, e.g. "3.00 × 10⁸" or "10⁻⁹". */
  display: string
  unit: string
  exact: boolean
  /** "3 significant figures" or "exact". */
  figures: string
}

/** Which light formula the sig-fig task encodes. Configuration questions will not use these. */
export type LightFormula = 'freq' | 'wavelength' | 'energy-freq' | 'energy-wave'

/**
 * A light calculation (CK-12 ch. 5.1–5.3). `task` is a sig-fig muldiv chain; grade it with
 * `gradeLightAnswer` in the electrons module, never by comparing text.
 */
export interface ElectronsLightQuestion {
  kind: 'light'
  formula: LightFormula
  task: SigFigTask
  /** The measurement she was given, printed large. */
  given: SigFigQuantity
  /** c and h on every calculation; the nm line when this problem uses it. */
  constants: LightConstantInfo[]
  /** Wavelength numeral as printed, not pre-converted. Absent when she is given a frequency. */
  wavelengthText?: string
  wavelengthInNm: boolean
  /** Frequency numeral as printed. Absent when she is given a wavelength. */
  frequencyText?: string
  /** The answer was asked for in nm (the task then divides by the exact 10⁻⁹). */
  answerInNm: boolean
  /** Printed beside the answer box: "Hz", "m", "nm", or "J". */
  unit: string
  expected: string
  expectedDisplay: string
  alternates: string[]
}

export interface SpectrumItem {
  id: string
  label: string
}

/**
 * Tap-to-order the spectrum or the visible colors. No calculation. Grade with `gradeSpectrumOrder`.
 */
export interface ElectronsOrderQuestion {
  kind: 'order'
  family: 'spectrum' | 'colours'
  quantity: 'wavelength' | 'frequency' | 'energy'
  direction: 'increasing' | 'decreasing'
  /** Button order (shuffled). Not the answer. */
  items: SpectrumItem[]
  /** Correct tap order, first = the end she should choose first. */
  order: string[]
}

/**
 * An electron-configuration question (CK-12 ch. 5.4 onward), graded by the econfig engine.
 * `species` is the problem; nothing here is a hand-typed configuration.
 */
export interface ElectronsEconfigQuestion {
  kind: 'econfig'
  /** `ion` asks for the configuration of an ion, in `form`. */
  ask: 'full' | 'shorthand' | 'ion' | 'identify' | 'valence' | 'diagram'
  species: { z: number; charge: number }
  /** Form she must write, or the form the configuration is shown in (identify). */
  form?: 'full' | 'shorthand'
  /** Named subshell for a diagram, e.g. "3d". */
  subshell?: string
  /** KaTeX of the species, or of the configuration when she has to name it. */
  latex: string
  /** The same in plain display text, for the accessible name and the tutor. */
  display: string
}

/** Light, spectrum order, and electron configurations. Same module, different question kinds. */
export type ElectronsQuestion = ElectronsLightQuestion | ElectronsOrderQuestion | ElectronsEconfigQuestion

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
      /**
       * Electrons and light (chemistry, CK-12 ch. 5). Calculations are sig-fig muldiv tasks graded
       * by the module (`gradeLightAnswer`): correct sig-fig answer first, then the lt_ mistakes,
       * then the sig-fig grader's own result. Spectrum order is `gradeSpectrumOrder`.
       * Electron configurations (`question.kind === 'econfig'`) are graded by the econfig engine.
       */
      type: 'electrons'
      question: ElectronsQuestion
      /** The question in one line, plain words (not app syntax). */
      prompt: string
      /** One sentence that sets the scene. */
      context: string
      /** Pretty canonical answer for the tutor: "4.8 × 10¹⁴" or "gamma → X-ray → ultraviolet". */
      expectedDisplay: string
      /** Hint rung 1 (never contains the answer). */
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      /** Hint rung 3 and the after-correct explanation. Reveals the answer. */
      reveal: string[]
      /** Scenario this seed was built around, e.g. "red-laser", "answer-in-nm". */
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
      /**
       * Domain or range from a formula (precalculus). Grade with the ENGINE: `gradeDomain` / `gradeRange`.
       * Her text is a set (`parseSetAnswer`), never compared as a string.
       */
      type: 'domainRange'
      question: 'domain' | 'range'
      /** f(x) in app syntax. */
      f: string
      interval: string
      builder: string
      set: SolutionSet
      /** Range family when `question` is `range`. */
      family?: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      /** Hint rung 3 and the after-correct explanation: the engine's lines. */
      reveal: string[]
      /** Shape this seed was built around, e.g. "negative-under-root", "reciprocal". */
      trap: string
    }
  | {
      /**
       * Composition (precalculus). Grade with the ENGINE: `gradeComposition`, `gradeCompositeValue`,
       * `gradeCompositeDomain`, or `checkDecomposition`. Any equivalent formula, and any valid
       * non-trivial decomposition, is right.
       */
      type: 'composition'
      question: 'expr' | 'value' | 'domain' | 'decompose'
      /** Outer function. For a decomposition, one valid f — not the only one. */
      f: string
      /** Inner function. For a decomposition, the g that matches `f`. */
      g: string
      /** h(x) when the question is to decompose. */
      h?: string
      /** Friendly integer for a value question. */
      a?: number
      /** Whether (f ∘ g)(a) is defined. */
      defined?: boolean
      /** Exact value text, or "undefined". */
      valueText?: string
      simplified?: string
      unsimplified?: string
      interval?: string
      builder?: string
      set?: SolutionSet
      /** The simplified formula's domain is wider than the composite's. */
      hidesRestriction?: boolean
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      reveal: string[]
      trap: string
    }
  | {
      /**
       * Transformations of f (precalculus). Grade with the ENGINE: `gradeDescription`, `gradeMappedPoint`,
       * or `gradeEquation`. Description is a set of steps; a point is "(x, y)"; an equation is an explicit
       * formula in x. `form` is how the problem wrote the inside of f.
       */
      type: 'transformations'
      question: 'describe' | 'point' | 'equation'
      parent: TransformParent
      /** App syntax of the parent, e.g. "x^2". */
      parentFormula: string
      /** Words for the parent, e.g. "square root". */
      parentWords: string
      /** Exact parameter text: "2", "-1/2", "0". */
      a: string
      b: string
      h: string
      k: string
      form: TransformForm
      /** f-notation as shown. Empty when the question gives the steps in words. */
      notation: string
      /** Explicit formula of g, app syntax. */
      formula: string
      /** describeTransform sentences, standard order. */
      sentences: string[]
      /** Point on f, "(4, -2)", for a point question. */
      sourcePoint?: string
      /** Its image on g. */
      imagePoint?: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      reveal: string[]
      trap: string
    }
  | {
      /**
       * Piecewise evaluation or average rate of change (precalculus). Grade with `gradePiecewiseValue`
       * or `gradeAverageRate`. A value may be "undefined".
       */
      type: 'piecewiseRate'
      question: 'evaluate' | 'rate'
      pieces?: {
        formula: string
        /** App syntax, e.g. "x < 2" or "1 <= x < 4". */
        condition: string
        lo: string
        hi: string
        loClosed: boolean
        hiClosed: boolean
      }[]
      /** Input for an evaluation, app syntax. */
      x?: string
      /** "5" or "undefined". */
      valueText?: string
      /** Polynomial or rational f, for a rate. */
      f?: string
      /** Endpoints of the interval, app syntax. */
      a?: string
      b?: string
      /** The rate, app syntax: "5", "-1/3". */
      rateText?: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      reveal: string[]
      trap: string
    }
  | {
      /**
       * Completing the square (precalculus Unit 2). Everything here is read off the ENGINE's
       * `completeSquare(f)`; grade with `checkSquareLine` (form, line by line), `gradeVertex`,
       * `gradeAxisOfSymmetry`, and the module's `gradeOpens` / `gradeExtremum` (vertex). Never compare text.
       */
      type: 'quadratics'
      /** `form`: rewrite f in vertex form, one line at a time. `vertex`: vertex, axis, opens, min or max value. */
      question: 'form' | 'vertex'
      /** f(x) in standard form, app syntax: "2x^2 - 12x + 13". */
      f: string
      /** The question in one line, plain words (not app syntax). Says nothing about the method. */
      prompt: string
      /** App syntax: "2(x - 3)^2 - 5". */
      vertexForm: string
      /** "(3, -5)". */
      vertexText: string
      /** "x = 3". */
      axisText: string
      opens: 'up' | 'down'
      extremumKind: 'minimum' | 'maximum'
      /** The minimum or maximum value, exact app syntax: "-5", "-5/4". */
      extremumText: string
      /** The engine's worked path: every line (app syntax) with why it follows. The first line is f itself. */
      path: { text: string; reason: string }[]
      /** The whole answer, pretty, for the tutor: "2(x − 3)^2 − 5" or "vertex (3, −5); axis x = 3; opens up; minimum value −5". */
      expectedDisplay: string
      /** Hint rung 1 (never contains the answer). */
      nudge: string
      /** Hint rung 2 before any named mistake: id of the rule card to show first. */
      ruleCard: RuleCardId
      /** Every rule card this problem leans on, most relevant first (includes `ruleCard`). */
      ruleCards: RuleCardId[]
      /** Hint rung 3 and the after-finish explanation: the engine's lines. Reveals the answer. */
      reveal: string[]
      /** The named mistake this seed promises (a PolyMistakeKind the engine lists for this f). */
      trap: string
      /**
       * The parabola with its vertex marked. NOT on `instance.graph`: that panel can be opened before she
       * finishes. The flow shows this one only after the problem is complete.
       */
      graph: GraphSpec
    }
  | {
      /**
       * Synthetic division, the remainder theorem and the factor theorem (precalculus Unit 2). Everything
       * here is read off the ENGINE's `syntheticDivision(f, c)`. The problem is answered in `stages`, one
       * check each: grade with `gradeCoefficientRow`, the module's `gradeDivisionTable` (the engine's
       * `gradeSyntheticTable` on her box, products and bottom row), `gradeBottomRow`, `gradeQuotient`,
       * `gradeRemainder` and `gradeIsFactor`. Never compare text.
       */
      type: 'polyDivision'
      /** `table`: the whole table, then quotient and remainder. `value`: f(c). `factor`: is x − c a factor? */
      question: 'table' | 'value' | 'factor'
      /** f(x) in standard form, app syntax: "2x^3 - 3x^2 - 5". */
      f: string
      /** The number that makes the divisor zero, exact app syntax: "2", "-2". */
      c: string
      /** The divisor as it is shown, app syntax: "x - 2", "x + 2" (never "x - (-2)"). */
      divisor: string
      degree: number
      /** The question in one line, plain words. Says nothing about the method's steps or the trap. */
      prompt: string
      /** The engine's three rows, one string per cell. `products[i]` sits under `coefficients[i + 1]`. */
      rows: { coefficients: string[]; products: string[]; bottom: string[] }
      /** App syntax: "2x^2 + x + 2". */
      quotientText: string
      /** The remainder, which is f(c): "-1". */
      remainderText: string
      isFactor: boolean
      /** The parts she answers, in order. Each has its own hint ladder (hint key = its index). */
      stages: {
        id: 'row' | 'grid' | 'answers' | 'bottom' | 'value' | 'factor'
        /** Hint rung 1 for this part (never contains the answer). */
        nudge: string
        /** Hint rung 2 before any named mistake in this part. */
        ruleCard: RuleCardId
        /** Hint rung 3 for this part: the engine's lines that answer it. */
        reveal: string[]
      }[]
      /** The whole answer, pretty, for the tutor. */
      expectedDisplay: string
      /** The first part's nudge (the per-part ones are in `stages`). */
      nudge: string
      ruleCard: RuleCardId
      /** Every rule card this problem leans on, most relevant first (includes `ruleCard`). */
      ruleCards: RuleCardId[]
      /** The after-finish explanation: the engine's whole worked table. Reveals the answer. */
      reveal: string[]
      /** The named mistake this seed promises (a PolyMistakeKind the engine lists for this f and c). */
      trap: string
    }
  | {
      /**
       * Zeros and multiplicity, end behavior, a polynomial from its zeros, and rational root candidates
       * (precalculus Unit 2). Everything here is read off the ENGINE (`analyzeFactored`,
       * `polynomialFromZeros`, `rationalRootCandidates`). The problem is answered in `stages`, one check
       * each: grade with the module's `gradeZerosStage`, which calls `gradeZeros`, `gradeCrossTouch`,
       * `gradeEndBehavior`, `gradePolynomialFromZeros`, `gradeRootCandidates` and `gradeRationalZeros`.
       * Never compare text.
       */
      type: 'polyZeros'
      /**
       * `zeros`: zeros with multiplicities, then crosses or touches at each. `end`: the two ends.
       * `build`: the polynomial of least degree with given zeros through a point. `rational`: every
       * possible rational zero, then which of them are zeros.
       */
      question: 'zeros' | 'end' | 'build' | 'rational'
      /**
       * The polynomial, app syntax. `zeros`: factored, "-2(x + 1)^2(x - 3)". `end`: factored or standard
       * form, as shown. `rational`: standard form. `build`: the ANSWER in factored form, which is never
       * shown before she finishes (`form` is 'hidden').
       */
      f: string
      form: 'factored' | 'standard' | 'hidden'
      /** The question in one line, plain words. Says nothing about the method or the trap. */
      prompt: string
      /**
       * `zeros`: the engine's zeros, ascending (the order of the crosses / touches choices), each with what
       * the graph does there. `build`: the given zeros in the order they are shown. Empty otherwise.
       */
      zeros: { text: string; mult: number; behavior?: 'crosses' | 'touches' }[]
      /** `build`: the point the graph passes through, exact app syntax. */
      point?: { x: string; y: string }
      /** `zeros` and `end`: where f(x) goes at the far left and the far right. */
      end?: { left: 'up' | 'down'; right: 'up' | 'down' }
      /** `rational`: every candidate, as the engine writes the list: "+-1, +-3, +-1/2, +-3/2". */
      candidatesText?: string
      /** `rational`: the candidates that are zeros, "-1, 1/2, 3", or "none". */
      rationalZerosText?: string
      /** The parts she answers, in order. Each has its own hint ladder (hint key = its index). */
      stages: {
        id: 'zeros' | 'cross' | 'end' | 'formula' | 'candidates' | 'rational'
        /** Hint rung 1 for this part (never contains the answer). */
        nudge: string
        /** Hint rung 2 before any named mistake in this part. */
        ruleCard: RuleCardId
        /** Hint rung 3 for this part: the engine's lines that answer it. */
        reveal: string[]
      }[]
      /** The whole answer, pretty, for the tutor. */
      expectedDisplay: string
      /** The first part's nudge (the per-part ones are in `stages`). */
      nudge: string
      ruleCard: RuleCardId
      /** Every rule card this problem leans on, most relevant first (includes `ruleCard`). */
      ruleCards: RuleCardId[]
      /** The after-finish explanation: the engine's lines. Reveals the answer. */
      reveal: string[]
      /** The named mistake this seed promises (a PolyMistakeKind the engine names for this problem). */
      trap: string
      /**
       * The graph of f for `zeros` and `end` ({ kind: 'none' } otherwise). NOT on `instance.graph`: that
       * panel can be opened before she finishes. The flow shows this one only after the problem is complete.
       */
      graph: GraphSpec
    }
  | {
      /**
       * Operations with functions (precalculus). One value from a table or from two graphs, or one formula.
       * Grade with the module's `gradeFunctionOps`: a value is a number or "undefined"; a formula is accepted
       * when it matches exactly (any equivalent form, including an unsimplified quotient). Named mistakes are
       * the `op_` ids, each computed for this problem.
       */
      type: 'functionOps'
      question: 'table' | 'graph' | 'formula'
      op: FunctionOpsOp
      /** The input, app syntax: "-5" or "x". */
      at: string
      /** The sentence above the data. Says what to find and nothing about the method. */
      prompt: string
      /** "11", "undefined", or a formula in app syntax. */
      answerText: string
      /** What the promised trap produces, app syntax. A number, or a formula. Never the right answer. */
      trapAnswer: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      /** Hint rung 3. For a value, one step at a time. */
      reveal: string[]
      /** The named mistake this seed promises, when one is unambiguous. */
      trap: string
      /** Table columns, shared x-values. */
      xs?: number[]
      fv?: number[]
      gv?: number[]
      /** Graph vertices, piecewise linear, integer lattice points. */
      fPts?: { x: number; y: number }[]
      gPts?: { x: number; y: number }[]
      /** Formulas, app syntax. */
      f?: string
      g?: string
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
