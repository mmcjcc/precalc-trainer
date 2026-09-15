# Precalc Trainer

Step-by-step precalculus practice for one student. She types every line of her work; the engine
decides whether the new line is a legal transformation of the previous one, names the property
that justifies it, and coaches the illegal move at the moment it happens (with the counterexample
that proves it). Fresh problems are generated from seeded templates, every problem has a graph, and
a calculator panel gives exact keystrokes for the **TI-84 Plus CE** and the **TI-Nspire CX II**
(non-CAS).

Unit 1 modules: number line → interval and set notation · linear inequalities · even / odd /
neither · inverses and one-to-one · properties drill. Progress stays on the device
(localStorage) with export/import.

## Run it

Requires Node 22 (`.nvmrc`). On the original dev box Node is a portable install that only Git
Bash sees; see `CLAUDE.md`.

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # Vitest: engine, notation, content, store, components
npm run typecheck
npm run build        # -> dist/
npm run test:sweep   # opt-in engine regression sweep, about 90 s
```

The package scripts call the tools through `node node_modules/…` on purpose (the `.bin` shims do
not work under the portable Node). In dev there is no PIN gate: `public/config.js` ships an empty
hash. To try the gate locally, put a SHA-256 hex of your PIN into that file.

## What the student types

ASCII, calculator style: `sqrt(x+1)`, `cbrt(7x+3) - 1`, `abs(x)`, `x^2`, `3/(x+2)`, implicit
multiplication (`2x`, `x(y+2)`), relations `=`, `<`, `<=`, `>`, `>=`, `or`, `and`, chained
`-3 < 2x+1 <= 5`, and `+-` for ±. The symbol strip inserts these tokens; pasted Unicode
(`≤ ≥ √ ∞ ∪ −`) is normalized. Interval answers look like `(-inf, -2] U (5, inf)`, set-builder
like `{x | x <= -2 or x > 5}`.

## Layout

```
src/shared     contracts (types only)
src/engine     parser, numeric equivalence engine, error-pattern matchers
src/notation   exact interval/set-builder parsing, LaTeX and calculator formatting
src/content    problem generators, canonical solution paths, hints, calculator panels
src/store      progress (event log in localStorage), settings, attempt state
src/components src/pages src/App.tsx   the React UI
deploy/ Dockerfile nginx.conf docker/   container and Azure deployment
docs/          BUILD_GUIDE.md (architecture), research/ (design notes)
```

`docs/EVALUATION.md` records why the engine deviates from the original spec. `docs/BUILD_GUIDE.md`
is the architecture and API reference.

## Deploy

`docker build --platform linux/amd64 -t precalc-trainer . && docker run -p 8080:80 -e APP_PIN=1234 precalc-trainer`

Azure Container Apps (scale to zero, ~$0 at family usage) with GitHub Actions: `deploy/azure.md`.
