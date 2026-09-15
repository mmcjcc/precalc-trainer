# Precalc Trainer — working notes for every engineer/agent

Read `docs/BUILD_GUIDE.md` before touching code. It defines layers, file ownership, the public API
of each layer, conventions, and points to the research in `docs/research/` (engine design, error
patterns, content templates, calculators, UX, deployment). `docs/SPEC.md` is the
original brief; the research docs and BUILD_GUIDE override it where they conflict.

Tooling on this machine: use the **Bash tool** (Git Bash). `node`, `npm`, `npx` are on PATH there
(portable Node 22 in `C:\Users\cohenjas\bin`). PowerShell does NOT have them.

Commands (run from the project root `S:/Users/cohenjas/OneDrive/math/precalc-trainer`). The package
scripts call the tools through node directly, so `npm run typecheck`, `npm test`, `npm run build` and
`npm run dev` all work. Do not use `npx` or `node_modules/.bin` shims; they fail under the portable Node.
- `npm run typecheck` must pass for your files (other agents' unfinished files may fail; report that,
  do not fix their files).
- `node node_modules/vitest/vitest.mjs run <path>` runs a subset while iterating.
- `node node_modules/vite/bin/vite.js build` builds without repeating the typecheck.

Rules:
- Import direction: `shared <- engine <- notation <- content <- ui`. Never import upward. Use the
  `@/` alias (`@/shared/types`).
- Contracts in `src/shared/types.ts` and `src/content/types.ts` are fixed. If you truly need a
  change, make it additive and call it out in your final report.
- Tests are colocated (`foo.test.ts`). Engine/notation/content tests run in node; UI tests add
  `// @vitest-environment jsdom` at the top.
- Student input syntax is ASCII calculator style: `sqrt()`, `cbrt()`, `abs()`, `^`, implicit
  multiplication (`2x`, `x(y+2)`), `<=`, `>=`, `or`, `+-`. Unicode from the symbol strip is
  normalized before parsing (`engine/input/normalize.ts`).
- Only edit files you own (see BUILD_GUIDE ownership map). Do not reformat others' files.
- Strict TypeScript; no `any` unless unavoidable (then comment why).
- Keep the student-facing voice warm and specific: name the property, show the counterexample.
