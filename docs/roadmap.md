# Roadmap: staying one unit ahead of her classes

Two courses: **430 H Pre-Calculus** (prepares for AP Calculus AB; polynomial, exponential,
logarithmic and rational functions, trigonometry, analytic geometry; TI-84 required) and **chemistry
from CK-12 Chemistry - Intermediate**, taught in book order. Target: each module ships **1-2 weeks
before** her class reaches the topic. Dates are estimates; a new homework or quiz photo resets them.

## How each build is split (to spend both allowances well)

| Step | Who | Why |
|---|---|---|
| 1. Engine core: the new checking logic, exact arithmetic, the mistake detectors, their unit tests, and an API doc in `docs/progress/<topic>.md` | **Claude**, one agent | Wrong answers here are invisible to her and expensive to her grade |
| 2. Content and screen: templates, seeds, rule cards, nudges, the flow, catalog wording, Home registration, jsdom tests | **Grok** (`grok --prompt-file`, main tree, uncommitted) | Follows the existing modules; large but mechanical |
| 3. Review, browser check, commit, push, Azure roll-out | **Claude**, inline | The last line of defence before she sees it |

Data files (element tables, ion lists, unit-circle values) go to Grok with an independent test that
Claude writes from known values. Every homework or quiz photo becomes regression cases in
`src/problem/*.regression.test.ts` before any new feature.

Rule of thumb: one Claude engine core per week plus verification. Measured so far: a full
one-agent module costs 440-520k Claude tokens; an engine core alone costs 460-520k (domain, range and
composition 460k; transformations with piecewise and rate of change 520k). The saving comes from Grok building the screens and
templates, not from the core being small; keep cores narrow. Running two builds at once is fine only when they touch different
folders; shared registration files (`src/shared/types.ts`, `catalog.ts`, `Problem.tsx`,
`modules/index.ts`) have one owner at a time.

## Classes and units in the app

The app is "Math & Science Trainer". Home has a tab per class and a unit switcher inside each class;
both come from `src/content/courses.ts`. A new module is listed there under its class and unit, and a
new class (geometry: course 420 H Geometry, grade 10; no syllabus published, waiting on a worksheet
or the textbook) is one more entry in that file.

## Pre-Calculus

| Ship by | Module | Engine core (Claude) | Content + screen (Grok) |
|---|---|---|---|
| done | Number line, inequalities, even/odd, inverses, properties drill | - | - |
| Sep 22 | Difference quotient | built by one Claude agent (h variable, dq_ mistakes) | - |
| Sep 24 | Reading a graph (increasing, decreasing, extrema) | - | whole module; reuses interval grading |
| Sep 28 | Domain & range, composition | domain from a formula as an exact set, composition and composite domain, mistake candidates | templates, flow, catalog |
| done (Sep 27) | Transformations, piecewise, average rate of change | done: src/engine/transformations (22 mistakes) | done: two modules; Claude cross-check of 1,500 problems |
| done (Oct 1) | Unit 1 test review | - | done: a mixed set of 8, 12 or 20 across the Unit 1 modules; reviewed by Claude and by Gemini |
| done (Oct 2) | Completing the square, synthetic division | done (Oct 1): src/engine/polynomials (24 mistakes; API in docs/progress/polynomials-core.md) | done: modules quadratics and polyDivision, built by three Claude agents in turn (Grok's balance had run out); Claude cross-check of about 3,300 problems |
| done (Oct 2) | Zeros, multiplicity, end behavior, rational roots | done (Oct 1): same core | done: module polyZeros (zeros, end behavior, build from zeros, rational roots) |
| Nov 2 | Rational functions; polynomial and rational inequalities | asymptote and hole rules; sign-chart checker on the existing solution-set engine | templates, sign-chart UI |
| Nov 9 | Complex numbers | complex arithmetic and equivalence in the engine | templates |
| Nov 23 | Exponentials and logarithms | **fix `ln`/`log10` evaluation first**; log properties; extraneous-solution checks | templates, growth and decay word problems |
| Jan | Unit circle, radians, trig of any angle | exact-value table and its independent test | drills |
| Feb | Trig identities | identity proof flow: line-by-line equivalence already works for trig | identity bank, hints |
| Mar | Trig graphs and equations | solutions on [0, 2π) as exact sets | templates |
| Apr | Inverse trig, laws of sines and cosines | ambiguous-case (SSA) checker | templates |
| May | Conics | completing the square to standard form (reuses the step engine) | identify centre, vertices, foci |

## Chemistry (CK-12 order)

| Ship by | Chapter | Engine core (Claude) | Content + screen (Grok) |
|---|---|---|---|
| done | 3 Significant figures, 4 Atomic structure | - | periodic-table data (Grok) |
| done (Sep 27) | 5 Electrons: light (c = λν, E = hν) | - | done: light templates on the sig-fig engine; Claude cross-check of 900 answers |
| done (Oct 1) | 5 Electrons: electron configurations | done: src/engine/econfig (17 mistakes; API in docs/progress/econfig-core.md) | done: six templates on the 'electrons' module; Claude cross-check of 1,800 problems |
| Oct 26 | 6 Periodic table and trends | - | ranking templates from the element data |
| Nov 16 | 7 Nomenclature | charge balance, formula to name and back | polyatomic-ion and acid tables (with Claude's test), templates |
| Dec | 8-9 Ions, bonding | low fit for step checking; drills only | Grok |
| Jan | 10 The mole | **conversion-chain engine** (units cancel, factor orientation, sig figs at the end); reused through ch 16 | molar mass and particle templates |
| Feb | 11 Balancing equations | atom-count checker (subscripts vs coefficients) | reaction bank |
| Mar | 12 Stoichiometry | - | templates on the conversion chain (limiting reagent, percent yield) |
| Apr | 14 Gases, 16 Solutions | Kelvin check | gas-law algebra on the existing step engine; molarity and dilution on the conversion chain |
| May | 21 Acids and bases | pH figure rule (decimal places in pH = figures in [H+]) | templates |

## Open items that are not features

- iPhone check of the chemistry screens (nuclear symbols, number boxes, isotope table).
- The Progress page lists chemistry and precalculus mistakes in one table; group them by subject.
- `docs/BUILD_GUIDE.md` sections 0 and 7 predate the chemistry and difference-quotient modules.

## How Grok's work is checked

Every Grok build gets an independent cross-check written by Claude before or after it lands
(`*.crosscheck.test.ts`, and textbook anchor tests such as `src/engine/sigfigs/light.anchor.test.ts`):
the generated answers are recomputed from first principles, and the words she sees (scene labels,
descriptions) are checked against the numbers. The Sep 27 reviews caught a wrong colour label
(5.75 × 10¹⁴ Hz called orange; it is green), six other physics labels, and an explanation whose
order of operations multiplied by 10⁻⁹ instead of dividing.
