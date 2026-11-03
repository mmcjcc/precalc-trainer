# Chemistry reference panel: Periodic table tool (`chem-ptable`)

Branch `chem-ptable` in `C:\work\ptable`.

## Why

Chemistry students are given a periodic table in class and on tests. Adding a "Periodic table" tool to every chemistry problem gives students immediate access to element positions, atomic numbers, symbols, standard atomic weights (or bracketed mass numbers for radioactive elements without a standard atomic weight), periods, groups, metal/metalloid/nonmetal classifications, and taught common ion charges.

## What was built

### 1. `src/components/ptable/PeriodicTablePanel.tsx`

- **All 118 elements (`[...ELEMENTS, ...TRANSURANICS]`)**:
  - Merges `ELEMENTS` (`Z = 1..92` from `src/engine/chem/elements.ts`) and `TRANSURANICS` (`Z = 93..118` from `src/components/ptable/transuranics.ts`) without modifying either source file.
  - Uses `classOf(el)` from `src/content/modules/periodic/facts.ts` for `ELEMENTS` (`Z = 1..92`) and treats all `TRANSURANICS` (`Z = 93..118`) as `'metal'` without extending `facts.ts`.
- **Wall-chart CSS Grid**:
  - 18-column grid (`grid-cols-[repeat(18,minmax(32px,1fr))]` inside an `overflow-x-auto` container with `min-w-[612px]`) so cells remain at least 32px wide and 34px tall on both narrow side panes and mobile bottom sheets.
  - Main-table elements (`group !== null`) are placed at `style={{ gridColumn: el.group, gridRow: el.period }}` (rows 1–7).
  - Lanthanides (`Z = 57..71`, `period === 6, group === null`) and actinides (`Z = 89..103`, `period === 7, group === null`) sit below period 7 after a one-row gap (`gridRow = 9` for lanthanides and `gridRow = 10` for actinides, `gridColumn = 3..17`).
  - Each cell is a `<button>` with `data-ptable-cell={el.symbol}`, `aria-label={`${el.name}, ${el.symbol}, ${el.z}`}`, `aria-pressed`, tiny atomic number, bold symbol, and class-based soft background tint (`bg-navy-50` for metals, `bg-gold-100` for metalloids, `bg-ok-100` for nonmetals) paired with an unobtrusive legend.
- **Search ("Find an element")**:
  - Filters as the student types. Exact case-insensitive symbol matches (e.g. `"fe"`, `"na"`, `"k"`) match that element directly so two-letter symbols that also appear inside other element names (such as `"fe"` vs. `"fermium"`) uniquely select and highlight the symbol match; otherwise case-insensitive name substring matches (e.g. `"iron"`, `"ium"`) highlight all matching cells with a coral ring (`ring-2 ring-coral`, `data-highlighted="true"`).
  - When exactly one element matches, it is automatically selected and its detail card is shown. Clearing the input or matching zero elements clears the highlight and selection.
- **Detail card (`data-ptable-detail`)**:
  - Rendered below the search box and above the grid when an element is selected by tap or unique search.
  - Displays capitalized name, symbol, and atomic number (`Z`), followed by:
    - **Atomic mass**: `atomicWeight`, wrapped in square brackets (`[98]`) when `radioactive && !atomicWeight.includes('.')` and unbracketed (`238.03`) otherwise.
    - **Period**: `1..7`.
    - **Group**: `1..18`, or `"lanthanide"` / `"actinide"` when `group === null`.
    - **Class**: `"metal"`, `"metalloid"`, or `"nonmetal"`.
    - **Common ion charge(s)**: formatted with `+` and Unicode minus `−` (`1+`, `3+ or 2+`, `1+ or 1−`, `2−`) when `commonCharges` is non-empty, and omitted when `commonCharges` is empty.

### 2. `src/pages/flows/ProblemFrame.tsx`

- Computed `const chem = courseOfModule(instance.moduleId)?.course.id === 'chemistry'` and appended one spread to `tools`:
  `...(chem ? [{ id: 'ptable', title: 'Periodic table', short: 'Elements', content: <PeriodicTablePanel /> }] : [])`
- Placed in `tools` for all layouts (desktop/tablet rail section titled `"Periodic table"` and phone toolbar button `"Elements"` opening the `"Periodic table"` bottom sheet) and kept available in timed/test mode (`timedRunning`).

### 3. Tests

- `src/components/ptable/PeriodicTablePanel.test.tsx`: verifies all 118 element cells and unique symbols, clicking `K` (`Potassium`, `39.098`, period `4`, group `1`, `1+`), radioactive mass conventions (`Tc` → `[98]`, `U` → `238.03`), search behavior (`"fe"` selects and highlights iron; `"xx"` clears selection without crashing; `"ium"` highlights multiple cells; clearing removes highlights), omitting charges for `Ne`, and grid placement spot checks (`H` at col 1 row 1, `He` at col 18 row 1, `La` in the lanthanide row, `Og` at col 18 row 7).
- `src/pages/flows/ptableGating.test.tsx`: verifies that chemistry problems offer the `"Periodic table"` rail panel on desktop/tablet (including in `testMode`) and the `"Elements"` sheet button on phone, while non-chemistry problems (geometry and precalculus) omit it in both layouts.

## Verification

Exact commands run and their real results in this worktree (`C:\work\ptable`):

- `npm run typecheck`: exited with code 1 (`Error: Cannot find module 'C:\work\ptable\node_modules\typescript\bin\tsc'` — `C:\work\ptable` is a git worktree of `C:/work/precalc-trainer` without a local `node_modules` directory/junction in the worktree root).
- `npm test`: exited with code 1 (`Error: Cannot find module 'C:\work\ptable\node_modules\vitest\vitest.mjs'` — same missing `node_modules` junction in the worktree root).
- `npm run build`: exited with code 1 (`Error: Cannot find module 'C:\work\ptable\node_modules\typescript\bin\tsc'` — same missing `node_modules` junction in the worktree root).
- `git status` and `git diff`: verified only the allowed files were created/modified and `ProblemFrame.tsx` contains only the 4 added lines and 0 removed lines.

## Integration review (Claude, 2026-11-02)

The builder's runs above failed only because the fresh worktree had no `node_modules`
(`npm ci` is not on its allow-list); after `npm ci`, `npm run typecheck` exits 0.

A full-suite run in this worktree showed 27 files / 50 tests failing, but every failure
was a 20 s timeout or a 50 ms performance assertion, spread across modules this diff
cannot reach, while Grok's examples-parity suite ran on the same machine — load noise,
except for one real effect this experiment isolated: the same `AtomFlow`/`ElectronFlow`
tests re-run on clean `main` under the same load passed 17/17 with ~55 s of test time,
while this branch needed ~3× that. The panel mounts 118 cells into every chemistry
problem, and every Testing Library query in those journey tests scans the enlarged tree.
Production cost is one extra mount per problem (negligible, and phones mount the sheet
only when opened); the tax is on jsdom queries.

Fixes applied in review:

- `PeriodicTablePanel` is wrapped in `React.memo` (it takes no props), so problem-flow
  state changes — every keypress and check — no longer re-reconcile the 118 cells.
- The `AtomFlow.test.tsx` describes, both `ElectronFlow.test.tsx` describes, and one
  per-`it` third-argument timeout in ElectronFlow went from 20 s to 60 s, with a comment
  naming the reason (same precedent as `ee.exponential`'s 120 s).

Re-runs after the fixes: `PeriodicTablePanel.test.tsx` 6/6, `ptableGating.test.tsx` 3/3,
`AtomFlow.test.tsx` 12/12, `ElectronFlow.test.tsx` 5/5, typecheck clean. Browser QA on
the dev server: desktop rail (panel under Tools, Fe tap → detail card) and phone sheet
("Elements" → "Periodic table" dialog; K, Tc `[98]`, U `238.03`, La `lanthanide`,
search `fe`/`ium`/clear) both pass; `quadratics/cs.vertex` shows no panel. The usual
full-suite run on the merged tree remains the ship gate.

## Files

New:
- `src/components/ptable/PeriodicTablePanel.tsx`
- `src/components/ptable/PeriodicTablePanel.test.tsx`
- `src/pages/flows/ptableGating.test.tsx`
- `docs/progress/chem-ptable.md`
- `src/components/ptable/transuranics.ts` (committed separately before the build)

Changed:
- `src/pages/flows/ProblemFrame.tsx`
- `src/pages/flows/AtomFlow.test.tsx`, `src/pages/flows/ElectronFlow.test.tsx` (test budgets)
