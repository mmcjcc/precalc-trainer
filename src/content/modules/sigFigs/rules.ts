import type { RuleCard } from '@/content/types'

/**
 * Rule cards for significant figures, one per convention (rules 1-11 of the brief) plus one for the
 * mechanics of moving the decimal point. Ids are stable: templates point at them for hint rung 2.
 */
export const SF_RULE_IDS = {
  nonzero: 'sf-nonzero',
  captive: 'sf-captive-zeros',
  leading: 'sf-leading-zeros',
  trailing: 'sf-trailing-zeros',
  scientific: 'sf-scientific',
  exact: 'sf-exact',
  muldiv: 'sf-muldiv',
  addsub: 'sf-addsub',
  mixed: 'sf-mixed',
  rounding: 'sf-rounding',
  showFigures: 'sf-show-figures',
  movePoint: 'sf-move-point',
} as const

export type SfRuleKey = keyof typeof SF_RULE_IDS

export const SF_RULES: RuleCard[] = [
  {
    id: SF_RULE_IDS.nonzero,
    title: 'Nonzero digits always count',
    body: 'Every digit from 1 to 9 was read off an instrument, so it is significant. The only digits you ever have to think about are the zeros.',
    example: '45.67 g  →  4 significant figures',
  },
  {
    id: SF_RULE_IDS.captive,
    title: 'Zeros in the middle count',
    body: 'A zero trapped between two significant digits is significant too. It was measured just like its neighbors.',
    example: '5002 mL  →  4 figures     10.05 g  →  4 figures',
  },
  {
    id: SF_RULE_IDS.leading,
    title: 'Leading zeros never count',
    body: 'Zeros in front of the first nonzero digit only show where the decimal point is. Start counting at the first nonzero digit.',
    example: '0.0045 g  →  2 figures (4, 5)     0.00450 g  →  3 figures (4, 5, 0)',
  },
  {
    id: SF_RULE_IDS.trailing,
    title: 'Trailing zeros: look for the decimal point',
    body: 'Zeros at the end count ONLY when a decimal point is written somewhere in the number. With no decimal point they are placeholders that just keep the number the right size.',
    example: '1200  →  2 figures     1200.  →  4 figures     100.0  →  4 figures     40.  →  2 figures',
  },
  {
    id: SF_RULE_IDS.scientific,
    title: 'Scientific notation: count the front number',
    body: 'Every digit of the number in front of × 10 is significant. The power of ten only sets the size, so it never changes the count.',
    example: '1.20 × 10³  →  3 figures     3.00 × 10⁸ m/s  →  3 figures',
  },
  {
    id: SF_RULE_IDS.exact,
    title: 'Exact numbers never limit the answer',
    body: 'Things you count (12 tablets, 3 trials) and conversions that are true by definition (100 cm = 1 m, 60 s = 1 min) have no uncertainty. Treat them as having unlimited significant figures and let the measurements decide.',
    example: '0.325 g × 12 tablets = 3.90 g  (3 figures, from 0.325; the 12 does not count)',
  },
  {
    id: SF_RULE_IDS.muldiv,
    title: '× and ÷ : keep the FEWEST significant figures',
    body: 'Count the significant figures in each measured number. The answer gets the same count as the measurement with the fewest.',
    example: '3.20 × 1.5 = 4.8  (2 figures, like 1.5)     12.50 ÷ 4.1 = 3.0',
  },
  {
    id: SF_RULE_IDS.addsub,
    title: '+ and − : stop at the LEAST precise place',
    body: 'Line the numbers up on the decimal point. The answer stops at the last place that EVERY number reaches. This is about places, not about counting figures, so a subtraction can lose figures and an addition can gain one.',
    example: '12.11 + 18.0 + 1.013 = 31.1  (tenths, like 18.0)     5.26 − 5.21 = 0.05',
  },
  {
    id: SF_RULE_IDS.mixed,
    title: 'Two rules in one problem: round once, at the end',
    body: 'Do the part in parentheses first and note how precise that result is (its last good place, or its number of figures), but keep ALL its digits in the calculator. Then apply the other rule and round one time, at the very end.',
    example: '(12.11 + 1.3) ÷ 2.0:  13.41 is good to the tenths (3 figures), then ÷ 2.0 (2 figures)  →  6.7',
  },
  {
    id: SF_RULE_IDS.rounding,
    title: 'Rounding: look at the first digit you drop',
    body: 'If the first dropped digit is 5 or more, the last kept digit goes up by one. If it is 4 or less, the kept digits stay. Never just chop the extra digits off, and look only at that one digit.',
    example: '0.004567 to 2 figures  →  0.0046     0.99961 to 3 figures  →  1.00',
  },
  {
    id: SF_RULE_IDS.showFigures,
    title: 'Make the answer SHOW its figures',
    body: 'The way you write the answer has to show the right number of figures. Keep a zero that was earned (3.0, not 3). Fill dropped places in a big number with placeholder zeros (12000, not 12). If a whole number would hide a significant zero, use scientific notation or a decimal point at the end.',
    example: '1999 to 2 figures  →  2.0 × 10³ (not 2000)     all four figures of 2000  →  2000.',
  },
  {
    id: SF_RULE_IDS.movePoint,
    title: 'Converting: move the point, keep the figures',
    body: 'Slide the decimal point until exactly one nonzero digit is in front of it. Count the jumps: that is the power of ten, positive for a big number and negative for a small one. The significant figures you started with must all still be there, no more and no fewer.',
    example: '0.00450  →  4.50 × 10⁻³     1200  →  1.2 × 10³     1200.  →  1.200 × 10³',
  },
]

export function sfRule(key: SfRuleKey): string {
  return SF_RULE_IDS[key]
}
