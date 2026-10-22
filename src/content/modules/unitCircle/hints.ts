/**
 * Format hints for the unit-circle templates, under each answer box. Like the rule cards they never write a value or
 * an angle a template can ask for: no digits, and no π on its own (π is an answer of uc.solve in radians).
 */
export const VALUE_HINT = 'Exact: a whole number, a fraction, or a radical such as a√b/c. If the value does not exist, type the word for that.'
export const R_HINT = 'Exact: a whole number, or a radical such as a√b.'
/** uc.given: a value that always exists. */
export const GIVEN_VALUE_HINT = 'Exact: a whole number, a fraction, or a radical such as a√b/c.'
/** uc.solve. */
export const LIST_DEG_HINT = 'Degrees: every angle in the range, separated by commas. The ° is optional.'
export const LIST_RAD_HINT = 'Radians: every angle in the range, each one exact, separated by commas.'
export const UC_HINTS = [VALUE_HINT, R_HINT, GIVEN_VALUE_HINT, LIST_DEG_HINT, LIST_RAD_HINT]
