# Engine route fixes (fix-engine agent)

- ER-1 done: parse.ts expandPlusMinus gives h + E / h - E (unary ± still drops); transforms.ts pmRoot accepts v = h ± √T. Tests: routes.test.ts "ER-1" (failed before).
- ER-2 done: roots.ts shrinksToward keeps infinite-slope sign changes as roots, poles stay poles; samples.ts evalRelationNear/statementHoldsNear used by compareSets1D; counterexample.ts re-checks truth at the shown point (survivesSnap filter in step.ts). Tests: routes.test.ts "ER-2" (failed before); §9 21/22 green.
- ER-3 done: transforms.ts exports sameLine/swapXY; step.ts anchorCanonical uses sameLine only (quickEquivalent removed). Tests: routes.test.ts "ER-3" template walks (inequality walks failed before).
- ER-4 done: matchers.ts coefficientOf keeps nested unary minus. Tests: routes.test.ts "ER-4" (failed before).
- ER-5 done: matchers.ts termAcrossSign for any matching relation; catalog lesson reworded. Tests: routes.test.ts "ER-5" (failed before).
- ER-6 done: step.ts swapWithMove (renamed Tier 2 equal → equivalent_by_rename, swap_xy + solving chip). Tests: routes.test.ts "ER-6" (failed before).
- ER-7 done: matchers.ts power_over_sum for sqrt/cbrt/abs, negative_not_distributed for -(sum), reciprocal_coeff k·R candidate. Tests: routes.test.ts "ER-7" (failed before).
- ER-8 done: matchers.ts chainReadBackwards → swap_sides_no_reverse. Tests: routes.test.ts "ER-8" (failed before).
- ER-9 done: matchers.ts sideWitness skips equal points, shows every used variable. Tests: routes.test.ts "ER-9" (failed before).
- ER-10 done: transforms.ts detectChain tries mirrored pairing → swap_sides. Tests: routes.test.ts "ER-10" (failed before).
