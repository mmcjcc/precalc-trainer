# Electrons and light — content and screen

Chemistry module `electrons` ("Electrons and light"), ordered after Atomic structure. Light calculations for CK-12 chapter 5, sections 5.1–5.3, on the existing significant-figures engine. Electron-configuration templates belong in this same module later, as another `question.kind` from their own engine — not a new module, and not `lt_` ids.

## What shipped

- Templates `light.freq`, `light.wavelength`, `light.energy` (each a sig-fig `muldiv` task) and `light.spectrum` (tap to order, no calculation).
- Constants on every calculation: c = 3.00 × 10⁸ m/s (3 figures), h = 6.626 × 10⁻³⁴ J·s (4). Both count. 1 nm = 10⁻⁹ m is exact and is flagged `exact` on the task when a wavelength is in nm or the answer is asked in nm.
- Named mistakes `lt_no_conversion`, `lt_conversion_backwards`, `lt_multiplied`, `lt_inverted`, `lt_energy_divided`, `lt_energy_no_c`, `lt_wrong_unit`, `lt_order_reversed`. Graded in `src/content/modules/electrons/grade.ts`, not in the engine: sig-fig grader first (a correct answer stops), then each mistake's own task evaluated exactly and rounded with `roundToSigFigs` to her figure count, then the sig-fig grader's own `sf_` or plain message.
- Screen `ElectronFlow`: context, the given value large, constants card, the existing numeral input, hint rungs (nudge, rule, reveal flagged on the attempt), worked explanation after a correct answer. Ordering is 44 px buttons, keyboard reachable, with undo (button and Ctrl+Z). No graph, no calculator.
- "Hz, which is s⁻¹" is said once, on the c = λν rule card.

Book checks pinned in the module tests: 620 nm → 4.8 × 10¹⁴ Hz; 5.75 × 10¹⁴ Hz → 3.81 × 10⁻¹⁹ J; 700. nm → 2.84 × 10⁻¹⁹ J; 4.50 × 10¹⁴ Hz → 6.67 × 10⁻⁷ m or 667 nm.

## Showcase seeds

| URL | Trap |
|---|---|
| `#/p/electrons/light.freq/7` | red laser, 620 nm — forgetting to convert nm to m |
| `#/p/electrons/light.wavelength/1` | answer asked in nm — the metre number in the nm box |
| `#/p/electrons/light.energy/7` | 5.75 × 10¹⁴ Hz — dividing h by the frequency |
| `#/p/electrons/light.spectrum/7` | decreasing wavelength — the list reversed |
