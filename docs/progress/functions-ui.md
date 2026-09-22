# Functions UI (domain, range, composition) — progress

Step 2 of the roadmap split. The engine core in `src/engine/functions/` was not edited. Nothing in it looked
wrong from the templates: every generated function the tests asked about came back non-null, and each
canonical answer graded `correct`.

## What landed

- Module `domainRange` (precalculus, order 1.6, right after Reading a graph): `dr.domain`, `dr.range`.
- Module `composition` (order 1.7): `comp.expr`, `comp.value`, `comp.domain`, `comp.decompose`.
- Each `FunctionMistakeKind` is an `ErrorPatternId` `fn_<kind>` with a catalog lesson and a wrong → right
  example. The screen shows the engine's witness sentence about her numbers. Graded answers are recorded
  the same way as the other answer-only flows, so Progress counts each pattern.
- Set boxes use `parseSetAnswer` and a live "reads as …" line from `describeSetText` (not the notation
  set-builder, which refuses `!=`). Expression boxes use MathInput. Values accept a number, a fraction,
  a surd, or "undefined" via `parseValueAnswer`.
- Symbol strip: `SET_ANSWER_KEYS` (including new `[`, `]`, and `≠` → ` != `) and `FUNCTION_KEYS`.
- Graphs stay behind the existing reveal gate. Calculator panels are empty, so that button is hidden.
  For a composite domain, the graph is the unsimplified formula — the simplified one can draw a domain
  that is too big (`x^2` of `sqrt(x)` simplifies to `x`).

## Log

- [done] Types, catalog, symbol keys, both modules, both flows, Home order, colocated tests.
- [done] `tsc` (app and node) clean. Vite build succeeded.
- [done] Full Vitest suite green: 58 files, 952 tests. The 300-seed domain and composition checks need a
  60s timeout; they are over the default 5s once the whole suite is loaded. No core bugs filed.
