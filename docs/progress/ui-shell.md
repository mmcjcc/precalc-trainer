# ui-shell progress log

Role: ui-shell (App shell, Home, Module, Progress, Settings, Drill, Sandbox, Pin, shell components).
Baseline 2026-09-15: typecheck green, 181/181 tests pass.

- [start] Read CLAUDE.md, BUILD_GUIDE §3–7, contracts, engine/notation/content/store APIs, UX-09/10/12/13/16/19 + Reference.
- [done] App.tsx: HashRouter + exported AppShell (routes, lazy Problem/Drill/Sandbox, /g→/p redirect, * → /, header nav w/ aria-current, skip link, Toasts, PIN gate).
- [done] main.tsx bootStore(); KaTeX CSS moved into components/Katex.tsx (loads with lazy routes).
- [done] pages/Pin.tsx (Family PIN, numeric, show/hide, role=alert, returnTo), Home, Module (knobs → flags), Settings (calc radios, switches, reset sheet, device note), Drill (recordDrillAnswer, ALL_CHIPS, 10 more), Sandbox (context verifyStep + allowSwap), Progress (skill table, patterns, habits, streak, drill, export/import).
- [done] MasteryBar: additive `status` / `valueText` overrides.
- [done] Legacy files moved (not hard-deleted) to scratchpad legacy-removed/: components/{Workspace,EvenOddPanel,NumberLine}.tsx, demoStore.ts, content/{problems,practice}.ts.
- [done] src/App.test.tsx (routes, Continue card, module, progress import, settings reset, drill record, PIN gate).
- [next] typecheck, tests, vite build + chunk sizes; decide on engine/sets/interval.ts.
- [done] engine/sets/interval.ts + interval.test.ts had no importers after the deletions (only a comment in engine/roots.ts) → moved to scratchpad legacy-removed/src/engine/sets/ (empty dir removed).
- [verified] npm run typecheck exit 0; npm test 23 files / 199 tests pass (incl. 9 in src/App.test.tsx); vite build ok.
- [bundle] main index 1,094.39 kB (330.38 kB gzip) — over Vite's 500 kB default but under the existing chunkSizeWarningLimit 1500, so no warning and vite.config.ts untouched. Lazy: Katex 265.71 kB (+30.25 kB css), Problem 92.79 kB, shared function-plot index 202.78 kB, MathInput 38.35 kB, Sandbox 6.83 kB, Drill 5.27 kB; main css 27.72 kB.
- [gap] Could not load localhost:5173 in the browser pane (navigation denied) → no visual/mobile check done.
