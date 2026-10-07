# More piecewise practice

Four templates on the existing module `piecewiseRate`. `pw.evaluate` and `arc.rate` still work. Nothing under `src/engine/` was edited except the new `pw_` catalog entries.

## What shipped

- `pw.graph`: the function is only a graph. Filled dots are included endpoints; hollow dots are not. She reads `f(a)` at a jump, an interior point, or a gap (`undefined`).
- `pw.domain`: domain and range in interval notation, from the formula. The range is each piece's image on its own interval, then the union. Even seeds also draw the graph, and only after she finishes.
- `pw.continuous`: find `k` so the two pieces meet. The answer is an integer or a fraction.
- `pw.write`: one row per piece (formula and interval), graded by the values, including which piece owns each boundary.

The graph is on screen before she answers for `pw.graph` and `pw.write`. For `pw.domain` and `pw.continuous` it stays hidden until she finishes, so it is not on `instance.graph`. Her entries are stored on `fnEntries` and survive a reload.

## Checks

`npm run typecheck`, the full Vitest suite (121 files, 2038 tests), and `vite build` passed. An earlier full-suite run failed only the server busy-lock test under load; that test passed alone and in the second full run. Server code was not changed. The screens were exercised in jsdom, including open and closed dots. They were not opened in a browser.
