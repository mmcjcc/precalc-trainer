/**
 * Content-layer contracts: problem instances, templates, module registry.
 * Content imports engine + notation + shared. UI imports content.
 */
import type {
  AtomQuestion,
  CalcPanels,
  ChipId,
  ErrorPatternId,
  GeoFigureSpec,
  GraphSpec,
  ModuleId,
  PropertyTag,
  RelOp,
  SigFigTask,
  SolutionSet,
  VarName,
} from '@/shared/types'

export type ProblemKind = 'inequality' | 'numberLine' | 'evenOdd' | 'inverse' | 'drill' | 'sigFigs' | 'atoms' | 'diffQuotient' | 'graphFeatures' | 'domainRange' | 'composition' | 'functionOps' | 'transformations' | 'piecewiseRate' | 'electrons' | 'periodic' | 'quadratics' | 'optimization' | 'polyDivision' | 'polyZeros' | 'rationalFns' | 'signCharts' | 'complexNums' | 'logForms' | 'logProperties' | 'expLogEquations' | 'expLogGraphs' | 'expModels' | 'angleMeasure' | 'rightTriangle' | 'unitCircle' | 'geometry' | 'nomenclature'

/** Precalculus Unit 2, optimization with quadratics: a pen against a wall, pens in a row, two numbers, price and sales. */
export type OptimizationQuestion = 'wall' | 'pens' | 'numbers' | 'revenue'

/** What kind of number a number part asks for, which decides the units it may carry. */
export type OptPartDimension = 'length' | 'area' | 'money' | 'count' | 'none'

/**
 * What one optimization part checks, with engine/optim's graders. Equations are app syntax with the problem's
 * letters (x, y and the quantity's letter); a number is exact ("125", "100/3", "23/2").
 */
export type OptPartCheck =
  /** The secondary equation (the condition: fencing, sales, the numbers), linear in x and y. */
  | { kind: 'constraint'; equation: string }
  /** The primary equation: the quantity in terms of x and y. */
  | { kind: 'primary'; equation: string }
  /** The final equation: the quantity in x alone (`x`) or in y alone (`y`); either is right. */
  | { kind: 'final'; x: string; y: string }
  | {
      kind: 'number'
      value: string
      /** Decimal places the problem asks for; absent when the answers are exact (a fraction is fine). */
      places?: number
      dim: OptPartDimension
      /** An area has to carry its square unit. */
      unitRequired?: boolean
      /** The box's letter ('x', 'y', 'A'): "x =" in front is fine, another letter is a note. */
      name: string
      /** The box in words for the notes: "x", "the largest area". */
      what: string
    }

/** A slip named on one optimization part, computed by the template for this problem. */
export interface OptPartTrap {
  id: ErrorPatternId
  /** What the slip gives, as she would type it: an equation (app syntax) or a number. Never the right answer. */
  text: string
  /** The sentence about her answer (math). It never states this problem's answer. */
  witness: string
}

/**
 * One part of an optimization problem, answered and checked on its own. Text fields marked "math" hold KaTeX between
 * dollar signs; `trig/text.ts` `plain` reads them as words.
 */
export interface OptPart {
  /** 'secondary', 'primary', 'final', 'best', 'other', 'max'. */
  id: string
  kind: 'equation' | 'number'
  /** Card title and box label, plain text: "Secondary equation", "x", "Largest area". */
  label: string
  /** The question (math). */
  ask: string
  /** Under the box, plain text. No answer a template can generate. */
  formatHint: string
  /** Hint rung 1 (math): the method, not this problem's answer. */
  nudge: string
  ruleCard: RuleCardId
  /** Hint rung 3 and the worked lines of this part (math). May state this part's answer, never a later one. */
  reveal: string[]
  /** The answer as she would type it. */
  answerText: string
  /** Other spellings of the answer that grade right: for the self-check and the leak checks. */
  forms: string[]
  check: OptPartCheck
  /** The note for a plain wrong answer (plain text): what to look at, never the answer. */
  wrongNote: string
  /** What a right answer is told (math). */
  rightNote: string
  traps: OptPartTrap[]
}

/**
 * The pen (or the row of pens) of a fence problem, drawn by components/OptFigure: rectangles side by side, a hatched
 * wall along the top when there is one, and every fenced side labelled with its letter. Never drawn to scale and never
 * with a number: the figure shows how the fence runs, not the answer.
 */
export interface OptFigureSpec {
  /** Pens in the row: 1 to 4. A pen with a divider is drawn as 2 with `whole` set. */
  pens: number
  /** One letter along the whole row (a divided pen) instead of one per pen. */
  whole: boolean
  /** A wall along the top edge: no fence there. */
  wall: boolean
  /** The wall's name, drawn on it: "stone wall", "barn". */
  wallLabel: string
  /** The letter of the sides across the row (the ends and the dividers), and of the sides along it. */
  across: 'x' | 'y'
  along: 'x' | 'y'
  /** Words for a screen reader and the tutor. Describes the picture, never an answer. */
  ariaLabel: string
}

/** Which chemical-nomenclature screen this problem is (CK-12 chapter 7). */
export type NomenclatureQuestion = 'ion' | 'ionicFormula' | 'ionicName' | 'ionicFromName' | 'molecular' | 'acid' | 'hydrate' | 'classify'

/** One checked part of a nomenclature problem. */
export type NmStageId = 'a' | 'b' | 'c'

/**
 * What kind of answer a nomenclature part has. A format hint, a rule-card example or a catalog example shown on a
 * part never contains an answer the templates can generate for a part of this kind.
 */
export type NmPartKind =
  | 'ion-name'
  | 'ion-formula'
  | 'ionic-name'
  | 'ionic-formula'
  | 'molecular-name'
  | 'molecular-formula'
  | 'acid-name'
  | 'acid-formula'
  | 'hydrate-name'
  | 'hydrate-formula'
  | 'class'

/**
 * What one nomenclature part asks, exactly as the engine's grader takes it (plain app text). The grader is picked
 * by `kind`: ion_name → gradeIonName(ion), ion_formula → gradeIonFormula(ion), ionic_formula →
 * gradeIonicFormula(cation, anion), name → gradeNameFromFormula(formula, { inWater }), formula →
 * gradeFormulaFromName(name), classify → gradeClassify(formula, pick, { inWater }).
 */
export type NmCheck =
  | { kind: 'ion_name'; ion: string }
  | { kind: 'ion_formula'; ion: string }
  | { kind: 'ionic_formula'; cation: string; anion: string }
  | { kind: 'name'; formula: string; inWater?: boolean }
  | { kind: 'formula'; name: string }
  | { kind: 'classify'; formula: string; inWater?: boolean }

/** One piece of a nomenclature prompt: words, or a formula or ion (plain app text) the screen draws with subscripts. */
export type NmPromptPart = { text: string } | { formula: string }

/** Precalculus Unit 3. Evaluate, rewrite the form, or round a change-of-base value. */
export type LogFormsQuestion = 'value' | 'convert' | 'decimal'

/** Precalculus Unit 3. Expand or condense one logarithm, one checked line at a time. */
export type LogPropertiesQuestion = 'expand' | 'condense'

/** Precalculus Unit 3. An exponential, logarithmic, or quadratic-in-form equation. */
export type ExpLogQuestion = 'exponential' | 'logarithmic' | 'quadratic'

/** Precalculus Unit 3, second half. The features of one graph, matching a graph, or an inverse. */
export type ExpLogGraphsQuestion = 'features' | 'match' | 'inverse'

/** Precalculus Unit 3, second half. Interest, half-life and decay, or continuous growth. */
export type ExpModelsQuestion = 'interest' | 'halflife' | 'growth'

/**
 * How one part of a second-half Unit 3 problem is answered and read:
 *  - interval: a domain or a range (parseSetAnswer: interval notation, an inequality, set-builder, "all real numbers");
 *  - line: an asymptote, x = a number or y = a number;
 *  - point: an exact point, (0, 13/4) or (e^2 + 3, 0);
 *  - choice: one of the listed options (increasing or decreasing; a letter A to D);
 *  - formula: an inverse function in x, checked by composing it with f;
 *  - exact: an exact value, checked with gradeLogValue;
 *  - decimal: a rounded number, checked with gradeLogValue and { decimal: { places } }.
 */
export type ExpLogPartKind = 'interval' | 'line' | 'point' | 'choice' | 'formula' | 'exact' | 'decimal'

/** A slip named on one part. The template computes it for this problem. */
export interface ExpLogPartTrap {
  id: ErrorPatternId
  /** What the slip gives, as she would type it. Never the right answer. */
  text: string
  /** exact and decimal parts: the values the slip can give (with the exact k and with the rounded k). */
  values?: number[]
  /** The sentence about her answer. It never states this problem's answer. */
  witness: string
}

/** One part of a second-half Unit 3 problem, answered and checked on its own. */
export interface ExpLogPart {
  /** 'domain', 'range', 'asymptote', 'intercept', 'behavior', 'match', 'inverse', 'answer', 'k', 'kRounded', 'follow'. */
  id: string
  kind: ExpLogPartKind
  /** Card title and box label: "Domain", "Balance". */
  label: string
  /** The part's question in one sentence, including whether it is exact or how to round. */
  ask: string
  /** Under the box. No answer a template can generate. */
  formatHint: string
  /** choice: the options, in the order shown. */
  choices?: { value: string; label: string }[]
  /** Hint rung 1: the rule, not this problem's answer. */
  nudge: string
  ruleCard: RuleCardId
  /** Hint rung 3 for this part. May state the answer. */
  reveal: string[]
  /** The answer as she would type it. */
  answerText: string
  /** decimal: places asked (0 for a whole number). */
  places?: number
  /** decimal: a dollar amount, so "$2,834.71" and "2,834.71" are read as 2834.71. */
  money?: boolean
  /** decimal: unit words she may type after the number ("years", "grams"). */
  units?: string[]
  /** exact and decimal: the right value in app syntax, for gradeLogValue. Two when two are right (the exact k or the rounded k). */
  closedForms?: string[]
  traps: ExpLogPartTrap[]
}

/** Precalculus Unit 4. Converting units, coterminal angles, the quadrant and reference angle, arcs and sectors. */
export type AngleMeasureQuestion = 'convert' | 'coterminal' | 'reference' | 'arc'

/**
 * Precalculus Unit 4. An exact value at a special angle, the ratios of a point on the terminal side, one value and
 * where θ is (then the other functions), or every angle in one turn where a function has a special value.
 */
export type UnitCircleQuestion = 'exact' | 'point' | 'given' | 'solve'

/**
 * Precalculus Unit 4, second half. The six ratios from two sides (the third side first), the special right triangles,
 * a side from an acute angle and a side, an acute angle from two sides; word problems with angles of elevation and
 * depression.
 */
export type RightTriangleQuestion = 'ratios' | 'special' | 'side' | 'angle'

/**
 * How one part of a trig problem is answered and read (engine/trig's reader and grader):
 *  - angle: an exact angle, in degrees (a number, the ° optional) or in radians (a multiple of π);
 *  - value: an exact value or the word for no value: a trig value, r, an exact arc length or area (with π), a side;
 *  - decimal: a number rounded the way the problem asks;
 *  - choice: one of the listed options (where the terminal side lies);
 *  - angles: every angle in one turn, a list with commas in any order (engine/trig gradeAngleList).
 */
export type TrigPartKind = 'angle' | 'value' | 'decimal' | 'choice' | 'angles'

/** What the core's grader checks for a part. Exact values are kept as she would type them and read back exactly. */
export type TrigPartCheck =
  /** `deg` is the angle in degrees as a fraction ("150", "45/2"); `unit` is the unit the answer is asked in. */
  | { kind: 'angle'; unit: 'deg' | 'rad'; deg: string }
  /** `value` as typed ("√3/2", "-2", "4π", "undefined"); `fn` the function the box is for; `units` words after it. */
  | { kind: 'value'; value: string; fn?: 'sin' | 'cos' | 'tan' | 'csc' | 'sec' | 'cot'; units?: string[] }
  | { kind: 'decimal'; value: number; places: number; unit?: 'deg' | 'rad'; units?: string[] }
  | { kind: 'choice' }
  /**
   * Every θ in one turn with fn(θ) = value: `degs` the answers in degrees ("240", "300"), `unit` the unit asked,
   * `value` as typed ("-√3/2"). A trap's `text` is the whole list she would type ("60, 120").
   */
  | { kind: 'angles'; unit: 'deg' | 'rad'; degs: string[]; fn: 'sin' | 'cos' | 'tan' | 'csc' | 'sec' | 'cot'; value: string }

/** A slip named on one part, computed by the core for this problem. */
export interface TrigPartTrap {
  id: ErrorPatternId
  /** What the slip gives, as she would type it (a choice's value on a choice part). Never the right answer. */
  text: string
  /** decimal parts: the slip's value before rounding. */
  value?: number
  /** The sentence about her answer. It never states this problem's answer. */
  witness: string
}

/**
 * One part of a trig problem, answered and checked on its own. Text fields marked "math" may hold KaTeX between
 * dollar signs ("Find the reference angle of $\frac{7\pi}{6}$."); the flow draws them, and `trig/text.ts` `plain`
 * reads them as words.
 */
export interface TrigPart {
  /**
   * 'answer', 'quadrant', 'reference', 'r', 'sin', 'cos', 'tan', 'csc', 'sec', 'cot'; the second half adds 'side' (the
   * third side), 'x' and 'y' (lettered sides, or the missing coordinate), 'angle' and 'solutions' (a list of angles).
   */
  id: string
  kind: TrigPartKind
  /** Card title and box label, plain text: "Reference angle", "sin θ". */
  label: string
  /** The question (math). */
  ask: string
  /** Under the box, plain text. No answer a template can generate. */
  formatHint: string
  /** choice: the options, in the order shown. */
  choices?: { value: string; label: string }[]
  /** Hint rung 1 (math): the rule, not this problem's answer. */
  nudge: string
  ruleCard: RuleCardId
  /** Hint rung 3 and the worked lines of this part (math). May state the answer. */
  reveal: string[]
  /** The answer as she would type it (a choice's value). */
  answerText: string
  /** Other spellings of the answer that grade right: for the self-check and the leak checks. */
  forms: string[]
  check: TrigPartCheck
  /** The note for a plain wrong answer: what to look at, never the answer. */
  wrongNote: string
  traps: TrigPartTrap[]
}

/**
 * A trig figure, drawn by components/TrigFigure: the unit circle with the angle in standard position, axes with a
 * point on the terminal side, or a circle with a central angle (arc or sector). Labels are what the problem gives.
 */
export interface TrigFigureSpec {
  /**
   * circle, point, sector: the first half. triangle: a right triangle, plain or in a scene (the second half). solve:
   * the unit circle, with the answer angles drawn once the problem is done.
   */
  kind: 'circle' | 'point' | 'sector' | 'triangle' | 'solve'
  /** The angle in degrees (a decimal for a plain number of radians); negative turns clockwise. 0 for triangle and solve. */
  deg: number
  /** The angle's label, display text: "5π/6", "−225°", "2.5". Empty for triangle and solve. */
  label: string
  /** point: the point on the terminal side and its label "(−3, 4)". */
  point?: { x: number; y: number; label: string }
  /** sector: the radius label ("24 in") and whether the arc or the area is the question. */
  sector?: { radiusLabel: string; shade: 'arc' | 'area' }
  /** The reference angle (degrees) and its label. The flow draws it only once she has answered it, or finished. */
  reference?: { deg: number; label: string }
  /**
   * point: the part the point waits for. Until that part is answered (or the problem is done) the figure is the axes
   * with the quadrants numbered, because the point would show the quadrant that part asks her to work out.
   */
  waitFor?: string
  /** triangle: the right triangle. */
  triangle?: TrigTriangleSpec
  /** solve: the answer angles in degrees and their labels ("240°", "4π/3"), drawn only once the problem is done. */
  solve?: { degs: number[]; labels: string[] }
  /** Words for a screen reader and the tutor. Describes the picture, never an answer. */
  ariaLabel: string
}

/** What a right-triangle figure shows around the triangle. */
export type TrigScene = 'plain' | 'ladder' | 'ramp' | 'kite' | 'lighthouse' | 'tree'

/**
 * A right triangle, drawn by components/TrigFigure. Labels are what the problem gives (a length with its unit, an angle
 * in degrees) or a letter for what she is asked (x, θ); a side she finds is never labelled before she has found it.
 */
export interface TrigTriangleSpec {
  /** The three corners in drawing units, y up (the figure scales them to fit). */
  corners: { id: string; x: number; y: number }[]
  /** The corner with the right angle. */
  right: string
  /**
   * The labelled sides. `after`: drawn only once that part is answered (a side she finds). `dimension`: drawn on a
   * dimension line beside the side, end to end, for a length along part of a scene (up a wall, up a tower).
   */
  sides: { from: string; to: string; label: string; after?: string; dimension?: boolean }[]
  /**
   * The marked angles: at a corner, between its two sides; or `fromHorizontal`, between the horizontal through that
   * corner and the side to the far corner (an angle of depression).
   */
  angles: { at: string; label: string; fromHorizontal?: boolean }[]
  /** Tick marks on the two legs: they are equal. */
  equalLegs?: boolean
  scene: TrigScene
  /** False when the shape is not to scale (an angle drawn steeper or flatter, so the labels fit): a caption says so. */
  toScale: boolean
}

/**
 * Which geometry screen this problem is. Unit 2 adds logic and proof; Unit 3 adds parallels and polygons; Unit 4 adds
 * congruent triangles; Unit 5 adds quadrilaterals; Unit 6 adds similarity (proportions, similar polygons, similar
 * triangles, proportional parts).
 */
export type GeometryQuestion =
  | 'addition'
  | 'midpoint'
  | 'coord'
  | 'angleAddition'
  | 'bisector'
  | 'pairs'
  | 'words'
  | 'related'
  | 'truth'
  | 'laws'
  | 'reason'
  | 'algebraic'
  | 'twocolumn'
  | 'transversalPairs'
  | 'parallelSolve'
  | 'parallelConverse'
  | 'lineSlopes'
  | 'triangleAngles'
  | 'polygonAngles'
  | 'congruentParts'
  | 'congruentWhich'
  | 'congruentSolve'
  | 'isoscelesSolve'
  | 'triangleProof'
  | 'parallelogramProps'
  | 'parallelogramProve'
  | 'parallelogramCoords'
  | 'specialQuadProps'
  | 'quadClassify'
  | 'midsegment'
  | 'trapezoidKite'
  | 'proportion'
  | 'similarPolygons'
  | 'similarProve'
  | 'similarSolve'
  | 'splitter'
  | 'angleBisector'

/**
 * One checked part of a geometry problem. `x` and `result` are the Unit 1 boxes.
 * `a` through `h` are the Unit 2 parts (a related statement, a proof row, …).
 */
export type GeometryStageId = 'x' | 'result' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'

/** Periodic-table property she ranks. Metallic character has no measured column. */
export type PtProperty = 'radius' | 'ionization' | 'electronegativity' | 'metallic'

/** Which end of a ranking comes first. */
export type PtDirection = 'increasing' | 'decreasing'

/** The reason a trend comparison happens. The wording she picks lives with the periodic module. */
export type PtWhyReason = 'protons' | 'shells' | 'shielding'

/** One checked part of a periodic-table problem. */
export type PtStageId = 'a' | 'b' | 'c' | 'd' | 'e'

/**
 * How to recompute one part from the tables. The grader uses this. The solve-again test does not:
 * it reads the prompt and looks the value up on its own.
 */
export type PtCheck =
  | { kind: 'period'; z: number }
  | { kind: 'group'; z: number }
  | { kind: 'block'; z: number }
  | { kind: 'class'; z: number }
  | { kind: 'family'; z: number }
  | { kind: 'valence'; z: number }
  /** Valence electrons of a main-group column. Group 18 means 8, and the prompt excludes helium. */
  | { kind: 'valence-group'; group: number }
  | { kind: 'config-valence'; config: string }
  | { kind: 'config-block'; config: string }
  | { kind: 'config-period'; config: string }
  | { kind: 'rank'; property: PtProperty; direction: PtDirection; zs: number[] }
  | { kind: 'larger'; z: number; charge: number }
  /** Isoelectronic ions. `ions` is the set; radius order follows nuclear charge. */
  | { kind: 'iso'; direction: PtDirection; ions: { z: number; charge: number }[] }
  | { kind: 'why'; reason: PtWhyReason }

/** Which complex-number screen this problem is. */
export type ComplexNumsQuestion = 'arith' | 'divide' | 'powers' | 'quadratic' | 'zeros'

/** One checked part of a complex-number problem. */
export type ComplexNumsStageId = 'answer'

/** Which sign-chart screen this problem is. */
export type SignChartsQuestion = 'poly' | 'rational' | 'chart'

/** One checked part of a sign-chart problem. */
export type SignChartsStageId = 'critical' | 'signs' | 'solution'

/** Comparison on a sign-chart inequality, app syntax. */
export type SignChartsOp = '>' | '>=' | '<' | '<='

/** Which rational-function screen this problem is. */
export type RationalFnsQuestion = 'features' | 'asymptote' | 'equation'

/** One checked part of a rational-function problem. */
export type RationalFnsStageId = 'domain' | 'va' | 'holes' | 'asymptote' | 'xint' | 'yint' | 'solution'

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
       * Piecewise evaluation, a graph reading, domain and range, continuity, writing a piecewise
       * function, or an average rate of change (precalculus). Evaluate and rate grade with
       * `gradePiecewiseValue` or `gradeAverageRate`. A value may be "undefined". The later questions
       * grade in the module. `sketch` is the picture: on screen before she answers when the graph is
       * the problem, and only after she finishes when it would give the answer away.
       */
      type: 'piecewiseRate'
      question: 'evaluate' | 'rate' | 'graph' | 'domain' | 'continuous' | 'write'
      pieces?: {
        formula: string
        /** App syntax, e.g. "x < 2" or "1 <= x < 4". */
        condition: string
        lo: string
        hi: string
        loClosed: boolean
        hiClosed: boolean
        /** Exact piece, so domain and range can be recomputed. Evaluate and rate omit it. */
        expr?: { kind: 'const'; c: string } | { kind: 'linear'; m: string; b: string } | { kind: 'square' } | { kind: 'abs' }
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
      /** One sentence: what the problem is. Nothing about the method or the trap. */
      prompt?: string
      /** Parts checked one at a time (graph values, domain then range, k). */
      parts?: {
        key: string
        label: string
        placeholder: string
        nudge: string
        ruleCard: RuleCardId
        reveal: string[]
        answerText: string
      }[]
      /** pw.graph: each x she reads, in order. The first is the promised trap. */
      asks?: { x: string; valueText: string; trapText?: string }[]
      /** Interval notation. */
      domainText?: string
      rangeText?: string
      /** Exact k, app syntax. */
      kText?: string
      /** Formulas still containing the letter k (continuous). */
      leftFormula?: string
      rightFormula?: string
      /** Which piece contains k. */
      kSide?: 'left' | 'right'
      /** Shared boundary, and the other boundary the wrong-boundary slip uses. */
      boundary?: string
      other?: string
      /** pw.write: one row per piece. */
      rows?: { formula: string; condition: string }[]
      /** Named slips for this problem. A slip equal to the right answer is not stored. */
      traps?: {
        id: ErrorPatternId
        text?: string
        rows?: { formula: string; condition: string }[]
        witness: string
      }[]
      /** Piecewise graph (runs and open/closed dots). Omitted when this seed is not drawn. */
      sketch?: GraphSpec
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
       * Rational functions (precalculus Unit 2). Domain, holes, asymptotes and intercepts, or one
       * asymptote, or a rational equation. Grade a part with the module's `gradeRfStage`, which
       * recomputes the answer from `f` or `equation`. Named mistakes are the `rf_` ids.
       */
      type: 'rationalFns'
      question: RationalFnsQuestion
      /** The function, app syntax. Empty when `question` is `equation`. */
      f: string
      /** The equation, app syntax. Empty unless `question` is `equation`. */
      equation: string
      /** The question in one line. Says what to find and nothing about the method or the trap. */
      prompt: string
      stages: {
        id: RationalFnsStageId
        /** Hint rung 1 for this part (the rule, not this problem's answer). */
        nudge: string
        ruleCard: RuleCardId
        /** Hint rung 3 for this part. */
        reveal: string[]
      }[]
      expectedDisplay: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      reveal: string[]
      /** The named mistake this seed promises (an `rf_` id). */
      trap: ErrorPatternId
      trapStage: RationalFnsStageId
      /** What that slip produces, in the form she would type. Never the right answer. */
      trapAnswer: string
      /**
       * The graph of f, or of the two sides of an equation. NOT on `instance.graph`: that panel can be
       * opened before she finishes. The flow shows this one only after the problem is complete.
       */
      graph: GraphSpec
    }
  | {
      /**
       * Polynomial and rational inequalities (precalculus Unit 2), solved with a sign chart.
       * Grade a part with the module's `gradeScStage`, which recomputes the chart from `left`, `op`, and
       * `right`. Named mistakes are the `sc_` ids. Denominator zeros are never in the solution.
       */
      type: 'signCharts'
      question: SignChartsQuestion
      /** The inequality, app syntax: "left op right". */
      inequality: string
      left: string
      right: string
      op: SignChartsOp
      /** The question in one line. Says what to find and nothing about the method or the trap. */
      prompt: string
      /** Critical numbers, least to greatest, or "none". */
      criticalText: string
      /** One sign per interval, left to right: "+, -, +". */
      signsText: string
      /** The open intervals between the critical numbers, left to right, app syntax. */
      intervals: string[]
      /** The solution set, interval notation. "no solution" when there is none. */
      solutionText: string
      stages: {
        id: SignChartsStageId
        /** Hint rung 1 for this part (the rule, not this problem's answer). */
        nudge: string
        ruleCard: RuleCardId
        /** Hint rung 3 for this part. */
        reveal: string[]
      }[]
      expectedDisplay: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      reveal: string[]
      /** The named mistake this seed promises (an `sc_` id). */
      trap: ErrorPatternId
      trapStage: SignChartsStageId
      /** What that slip produces, in the form she would type. Never the right answer. */
      trapAnswer: string
      /**
       * The graph of the expression moved to one side, with the solution marked on the x-axis.
       * NOT on `instance.graph`: that panel can be opened before she finishes. The flow shows this
       * one only after the problem is complete.
       */
      graph: GraphSpec
    }
  | {
      /**
       * Complex numbers (precalculus Unit 2). Arithmetic, division, powers of i and square roots of
       * negatives, a quadratic with a negative discriminant, or the zeros of a real polynomial given one
       * complex zero. Grade a part with the module's `gradeCxStage`. Named mistakes are the `cx_` ids.
       */
      type: 'complexNums'
      question: ComplexNumsQuestion
      /** The expression or equation, app syntax. Empty when `question` is `zeros`. */
      expression: string
      /** f(x) in app syntax. Set when `question` is `zeros`. */
      f: string
      /** The given complex zero, app syntax. Set when `question` is `zeros`. */
      givenZero: string
      /** The question in one line. Says what to find and nothing about the method or the trap. */
      prompt: string
      stages: {
        id: ComplexNumsStageId
        /** Hint rung 1 for this part (the rule, not this problem's answer). */
        nudge: string
        ruleCard: RuleCardId
        /** Hint rung 3 for this part. */
        reveal: string[]
      }[]
      expectedDisplay: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      reveal: string[]
      /** The named mistake this seed promises (a `cx_` id). */
      trap: ErrorPatternId
      trapStage: ComplexNumsStageId
      /** What that slip produces, in the form she would type. Never the right answer. */
      trapAnswer: string
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
      /**
       * Honors geometry. Unit 1: a figure plus one or two number or point parts.
       * Unit 2: choices or a reason from the bank, one part at a time. A figure is shown when it has points.
       * Grade a part with `gradeGeoStage`. Named mistakes are the `geo_` ids.
       * A number equal to the answer but not in simplest radical form is not an attempt.
       * A Unit 2 mistake is whatever choice she picked, exactly.
       */
      type: 'geometry'
      question: GeometryQuestion
      /** What the problem is. No method and no trap. */
      prompt: string
      figure: GeoFigureSpec
      /** Algebra lines printed above the parts. The lines are given; the reasons are the answers. */
      lines?: string[]
      stages: {
        id: GeometryStageId
        kind: 'number' | 'point' | 'choice' | 'reason' | 'line'
        /** An angle measure, where a degree sign is welcome. Anywhere else a degree sign is refused. */
        unit?: 'deg'
        /** A vertical line has no slope number. The word "undefined" is an answer only when this is set. */
        allowUndefined?: boolean
        /**
         * A ratio (a scale factor, a ratio of two lengths): "2:3" and "2 to 3" are read as 2/3, as a textbook writes
         * them. Off unless set.
         */
        ratio?: boolean
        /** A length measured in this unit (a story problem): "12 ft" or "12 feet" is read as 12. Off unless set. */
        lengthUnit?: 'ft' | 'm'
        /** Box label, e.g. "x", "AB", "Reason for line 2". */
        label: string
        /** Line under the box or the choices. Never this part's answer. */
        hint: string
        /**
         * Number or point: what a correct answer looks like typed.
         * Choice or reason: the id of the correct choice (a statement id, or a reason id).
         */
        answerText: string
        /**
         * Reason parts only: other reasons that are also correct for this row. Books name some proof
         * steps differently (many write substitution where others write transitive), so a pick in this
         * list grades correct, the same as `answerText`. `answerText` stays the reason the answer key
         * shows first. Absent means only `answerText` is correct.
         */
        accept?: string[]
        /** Printed above a Unit 2 picker: the given half of a proof row. */
        note?: string
        /**
         * Choice parts only. `trap` is set when that pick is a named mistake.
         * Reason parts use the shared reason bank instead of a short list.
         */
        choices?: { id: string; text: string; trap?: ErrorPatternId; witness?: string }[]
        nudge: string
        ruleCard: RuleCardId
        reveal: string[]
        /** Slips on this part, in detection order. `text` is the typed value or the choice id. */
        traps: { id: ErrorPatternId; text: string; witness: string }[]
      }[]
      /** Lengths that must stay positive, for the generator's own check. */
      lengths: number[]
      /** Angle measures that must stay strictly between 0 and 180. */
      angles: number[]
      expectedDisplay: string
      reveal: string[]
      ruleCards: RuleCardId[]
      /** The named mistake this seed promises (a `geo_` id). */
      trap: ErrorPatternId
      trapStage: GeometryStageId
      /** What that slip produces. Never the right answer. */
      trapAnswer: string
    }
  | {
      /**
       * The periodic table (chemistry, CK-12 chapter 6). Parts are checked one at a time.
       * Grade a part with `gradePtStage`. Named mistakes are the `pt_` ids.
       * A ranking is graded from the trend table, not from the rule alone.
       */
      type: 'periodic'
      question: 'locate' | 'valence' | 'trends' | 'ions' | 'why'
      /** What the problem is. No method and no trap. */
      prompt: string
      stages: {
        id: PtStageId
        kind: 'text' | 'choice'
        /** Box or choice legend, e.g. "Period", "Order". */
        label: string
        /** Line under the box or the choices. Never this part's answer. */
        hint: string
        /** What a correct answer looks like. Choice parts use the choice id. */
        answerText: string
        /** Other spellings that grade correct, such as "no group" for an ungrouped element. */
        accept?: string[]
        /** Choice parts only. `trap` is set when that pick is a named mistake. */
        choices?: { id: string; text: string; trap?: ErrorPatternId; witness?: string }[]
        nudge: string
        ruleCard: RuleCardId
        /** Hint rung 3. May state this part's answer. */
        reveal: string[]
        /** Slips on this part, in detection order. `text` is the typed value or the choice id. */
        traps: { id: ErrorPatternId; text: string; witness: string }[]
        check: PtCheck
      }[]
      expectedDisplay: string
      reveal: string[]
      ruleCards: RuleCardId[]
      /** The named mistake this seed promises, when one is possible. */
      trap?: ErrorPatternId
      trapStage?: PtStageId
      /** What that slip produces. Never the right answer. */
      trapAnswer?: string
    }
  | {
      /**
       * Chemical nomenclature (chemistry, CK-12 chapter 7): single ions, ionic compounds, binary molecular
       * compounds, acids and hydrates, named from a formula or written from a name, and classified. Parts are
       * checked one at a time with the module's `gradeNmStage`, which calls the engine's grader named by the
       * part's `check`. Named mistakes are the `nm_` ids; what the screen shows for a grade comes from `nmShown`.
       */
      type: 'nomenclature'
      question: NomenclatureQuestion
      /** How the problem is given: a formula to name, a name to write, two ions, the anion of an acid, or a formula to classify. */
      given: 'formula' | 'name' | 'ions' | 'anion' | 'classify'
      /**
       * What is printed, plain app text: 'Fe2(SO4)3', 'iron(III) sulfate', 'SO4^2-', 'sulfate', 'NO2^-' (the anion of
       * an acid). Two ions: the cation and the anion joined by ' and ' ('Fe^3+ and SO4^2-', or by name).
       */
      problem: string
      /** The two ions of an `ions` problem, as printed (app text or names). */
      ions?: { cation: string; anion: string }
      /** What the problem says, display text: 'Name the ionic compound Fe₂(SO₄)₃.' No method and no trap. */
      prompt: string
      /** The same prompt in pieces: words, and formulas (app text) the screen draws with real subscripts. */
      promptParts: NmPromptPart[]
      stages: {
        id: NmStageId
        /** What she enters: a compound's formula, an ion with its charge, a name in words, or one of the four kinds. */
        kind: 'formula' | 'ion' | 'name' | 'choice'
        part: NmPartKind
        /** Box or choice legend, e.g. "Name", "Formula", "Cation". */
        label: string
        /** Line under the box or the choices. Never an answer of this kind of part. */
        hint: string
        /** The answer, plain app text: 'Fe2(SO4)3', 'iron(III) sulfate', 'SO4^2-', 'HCl(aq)', 'ionic'. */
        answerText: string
        /** The answer, display text: 'Fe₂(SO₄)₃', 'SO₄²⁻'. */
        answerDisplay: string
        /** Every other form the grader accepts, plain app text: 'HCl' for 'HCl(aq)', 'nickel chloride', 'sodium bicarbonate'. */
        accept: string[]
        /** Choice parts only (the four kinds). `trap` is set when that pick is a named mistake. */
        choices?: { id: string; text: string; trap?: ErrorPatternId; witness?: string }[]
        /** Hint rung 1. Never this part's answer. */
        nudge: string
        ruleCard: RuleCardId
        /** Hint rung 3: the engine's worked explanation of this part. Reveals the answer. */
        reveal: string[]
        /** The engine's candidates for this part (`…Mistakes`): what each slip produces, in the graders' order. */
        traps: { id: ErrorPatternId; text: string; witness: string }[]
        check: NmCheck
      }[]
      /** Every part's answer, pretty, for the tutor: 'Name: iron(III) sulfate'. */
      expectedDisplay: string
      /** The after-finish explanation: every part's steps. Reveals the answer. */
      reveal: string[]
      ruleCards: RuleCardId[]
      /** The named mistake this seed promises (one of the engine's candidates for the part), when one is possible. */
      trap?: ErrorPatternId
      trapStage?: NmStageId
      /** What that slip produces, as she would type it. Never the right answer. */
      trapAnswer?: string
    }
  | {
      /**
       * Logarithms and exponential form (precalculus Unit 3). One number, or one rewritten equation.
       * Grade with `gradeLogValue` or `gradeConvertForm`. Named mistakes are the `log_` ids.
       */
      type: 'logForms'
      question: LogFormsQuestion
      /** The expression or equation, app syntax. */
      problem: string
      /** What to find. No method and no trap. */
      prompt: string
      /** Exact text, or the rounded decimal when `places` is set. */
      answerText: string
      /** Set only when the problem asks for a rounded decimal. */
      places?: number
      /** Under the box. No number this template can generate. */
      formatHint: string
      stages: {
        id: 'answer'
        nudge: string
        ruleCard: RuleCardId
        reveal: string[]
      }[]
      expectedDisplay: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      /** Hint rung 3 and the worked solution. May state the answer. */
      reveal: string[]
      trap: ErrorPatternId
      /** What that slip produces. Never the right answer. */
      trapAnswer: string
    }
  | {
      /**
       * Properties of logarithms (precalculus Unit 3). One checked line at a time.
       * Grade a line with `checkLogRewrite` (`assumePositive`). Finished when the line is expanded
       * or a single log and still equal to the start. Named mistakes are the `log_` ids.
       */
      type: 'logProperties'
      question: LogPropertiesQuestion
      /** The starting expression, app syntax. */
      expr: string
      vars: VarName[]
      prompt: string
      /** Lines after the start, ending at the finished form. */
      path: string[]
      answerText: string
      formatHint: string
      expectedDisplay: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      reveal: string[]
      /**
       * The named slip this seed promises. Every template sets it; her own problem (content/own) leaves it out when
       * the engine names no slip for it cheaply (never a made-up one).
       */
      trap?: ErrorPatternId
      /** A wrong next line from the start. */
      trapAnswer?: string
    }
  | {
      /**
       * Exponential and logarithmic equations (precalculus Unit 3). One checked line at a time
       * (`checkLogStep`, with the original equation), then a final answer (`gradeLogEquation`).
       * Named mistakes are the `log_` ids. `log_check_answers` is a note, not a mistake.
       */
      type: 'expLogEquations'
      question: ExpLogQuestion
      equation: string
      /** Set when the final answer is a rounded decimal. */
      places?: number
      prompt: string
      /** Lines after the equation, the textbook path. */
      path: string[]
      answerText: string
      /** Spellings `gradeLogEquation` accepts for this problem, including `answerText`. */
      accept: string[]
      formatHint: string
      expectedDisplay: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      /** `analyzeLogEquation(...).explanation`, shown after she finishes or on hint rung 3. */
      reveal: string[]
      /**
       * The named slip this seed promises. Every template sets it; her own problem (content/own) leaves it out when
       * the engine's analysis names none for it (never a made-up one).
       */
      trap?: ErrorPatternId
      /** The wrong final answer that slip produces. */
      trapAnswer?: string
      explanation: string[]
    }
  | {
      /**
       * Graphs of exponential and logarithmic functions (precalculus Unit 3, second half): a·b^(x − h) + k or
       * a·log_b(x − h) + k.
       *  - features: domain, range, asymptote, intercept, increasing or decreasing, one part at a time;
       *  - match: four candidate graphs (or four equations for one graph) that differ by the sign of a, the base
       *    above or below 1, and the direction of a shift;
       *  - inverse: f⁻¹(x), checked by composing it with f on the range of f, never by its spelling.
       * Grade a part with the module's `gradeEgPart`. Named mistakes are the exp_ graph ids (and log_convert_dropped).
       */
      type: 'expLogGraphs'
      question: ExpLogGraphsQuestion
      family: 'exponential' | 'logarithmic'
      /** f for an exponential, g for a log. */
      fnName: 'f' | 'g'
      /** The function, app syntax: "2 * 3^(x - 1) - 4", "-log_(1/2)(x + 3) + 2". */
      f: string
      /** KaTeX of "f(x) = …", built from a, the base, h and k (not from the parser). */
      tex: string
      a: number
      /** The base, app syntax: "2", "1/2", "3/2", "e", "10". */
      base: string
      h: number
      k: number
      /** The question in one line. Says what to find and nothing about the method or the trap. */
      prompt: string
      /** match: pick one of four graphs for the equation, or one of four equations for the graph. */
      matchMode?: 'graph' | 'equation'
      /** match: the four candidates in letter order. Their graphs are part of the question. */
      candidates?: { letter: string; f: string; tex: string; graph: GraphSpec }[]
      stages: ExpLogPart[]
      expectedDisplay: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      /** Hint rung 3 and the worked answer. May state the answer. */
      reveal: string[]
      /** The named mistake this seed promises. */
      trap: ErrorPatternId
      /** The part it is promised on. */
      trapStage: string
      /** What that slip gives, as she would type it. Never the right answer. */
      trapAnswer: string
      /**
       * features and inverse: the graph of f (and of f⁻¹), shown only after she finishes. match in equation mode:
       * the graph she reads, which is part of the question. NOT on `instance.graph`, which can be opened early.
       */
      graph: GraphSpec
    }
  | {
      /**
       * Exponential growth and decay word problems (precalculus Unit 3, second half): compound and continuous
       * interest, half-life and carbon-14 dating, continuous growth from two counts. Every number is checked with
       * gradeLogValue (exact, or with { decimal }) through the module's `gradeEmPart`; the named mistakes are the
       * exp_ model ids (and log_ln_confused, log_quotient_as_quotient for k), computed for this problem.
       */
      type: 'expModels'
      question: ExpModelsQuestion
      /** The textbook sentences, ending with how to round. */
      prompt: string
      /** KaTeX of the model when the problem itself states it ("P = P_0e^{kt}"). */
      modelTex?: string
      stages: ExpLogPart[]
      expectedDisplay: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      reveal: string[]
      trap: ErrorPatternId
      trapStage: string
      trapAnswer: string
    }
  | {
      /**
       * Optimization with quadratics (precalculus Unit 2, after completing the square), the worksheet's way: the
       * secondary equation (the condition), the primary equation (what is made largest or smallest), the final
       * equation in one variable, the value that gives the extreme (from the vertex), the other variable, and the
       * extreme value. Grade a part with the module's `gradeOptPart` (engine/optim). Named mistakes are the opt_ ids.
       */
      type: 'optimization'
      question: OptimizationQuestion
      /** The problem in words (math). Says what to find; nothing about the method or the trap. */
      prompt: string
      /** The quantity's letter: A (area), R (revenue), P (product), S (sum of squares). */
      quantity: 'A' | 'P' | 'R' | 'S'
      goal: 'max' | 'min'
      /** The fence problems' figure; the number and price problems have none. */
      figure?: OptFigureSpec
      /** Where x and y live: equations are compared at points inside it. */
      domain: { x: [number, number]; y: [number, number] }
      /** The problem's units, for reading her numbers. */
      units: { lengthUnit?: 'ft' | 'm' | 'yd'; money?: boolean; count?: string[] }
      /** The six parts, with the final equation in x. */
      stages: OptPart[]
      /** Parts 4 and 5 when her final equation is in y: the value of y first, then x. */
      yStages: OptPart[]
      expectedDisplay: string
      nudge: string
      ruleCard: RuleCardId
      ruleCards: RuleCardId[]
      /** Every part's worked lines (math), the final equation in x. May state the answers. */
      reveal: string[]
      /** The named mistake this seed promises, when one is possible. */
      trap?: ErrorPatternId
      /** The part it is promised on. */
      trapStage?: string
      /** What that slip gives, as she would type it. Never the right answer. */
      trapAnswer?: string
    }
  | ({
      /**
       * Angles and radian measure (precalculus Unit 4): converting between degrees and radians (exact, or rounded),
       * the coterminal angle in one turn, where the terminal side lies and the reference angle, arc length and sector
       * area. Grade a part with the module's `gradeAmPart` (engine/trig). Named mistakes are the trig_ ids.
       */
      type: 'angleMeasure'
      question: AngleMeasureQuestion
    } & TrigAnswerFields)
  | ({
      /**
       * Right triangle trigonometry (precalculus Unit 4, second half): the six ratios of an acute angle from two sides
       * (the third side first), the special right triangles, a side from an acute angle and a side and an angle from
       * two sides on the calculator (DEGREE mode, rounded as asked), with word problems for angles of elevation and
       * depression. Grade a part with the module's `gradeRtPart` (engine/trig). Named mistakes are the trig_ ids.
       */
      type: 'rightTriangle'
      question: RightTriangleQuestion
    } & TrigAnswerFields)
  | ({
      /**
       * The unit circle and the trig functions of any angle (precalculus Unit 4): the exact value of one of the six
       * functions at a special angle, or r and the ratios of a point on the terminal side. Grade a part with the
       * module's `gradeUcPart` (engine/trig). Named mistakes are the trig_ ids.
       */
      type: 'unitCircle'
      question: UnitCircleQuestion
    } & TrigAnswerFields)
  | {
      type: 'drill'
      question: 'which_property' | 'legal_or_illegal'
      verdict: 'legal' | 'illegal'
      chip?: ChipId
      patternId?: ErrorPatternId
      lesson: string
    }

/** What both trig arms of `AnswerSpec` carry. */
export interface TrigAnswerFields {
  /** The problem in one or two sentences (math). No method and no trap. */
  prompt: string
  figure: TrigFigureSpec
  stages: TrigPart[]
  expectedDisplay: string
  nudge: string
  ruleCard: RuleCardId
  ruleCards: RuleCardId[]
  /** Every part's worked lines (math). May state the answers. */
  reveal: string[]
  /** The named mistake this seed promises, when one is possible (a quadrantal angle's location has none). */
  trap?: ErrorPatternId
  /** The part it is promised on. */
  trapStage?: string
  /** What that slip gives, as she would type it. Never the right answer. */
  trapAnswer?: string
}

/** The three trig arms of `AnswerSpec`. */
export type AngleMeasureAnswer = Extract<AnswerSpec, { type: 'angleMeasure' }>
export type RightTriangleAnswer = Extract<AnswerSpec, { type: 'rightTriangle' }>
export type UnitCircleAnswer = Extract<AnswerSpec, { type: 'unitCircle' }>
export type TrigAnswer = AngleMeasureAnswer | RightTriangleAnswer | UnitCircleAnswer

/** The optimization arm of `AnswerSpec`, named so the flow and the generators share it. */
export type OptimizationAnswer = Extract<AnswerSpec, { type: 'optimization' }>

/** The geometry arm of `AnswerSpec`, named so the flow and the generators share it. */
export type GeometryAnswer = Extract<AnswerSpec, { type: 'geometry' }>

/** The periodic-table arm of `AnswerSpec`, named so the flow and the generators share it. */
export type PeriodicAnswer = Extract<AnswerSpec, { type: 'periodic' }>

/** The exponential/log graphs arm of `AnswerSpec`. */
export type ExpLogGraphsAnswer = Extract<AnswerSpec, { type: 'expLogGraphs' }>

/** The exponential growth/decay models arm of `AnswerSpec`. */
export type ExpModelsAnswer = Extract<AnswerSpec, { type: 'expModels' }>
/** The chemical-nomenclature arm of `AnswerSpec` (chapter 7), named so the flow and the generators share it. */
export type NomenclatureAnswer = Extract<AnswerSpec, { type: 'nomenclature' }>

/** One part of a nomenclature problem. */
export type NmStage = NomenclatureAnswer['stages'][number]

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
  /**
   * Her own problem ("Check my own problem", content/own): her statement as she typed it (app syntax), which the
   * route `/own/<module>/<template>/<statement>` carries. The flows treat the instance like a generated one; the
   * frame says it is hers, and her events are marked `own` (never mastery, rings, the path or a squash). Absent on
   * every generated problem.
   */
  own?: string
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
