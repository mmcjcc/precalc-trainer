# Electron configurations on the electrons module

Status: in place, uncommitted. Light templates (`light.freq`, `light.wavelength`, `light.energy`, `light.spectrum`) are unchanged. App, node, and server typechecks passed; the full Vitest suite passed (104 files, 1866 tests); the production build passed. A live browser was not opened (no dev server); the jsdom flow tests cover the screen.

Six templates on the existing `electrons` module, graded only by `src/engine/econfig` (nothing under `src/engine/econfig` was edited):

- `ec.full`, `ec.shorthand` — neutral atoms Li–Kr, weighted toward Sc–Zn, Cr and Cu, and Ga–Kr
- `ec.ion` — shorthand for transition-metal cations (4s leaves first); either form for main-group ions; H⁻, Li⁺ and Be²⁺ skipped
- `ec.identify` — the configuration is shown; an ion’s charge is stated in the prompt
- `ec.valence` — main-group atoms only, Ga–Kr included, never H or He
- `ec.diagram` — orbital diagram of one named subshell where Hund’s rule matters, then the unpaired count for the whole species (her diagram is passed to `gradeUnpairedElectrons`)

The screen is still `ElectronFlow`. Configurations are typed as plain text, with a live superscript “reads as” line from the parser and a phone strip (`s p d [ ] [He] [Ne] [Ar]`). An `invalid` grade (unreadable, or the wrong form) is shown and not recorded. Orbital boxes are tapped; a box is not capped at two arrows, so the Pauli mistake can be made. Valence and unpaired counts are whole-number fields. Entries persist on the attempt (`ecText`, `ecDiagram`). Hints are nudge, then the module rule card, then the engine’s `explain…()` lines, which flag the attempt. Each of the 17 engine mistake kinds is an `ec_` catalog id; `grade.witness` is the sentence about her answer.

## Showcase (hash routes; seed 13 is base36 `d`)

- `#/p/electrons/ec.full/1` — seed 1, copper, trap `exception_missed`
- `#/p/electrons/ec.shorthand/d` — seed 13, nickel, trap `filling_order`
- `#/p/electrons/ec.ion/d` — seed 13, Fe²⁺, trap `ion_removed_from_3d`
- `#/p/electrons/ec.identify/2` — seed 2, Cr²⁺ (charge stated), trap `ion_charge_ignored`
- `#/p/electrons/ec.valence/5` — seed 5, germanium, trap `valence_last_subshell`
- `#/p/electrons/ec.diagram/5` — seed 5, Mn³⁺ 3d, trap `hund_broken`
