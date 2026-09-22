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
one-agent module costs 440-520k Claude tokens; an engine core alone (domain, range and composition,
exact arithmetic, 164 tests) cost about 460k. The saving comes from Grok building the screens and
templates, not from the core being small; keep cores narrow. Running two builds at once is fine only when they touch different
folders; shared registration files (`src/shared/types.ts`, `catalog.ts`, `Problem.tsx`,
`modules/index.ts`) have one owner at a time.

## Pre-Calculus

| Ship by | Module | Engine core (Claude) | Content + screen (Grok) |
|---|---|---|---|
| done | Number line, inequalities, even/odd, inverses, properties drill | - | - |
| Sep 22 | Difference quotient | built by one Claude agent (h variable, dq_ mistakes) | - |
| Sep 24 | Reading a graph (increasing, decreasing, extrema) | - | whole module; reuses interval grading |
| Sep 28 | Domain & range, composition | domain from a formula as an exact set, composition and composite domain, mistake candidates | templates, flow, catalog |
| Oct 5 | Transformations, piecewise, average rate of change | point and equation mapping for a·f(b(x-h))+k | templates, graphs, flow; rate of change reuses the DQ engine |
| Oct 12 | Unit 1 test review | - | mixed review set across Unit 1 modules |
| Oct 19 | Completing the square, synthetic division | synthetic-division table checker (remainder and factor theorems) | templates, table UI |
| Oct 26 | Zeros, multiplicity, end behavior | - | graph-to-equation templates (rational-root candidates need a small core) |
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
| Oct 12 | 5 Electrons: light (c = λν, E = hν), electron configurations | configuration checker: 4s/3d order, Cr/Cu exceptions, ions lose 4s first | light templates on the sig-fig engine |
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
