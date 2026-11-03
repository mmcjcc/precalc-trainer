# Worked-example parity — geometry, trig Units 4–5, chemistry ch. 3–5

Branch `examples-parity` in `C:\work\expar`. Uncommitted for review. The "Example — see one like it" panel already covered precalc Units 1–3 and 6 and chemistry ch. 6–7. This build adds every clean template below, and draws the sibling's figure in the gold statement card when the problem is a figure.

## Covered

All of these are parts templates (`COVERED_PARTS_TEMPLATES`). None of these modules walks `nextStep`.

Geometry, one `answer.type === 'geometry'` case (45):

- geoSegments: `gs.addition`, `gs.midpoint`, `gs.coord`
- geoAngles: `ga.addition`, `ga.bisector`, `ga.pairs`
- geoLogic: `gl.related`, `gl.truth`, `gl.laws`
- geoProof: `gp.reason`, `gp.algebraic`, `gp.twocolumn`
- geoParallel: `gl3.solve`, `gl3.converse`, `gl3.slopes`
- geoPolygonAngles: `gpa.triangle`, `gpa.polygon`
- geoCongruence: `gc.parts`, `gc.solve`
- geoIsosceles: `gi.solve`
- geoTriangleProofs: `gt.twocolumn`
- geoParallelograms: `gq.props`, `gq.prove`, `gq.coords`
- geoSpecialQuads: `gs.props`, `gs.classify`
- geoTrapezoids: `gz.midseg`, `gz.isosceles`
- geoRatios: `gr.proportion`, `gr.polygons`
- geoSimilarTriangles: `gt.prove`, `gt.solve`
- geoProportionalParts: `gp.splitter`, `gp.bisector`
- geoRightSimilar: `rs.mean`, `rs.altitude`
- geoPythagorean: `py.side`, `py.classify`, `py.apply`
- geoSpecialRight: `sp.special`
- geoTrigRatios: `tr.ratio`, `tr.side`, `tr.angle`
- geoElevDepress: `el.story`, `el.two`

Precalc trig, one case over the six answer types that share `TrigAnswerFields` (19):

- angleMeasure: `am.convert`, `am.coterminal`, `am.reference`, `am.arc`
- rightTriangle: `rt.ratios`, `rt.special`, `rt.side`, `rt.angle`
- unitCircle: `uc.exact`, `uc.point`, `uc.given`, `uc.solve`
- sinusoids: `sg.features`, `sg.equation`, `sg.model`
- otherTrigGraphs: `og.features`, `og.match`
- inverseTrig: `it.evaluate`, `it.compose`

Chemistry ch. 3–5, one case per answer type (26):

- sigFigs: `sf.count`, `sf.round`, `sf.muldiv`, `sf.addsub`, `sf.mixed`, `sf.sci`
- atoms: `atom.particles`, `atom.notation`, `atom.avgmass`, `atom.abundance`
- electrons: `light.freq`, `light.wavelength`, `light.energy`, `light.spectrum`, `ec.full`, `ec.shorthand`, `ec.ion`, `ec.identify`, `ec.valence`, `ec.diagram`
- quantum: `qn.meaning`, `qn.allowed`, `qn.count`, `qn.name`, `qn.shapes`, `qn.pauli`

Already-covered `opt.wall` and `opt.pens` now draw `OptFigure` in that same card. `qn.shapes` draws `OrbitalFigure` when the sibling's answer carries a figure. `trigIdentities` draws `TrigFigure` the same way when its figure is not `kind: 'none'`.

## Excluded

Three geometry templates are not on the allow-list. Putting one on the list would make `buildWorkedExample` return null for every seed: a sibling is rejected when the statement matches, or when both answers carry the same drawn figure. Check by generating two seeds and comparing `statementText` and `JSON.stringify(answer.figure)`.

- `gc.which` — statement identical across seeds. `WHICH_PROMPT` in `src/content/modules/geometry/unit4Make.ts` is the only statement ("Which postulate or theorem, if any, proves the triangles congruent?"). The marks that make one problem different from the next live only in the figure, so an example that passed the statement guard would still be her sentence.
- `ga.words` — stage would be fine, and the statements do differ (the numbers are in the sentence), but every seed draws the same unmarked angle (`plainAngle()` in `src/content/modules/geometry/figures.ts`). Both answers carry that figure, so the same-figure guard rejects every sibling.
- `gl3.pairs` — same casualty. `drawTransversalPairs` always draws `transversalFigure(64, 18, false, …)`, so the diagram JSON is identical. Which two numbered angles are asked is only in the statement.

## Decisions

- A figure counts for the sibling guard only when it is drawn. An empty geometry `points` list and a trig figure of `kind: 'none'` are not drawn (`TrigFigure` returns null), so they are not compared. Comparing them would reject siblings whose statements already differ (a geometric mean, a classify-from-three-sides problem, a graph feature with no picture). Optimization and quantum count when `answer.figure` is present.
- The gold card draws the sibling's figure after the statement (and after the extra prompt line, when that line is not the statement again). Wrapper is `data-example-figure=""`. `TrigFigure` gets `answered={[]}` and no `done` and no `showReference`. `showAngle` is false when any stage id is `quadrant`, which is the problem's own initial state: a drawn angle would give the quadrant away. Other trig figures (the given angle on a conversion, a triangle, a graph) still show what the problem shows at the start.
- Geometry `answer.lines`, when non-empty, is `given` on the parts example and rendered between the statement card and the parts as a numbered list labeled "Given work". The lines are the given algebra; the reasons are the part answers. `answer.prompt` is the statement, so the existing prompt dedup still hides a repeated sentence.
- Choice and reason answers use the module's own student-facing text: geometry via `stageDisplay` (choice text, or the reason name), trig via `{value, label}`, quantum via `{id, text}`.
- Trig part fields that can hold `$...$` go through `plain` from `src/content/modules/trig/text.ts`. The shared loops then reject a label, ask, answer, why, or detail that still contains a backslash command or a `$`.
- Optimization text goes through that module's own `plain` (so `\frac` and `\$20` become words), then any leftover `$` is removed, because the new assertion forbids a dollar sign. A price reads as `20`, not `$20`. Exponential-model parts are not run through that plain helper: one leading `$` in "The balance is $20,102.12" would treat the rest of the sentence as TeX. Those strings only have `$` stripped, so the sentence reads "The balance is 20,102.12". The old `$` prefix on a money answer is gone for the same reason.
- Atoms are one part, the whole `expectedDisplay`, not one part per box. A neutral notation charge box is an empty string, and an empty answer drops the example. Average-mass and abundance examples put the isotope table on the extra prompt line, because the statement only names the element. Abundance rows print the mass, not the percent (that is the answer).
- Light examples put `answer.context` (the measurement) on that extra line, because the statement often just says "this light". An identify question also prints `question.display` (plain superscripts), not the KaTeX `latex`.
- `inv.rational`, `inv.mobius`, `ee.logarithmic`, and `ee.exponential` keep the 20s global timeout but their own `it` allows 180s. Under `npm test -- --maxWorkers=4`, `ee.exponential`'s 25 seeds took 24.2s, still over that default; `inv.rational` was 8.8s, `inv.mobius` 15.2s, and `ee.logarithmic` 4.0s. On the two loaded default runs the same `ee.exponential` walk was 65.1s and 61.5s. The 180s allowance stays so a loaded machine does not kill a walk that is still going. No parts template needed a longer limit.

## Verification

Builder's runs (Grok, in this worktree):

- `npm run typecheck`: exit 0 (94 s).
- Three full `npm test` runs, each failing only on timing budgets in files this change does not
  touch (the examples-parity suite ran concurrently with the chem-ptable suite on the same
  machine for the first): 30 failed / 6640 passed; 7 failed / 6663 passed; then
  `--maxWorkers=4`: 1 failed / 6669 passed, the failure being one `own.fuzz` keypad string at
  60.5 ms against a 50 ms budget — that file alone passes 15/15 in 42 s.
  `workedExample.test.ts` (161) and `WorkedExample.figures.test.tsx` (2) passed in every run.

Reviewer's independent re-run (Claude, quiet machine, 2026-11-02):

- `npm run typecheck`: exit 0.
- `npm test -- src/problem/workedExample.test.ts src/components/WorkedExample.figures.test.tsx`:
  163/163 in 54 s.
- Diff review: footprint is exactly the five allowed files; no dead branches, duplicate case
  labels, or doubled assignments.
- Browser QA on the dev server: `gp.algebraic` example shows "Given work" lines with zero
  overlap against her own lines and reason-name part answers; `gs.addition` draws the sibling's
  figure (labels differ from hers) and "Another example" steps the sibling; `am.convert` is
  plain text (no TeX commands, no `$`) with the angle figure and no reference overlay;
  `sf.round` puts the measurement context on the prompt line with the unit on the answer;
  `qn.shapes` draws the sibling's orbital.

The full suite on the merged tree is the ship gate, as always.
