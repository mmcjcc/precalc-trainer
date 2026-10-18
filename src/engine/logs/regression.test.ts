/**
 * Regression: lines from across the app (test inputs, generated problems of every module) parse exactly as they
 * did before the log syntax and the letter-run splitting were added. The expected trees were recorded from the
 * parser BEFORE any change in this build (every one of the 21,021 string literals and generated problem strings
 * was compared the same way; only the bare word log(x) and garbage parses of bare function names changed).
 */
import { describe, expect, it } from 'vitest'
import { parseExpression, parseStatement } from '../parse'

const VARS = ['x', 'y', 'n', 'h'] as const

/** [what she types, the statement as math.js prints it (disjuncts joined by |, conjuncts by &)] */
const STATEMENTS: readonly [string, string][] = [
  [
    "x = 1",
    "x = 1"
  ],
  [
    "-4 <= x < 0",
    "-4 <= x & x < 0"
  ],
  [
    "x*y + 2x = 0",
    "x * y + 2 * x = 0"
  ],
  [
    "y = -x/5 + 23/5",
    "y = -x / 5 + 23 / 5"
  ],
  [
    "x = 5",
    "x = 5"
  ],
  [
    "3y + 6 = 0",
    "3 * y + 6 = 0"
  ],
  [
    "y − 4 = −1/5(x − 3)",
    "y - 4 = -1 / 5 * (x - 3)"
  ],
  [
    "y = 0",
    "y = 0"
  ],
  [
    "x = 0",
    "x = 0"
  ],
  [
    "(x - 2)^2 >= 0",
    "(x - 2) ^ 2 >= 0"
  ],
  [
    "(x - 1)(x - 2) <= 0",
    "(x - 1) * (x - 2) <= 0"
  ],
  [
    "12 > 3x",
    "12 > 3 * x"
  ],
  [
    "x + 2 >= 0",
    "x + 2 >= 0"
  ],
  [
    "x*y + 2*x = 5",
    "x * y + 2 * x = 5"
  ],
  [
    "X = 3",
    "x = 3"
  ],
  [
    "y - 13 = 2(x^2 - 12x)",
    "y - 13 = 2 * (x ^ 2 - 12 * x)"
  ],
  [
    "f(x) = x^2 - 6x + 13",
    "y = x ^ 2 - 6 * x + 13"
  ],
  [
    "y = ((x - 2)^3 - 10)/3",
    "y = ((x - 2) ^ 3 - 10) / 3"
  ],
  [
    "-2x < -12",
    "-2 * x < -12"
  ],
  [
    "x + 5 < 2",
    "x + 5 < 2"
  ],
  [
    "x - 6 = (3/4)y",
    "x - 6 = 3 / 4 * y"
  ],
  [
    "x = 3 or x = -3",
    "x = 3 | x = -3"
  ],
  [
    "-2 < x <= 2",
    "-2 < x & x <= 2"
  ],
  [
    "x^3+3x^2+3x+1 = 7y+3",
    "x ^ 3 + 3 * x ^ 2 + 3 * x + 1 = 7 * y + 3"
  ],
  [
    "x - 1 = 3/(y-2)",
    "x - 1 = 3 / (y - 2)"
  ],
  [
    "x <= 2",
    "x <= 2"
  ],
  [
    "x < 998",
    "x < 998"
  ],
  [
    "f^-1(x) = E",
    "y = e"
  ],
  [
    "x < -5 or x >= 4",
    "x < -5 | x >= 4"
  ],
  [
    "f(x) = 4x + 3",
    "y = 4 * x + 3"
  ],
  [
    "x < -2",
    "x < -2"
  ],
  [
    "1 <= x < 3",
    "1 <= x & x < 3"
  ],
  [
    "-4 <= x <= 4",
    "-4 <= x & x <= 4"
  ],
  [
    "6x < -6",
    "6 * x < -6"
  ],
  [
    "-4x <= -4",
    "-4 * x <= -4"
  ],
  [
    "-(3/4)y < 9",
    "-(3 / 4) * y < 9"
  ],
  [
    "(5/4)y + 5 >= -5",
    "5 / 4 * y + 5 >= -5"
  ],
  [
    "0 > x > -3",
    "0 > x & x > -3"
  ],
  [
    "y = 5(-x)^3 - (-x)^2",
    "y = 5 * (-x) ^ 3 - (-x) ^ 2"
  ],
  [
    "y = (-x)*cbrt(-x)",
    "y = -x * cbrt(-x)"
  ],
  [
    "x - 6 = 5y",
    "x - 6 = 5 * y"
  ],
  [
    "x = 2y + 4",
    "x = 2 * y + 4"
  ],
  [
    "x = cbrt(3y - 8) - 1",
    "x = cbrt(3 * y - 8) - 1"
  ],
  [
    "x = cbrt(2y - 1) - 2",
    "x = cbrt(2 * y - 1) - 2"
  ],
  [
    "x + 2 = cbrt(2y + 4)",
    "x + 2 = cbrt(2 * y + 4)"
  ],
  [
    "x + 2 = (7/4)y",
    "x + 2 = 7 / 4 * y"
  ],
  [
    "x = -(7/5)y - 5",
    "x = -(7 / 5) * y - 5"
  ],
  [
    "x = (2/7)(y - 2)",
    "x = 2 / 7 * (y - 2)"
  ],
  [
    "y - 6 = (7/4)x",
    "y - 6 = 7 / 4 * x"
  ],
  [
    "x = -4/y - 2",
    "x = -4 / y - 2"
  ],
  [
    "(x - 1)(y + 5) = 6",
    "(x - 1) * (y + 5) = 6"
  ],
  [
    "x = 4/y - 4",
    "x = 4 / y - 4"
  ],
  [
    "(x + 6)(y - 6) = 6",
    "(x + 6) * (y - 6) = 6"
  ],
  [
    "x = (3 - y)/(y - 5)",
    "x = (3 - y) / (y - 5)"
  ],
  [
    "x = (5y - 1)/(y + 4)",
    "x = (5 * y - 1) / (y + 4)"
  ],
  [
    "xy - 2x = -5y + 4",
    "x * y - 2 * x = -5 * y + 4"
  ],
  [
    "y(x - 4) = -2 + 3x",
    "y * (x - 4) = -2 + 3 * x"
  ],
  [
    "y(x - 4) = -2x - 4",
    "y * (x - 4) = -2 * x - 4"
  ],
  [
    "x = 1 + sqrt((y + 2)/4) or x = 1 - sqrt((y + 2)/4)",
    "x = 1 + sqrt((y + 2) / 4) | x = 1 - sqrt((y + 2) / 4)"
  ],
  [
    "y = -1 + sqrt((x + 8)/4) or y = -1 - sqrt((x + 8)/4)",
    "y = -1 + sqrt((x + 8) / 4) | y = -1 - sqrt((x + 8) / 4)"
  ],
  [
    "x = 2 + sqrt((2 - y)/4) or x = 2 - sqrt((2 - y)/4)",
    "x = 2 + sqrt((2 - y) / 4) | x = 2 - sqrt((2 - y) / 4)"
  ],
  [
    "y = 3 + sqrt((x - 8)/4) or y = 3 - sqrt((x - 8)/4)",
    "y = 3 + sqrt((x - 8) / 4) | y = 3 - sqrt((x - 8) / 4)"
  ],
  [
    "f(x) = -4x^2 + 2x",
    "y = -4 * x ^ 2 + 2 * x"
  ],
  [
    "x + h >= -4",
    "x + h >= -4"
  ],
  [
    "x = 1/2",
    "x = 1 / 2"
  ],
  [
    "(x^2 - 6x - 7)/(x + 1) = -3",
    "(x ^ 2 - 6 * x - 7) / (x + 1) = -3"
  ],
  [
    "(-2(3x + 5)^2)/(x(3x - 2)) >= 0",
    "-2 * (3 * x + 5) ^ 2 / (x * (3 * x - 2)) >= 0"
  ],
  [
    "x^2 + 4x + 20 = 0",
    "x ^ 2 + 4 * x + 20 = 0"
  ],
  [
    "3x = 9",
    "3 * x = 9"
  ],
  [
    "2x + 3 = 21",
    "2 * x + 3 = 21"
  ]
]

/** [what she types, the expression as math.js prints it] */
const EXPRESSIONS: readonly [string, string][] = [
  [
    "h3",
    "h * 3"
  ],
  [
    "3n-5",
    "3 * n - 5"
  ],
  [
    "1/(sqrt(x + h) + sqrt(x))",
    "1 / (sqrt(x + h) + sqrt(x))"
  ],
  [
    "x + h - 2",
    "x + h - 2"
  ],
  [
    "1.22 x 10^-1",
    "1.22 * x * 10 ^ (-1)"
  ],
  [
    "-x*abs(x)",
    "-x * abs(x)"
  ],
  [
    "sqrt(x+3)",
    "sqrt(x + 3)"
  ],
  [
    "-(x^2+1)/x",
    "-(x ^ 2 + 1) / x"
  ],
  [
    "2x",
    "2 * x"
  ],
  [
    "x^3 - 7x + 6",
    "x ^ 3 - 7 * x + 6"
  ],
  [
    "3x^2 + 2x - 1",
    "3 * x ^ 2 + 2 * x - 1"
  ],
  [
    "abs(h - x)",
    "abs(h - x)"
  ],
  [
    "3/x",
    "3 / x"
  ],
  [
    "sqrt(x) + sqrt(h)",
    "sqrt(x) + sqrt(h)"
  ],
  [
    "(3x + 3h - 2 - (3x - 2))/h",
    "(3 * x + 3 * h - 2 - (3 * x - 2)) / h"
  ],
  [
    "(-x)^3 - 2(-x)",
    "(-x) ^ 3 - 2 * -x"
  ],
  [
    "1/(x + 1)",
    "1 / (x + 1)"
  ],
  [
    "(x - 3)^2",
    "(x - 3) ^ 2"
  ],
  [
    "(x + 1)^(1/4)",
    "(x + 1) ^ (1 / 4)"
  ],
  [
    "1/(x^2 - 2)",
    "1 / (x ^ 2 - 2)"
  ],
  [
    "3x^2 - x",
    "3 * x ^ 2 - x"
  ],
  [
    "1/(x^2 - 1)",
    "1 / (x ^ 2 - 1)"
  ],
  [
    " - 6x",
    "-6 * x"
  ],
  [
    "-(x - 1)^3(x + 2)",
    "-(x - 1) ^ 3 * (x + 2)"
  ],
  [
    "2(x - 3)^2 - 18 + 13",
    "2 * (x - 3) ^ 2 - 18 + 13"
  ],
  [
    "3x + 1",
    "3 * x + 1"
  ],
  [
    "2(x - 6)^2 - 5",
    "2 * (x - 6) ^ 2 - 5"
  ],
  [
    "2(x^2 - 5x) + 13",
    "2 * (x ^ 2 - 5 * x) + 13"
  ],
  [
    "4x^2 - 2x",
    "4 * x ^ 2 - 2 * x"
  ],
  [
    "-2(x + 1)^2 (x - 3)(x - 1/2)^3",
    "-2 * (x + 1) ^ 2 * (x - 3) * (x - 1 / 2) ^ 3"
  ],
  [
    "(x^2 + 1)(x - 2)",
    "(x ^ 2 + 1) * (x - 2)"
  ],
  [
    "-2x^3 + 2x^2 + 10x + 6",
    "-2 * x ^ 3 + 2 * x ^ 2 + 10 * x + 6"
  ],
  [
    "(2/3)(x + 1)(x - 3)^2",
    "2 / 3 * (x + 1) * (x - 3) ^ 2"
  ],
  [
    "2.00 x 10^2",
    "2 * x * 10 ^ 2"
  ],
  [
    "1 x 10^-30",
    "1 * x * 10 ^ (-30)"
  ],
  [
    "1.2x11^3",
    "1.2 * x * 11 ^ 3"
  ],
  [
    "2|3 - x|",
    "2 * abs(3 - x)"
  ],
  [
    "-sqrt(2(x - 5/2))",
    "-sqrt(2 * (x - 5 / 2))"
  ],
  [
    "-1/(2(x - 3))",
    "-1 / (2 * (x - 3))"
  ],
  [
    "(5/4)y - 4",
    "5 / 4 * y - 4"
  ],
  [
    "x-(-8)",
    "x - -8"
  ],
  [
    "7.54 x 10^-2",
    "7.54 * x * 10 ^ (-2)"
  ],
  [
    "3x - 11",
    "3 * x - 11"
  ],
  [
    "4x + 3",
    "4 * x + 3"
  ],
  [
    "1/(x - 5)",
    "1 / (x - 5)"
  ],
  [
    "2x - 8",
    "2 * x - 8"
  ],
  [
    "(1/3)x^2",
    "1 / 3 * x ^ 2"
  ],
  [
    "-4x - 2",
    "-4 * x - 2"
  ],
  [
    "-3x - 2",
    "-3 * x - 2"
  ],
  [
    "3x^3 - x^2",
    "3 * x ^ 3 - x ^ 2"
  ],
  [
    "(x - 3)/-2",
    "(x - 3) / -2"
  ],
  [
    "-(7/5)x - 5",
    "-(7 / 5) * x - 5"
  ],
  [
    "(3 + 2x)/(x + 4)",
    "(3 + 2 * x) / (x + 4)"
  ],
  [
    "4(x - 3)^2 + 8",
    "4 * (x - 3) ^ 2 + 8"
  ],
  [
    "(6x + 6h - 1 - (6x - 1))/h",
    "(6 * x + 6 * h - 1 - (6 * x - 1)) / h"
  ],
  [
    "h(-8x - 4h)/h",
    "h * (-8 * x - 4 * h) / h"
  ],
  [
    "(4x^2 + 8xh + 4h^2 - 4x - 4h - 2 - (4x^2 - 4x - 2))/h",
    "(4 * x ^ 2 + 8 * x * h + 4 * h ^ 2 - 4 * x - 4 * h - 2 - (4 * x ^ 2 - 4 * x - 2)) / h"
  ],
  [
    "5/(x + h)",
    "5 / (x + h)"
  ],
  [
    "5/(x + h - 4)",
    "5 / (x + h - 4)"
  ],
  [
    "3(x + 2)^2 − 16",
    "3 * (x + 2) ^ 2 - 16"
  ],
  [
    "-(x^2 + 6x + 9 - 9) - 8",
    "-(x ^ 2 + 6 * x + 9 - 9) - 8"
  ],
  [
    "x^2 - 6x - 2",
    "x ^ 2 - 6 * x - 2"
  ],
  [
    "-(x + 1)^2 + 1 + 5",
    "-(x + 1) ^ 2 + 1 + 5"
  ],
  [
    "x^3 + 3x - 4",
    "x ^ 3 + 3 * x - 4"
  ],
  [
    "3x^3 - 3x^2 - 15x - 9",
    "3 * x ^ 3 - 3 * x ^ 2 - 15 * x - 9"
  ],
  [
    "(-9x^2 + 27x - 20)/(18x^2 - 18x + 4)",
    "(-9 * x ^ 2 + 27 * x - 20) / (18 * x ^ 2 - 18 * x + 4)"
  ],
  [
    "(x^2 - 6x - 7)/(x + 1)",
    "(x ^ 2 - 6 * x - 7) / (x + 1)"
  ],
  [
    "4/(x - 1)",
    "4 / (x - 1)"
  ],
  [
    "1.00 x 10^1",
    "1 * x * 10 ^ 1"
  ],
  [
    "2.21 x 10^1",
    "2.21 * x * 10 ^ 1"
  ]
]

describe('existing lines parse as before', () => {
  it.each(STATEMENTS)('statement %s', (text, expected) => {
    const p = parseStatement(text, VARS)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const printed = p.statement.disjuncts.map((c) => c.map((r) => `${r.lhs.toString()} ${r.op} ${r.rhs.toString()}`).join(' & ')).join(' | ')
    expect(printed).toBe(expected)
  })
  it.each(EXPRESSIONS)('expression %s', (text, expected) => {
    const p = parseExpression(text, VARS)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.node.toString()).toBe(expected)
  })
})
