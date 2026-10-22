/**
 * The grapher's evaluator. A row is parsed by the app's own parser (`@/engine` parseExpression: implicit
 * multiplication, logs, |x|, roots), and its tree is compiled here into plain closures, about a hundred times faster
 * than evaluating the tree each time, so a drag can resample every curve on every frame. The meaning is the
 * engine's (tested against it): log is base 10, ln base e, log(u, b) base b, √ of a negative and 0 to a negative power
 * are undefined (NaN), an odd root of a negative is negative. Degree mode makes sin, cos and tan take degrees and the
 * inverse functions return them (the TI-84's MODE). Overflow is ±Infinity (off the chart), not undefined.
 *
 * Alongside each closure come its critical sub-expressions: every x where one of them is zero may be a break in the
 * curve (a denominator, the cosine under a tangent, the inside of a log or a square root, an arcsine's ±1). The
 * sampler splits the curve there and looks at both sides, so no line is drawn across an asymptote and a hole stays
 * open. Calls of her own functions (f(x) = …, then g(x) = f(x − 2)) arrive as a carrier call (see parse.ts) and are
 * compiled inline, their critical sub-expressions composed with the argument. Pure.
 */
import type { MathNode } from 'mathjs'
import { logBase } from '@/engine/math'

export type AngleMode = 'rad' | 'deg'

/** What every closure reads: the variable(s), the sliders' values (by index), the angle mode. */
export interface Env {
  x: number
  y: number
  p: number[]
  deg: boolean
}

export type Closure = (e: Env) => number

export interface Compiled {
  run: Closure
  /** Sub-expressions whose zeros are possible breaks (only those that depend on x or y). */
  crit: Closure[]
  usesX: boolean
  usesY: boolean
}

export class CompileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompileError'
  }
}

/** A call of her function number k is written `nthroot(arg, -(CARRIER_BASE + k))` before parsing (parse.ts). */
export const CARRIER_NAME = 'nthroot'
export const CARRIER_BASE = 1000

export interface CompileScope {
  /** Slider (or constant) letter → index into Env.p. */
  params: ReadonlyMap<string, number>
  /** Her functions by carrier index: the body (in x) as parsed. */
  functions: ReadonlyMap<number, MathNode>
  /** y may appear (an implicit row, linear in y). */
  allowY: boolean
}

const DEG = Math.PI / 180

function rec(node: MathNode): Record<string, unknown> {
  return node as unknown as Record<string, unknown>
}

function argsOf(node: MathNode): MathNode[] {
  const a = rec(node).args
  return Array.isArray(a) ? (a as MathNode[]) : []
}

function fnNameOf(node: MathNode): string {
  const fn = rec(node).fn
  if (typeof fn === 'string') return fn
  if (fn && typeof fn === 'object' && 'name' in fn) return String((fn as { name?: string }).name ?? '')
  return ''
}

/** The carrier index of `nthroot(arg, -(1000 + k))`, else null. */
export function carrierIndex(node: MathNode): number | null {
  if (node.type !== 'FunctionNode' || fnNameOf(node) !== CARRIER_NAME) return null
  const [, tag] = argsOf(node)
  if (!tag || tag.type !== 'OperatorNode' || rec(tag).fn !== 'unaryMinus') return null
  const inner = argsOf(tag)[0]
  if (!inner || inner.type !== 'ConstantNode') return null
  const v = rec(inner).value
  if (typeof v !== 'number' || !Number.isInteger(v) || v < CARRIER_BASE) return null
  return v - CARRIER_BASE
}

/** sin, cos and tan at a whole number of right angles in degree mode come out exact (sin 180° is 0, not 1.2e−16). */
function quarterTurns(deg: number): number | null {
  const q = deg / 90
  const r = Math.round(q)
  return Math.abs(q - r) < 1e-12 && Math.abs(r) < 1e15 ? ((r % 4) + 4) % 4 : null
}

function sinOf(u: number, deg: boolean): number {
  if (!deg) return Math.sin(u)
  const q = quarterTurns(u)
  if (q !== null) return [0, 1, 0, -1][q]!
  return Math.sin(u * DEG)
}

function cosOf(u: number, deg: boolean): number {
  if (!deg) return Math.cos(u)
  const q = quarterTurns(u)
  if (q !== null) return [1, 0, -1, 0][q]!
  return Math.cos(u * DEG)
}

function tanOf(u: number, deg: boolean): number {
  if (!deg) return Math.tan(u)
  const q = quarterTurns(u)
  if (q !== null) return q % 2 === 0 ? 0 : Number.NaN
  return Math.tan(u * DEG)
}

function nthRootOf(a: number, n: number): number {
  if (!Number.isInteger(n) || n === 0 || Number.isNaN(a)) return Number.NaN
  const k = Math.abs(n)
  let r: number
  if (a < 0) {
    if (k % 2 === 0) return Number.NaN
    r = -(Math.pow(-a, 1 / k))
  } else {
    r = k === 2 ? Math.sqrt(a) : k === 3 ? Math.cbrt(a) : Math.pow(a, 1 / k)
  }
  if (n < 0) return r === 0 ? Number.NaN : 1 / r
  return r
}

function powOf(a: number, b: number): number {
  if (a === 0 && b < 0) return Number.NaN
  return Math.pow(a, b)
}

function factorialOf(n: number): number {
  if (!Number.isInteger(n) || n < 0) return Number.NaN
  if (n > 170) return Infinity
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

/** math.js's mod: x − y·floor(x/y); mod(x, 0) is x. */
function modOf(a: number, b: number): number {
  if (b === 0) return a
  return a - b * Math.floor(a / b)
}

const LIMIT_DEPTH = 24

interface Ctx {
  scope: CompileScope
  crit: Closure[]
  depth: number
}

/** A compiled piece: its closure, what it depends on, and its value when it depends on nothing that can change. */
interface Part {
  run: Closure
  usesX: boolean
  usesY: boolean
  /** Reads a slider or the angle mode, which change without a recompile: never folded into a number. */
  live: boolean
  /** The value of a part that depends on nothing (worked out once, at compile time). */
  value?: number
}

const constPart = (v: number): Part => ({ run: () => v, usesX: false, usesY: false, live: false, value: v })
const NOTHING: Env = { x: 0, y: 0, p: [], deg: false }

/** A part from its children: a part that depends on nothing that can change is worked out once (constant folding). */
function make(parts: readonly Part[], run: Closure, live = false): Part {
  const usesX = parts.some((p) => p.usesX)
  const usesY = parts.some((p) => p.usesY)
  const isLive = live || parts.some((p) => p.live)
  if (!usesX && !usesY && !isLive) return constPart(run(NOTHING))
  return { run, usesX, usesY, live: isLive }
}

function addCrit(ctx: Ctx, part: Part): void {
  if (part.usesX || part.usesY) ctx.crit.push(part.run)
}

function unsupported(what: string): CompileError {
  return new CompileError(`The grapher cannot draw ${what}.`)
}

function compileNode(node: MathNode, ctx: Ctx): Part {
  switch (node.type) {
    case 'ConstantNode': {
      const v = rec(node).value
      if (typeof v !== 'number') throw unsupported('that value')
      return constPart(v)
    }
    case 'SymbolNode': {
      const name = String(rec(node).name)
      if (name === 'x') return { run: (e) => e.x, usesX: true, usesY: false, live: false }
      if (name === 'y') {
        if (!ctx.scope.allowY) throw new CompileError('y cannot appear here.')
        return { run: (e) => e.y, usesX: false, usesY: true, live: false }
      }
      if (name === 'pi') return constPart(Math.PI)
      if (name === 'e') return constPart(Math.E)
      if (name === 'inf' || name === 'infinity' || name === 'oo') throw new CompileError('∞ is not a number the grapher can draw.')
      const i = ctx.scope.params.get(name)
      if (i === undefined) throw new CompileError(`The grapher does not know the letter ${name}.`)
      return { run: (e) => e.p[i]!, usesX: false, usesY: false, live: true }
    }
    case 'ParenthesisNode':
      return compileNode(rec(node).content as MathNode, ctx)
    case 'OperatorNode':
      return compileOperator(node, ctx)
    case 'FunctionNode':
      return compileFunction(node, ctx)
    case 'ConditionalNode':
      throw unsupported('a ? : choice; use a restriction like {x > 0} on each piece')
    case 'ArrayNode':
      throw unsupported('a list in square brackets')
    case 'ObjectNode':
      throw new CompileError('Put a restriction in braces at the end of the row, like y = x^2 {x > 0}.')
    default:
      throw unsupported('this')
  }
}

function compilePow(base: Part, exp: Part, ctx: Ctx, args: Part[]): Part {
  const f = base.run
  // A base that can be 0 under a negative power, or negative under a fractional one, can break the curve; a
  // whole-number power (x^2) cannot.
  const ex = exp.value
  if (ex === undefined || ex < 0 || !Number.isInteger(ex)) addCrit(ctx, base)
  if (ex !== undefined) {
    if (ex === 1) return make(args, f)
    if (ex === 2)
      return make(args, (e) => {
        const v = f(e)
        return v * v
      })
    if (ex >= 0) return make(args, (e) => Math.pow(f(e), ex))
    return make(args, (e) => {
      const v = f(e)
      return v === 0 ? Number.NaN : Math.pow(v, ex)
    })
  }
  const g = exp.run
  if (base.value !== undefined) {
    const c = base.value
    return make(args, (e) => powOf(c, g(e)))
  }
  return make(args, (e) => powOf(f(e), g(e)))
}

function compileOperator(node: MathNode, ctx: Ctx): Part {
  const fn = String(rec(node).fn)
  const args = argsOf(node).map((a) => compileNode(a, ctx))
  const [a, b] = args
  switch (fn) {
    case 'add': {
      if (args.length !== 2) {
        const runs = args.map((p) => p.run)
        return make(args, (e) => runs.reduce((s, r) => s + r(e), 0))
      }
      const f = a!.run
      const g = b!.run
      if (b!.value !== undefined) {
        const c = b!.value
        return make(args, (e) => f(e) + c)
      }
      if (a!.value !== undefined) {
        const c = a!.value
        return make(args, (e) => c + g(e))
      }
      return make(args, (e) => f(e) + g(e))
    }
    case 'subtract': {
      const f = a!.run
      const g = b!.run
      if (b!.value !== undefined) {
        const c = b!.value
        return make(args, (e) => f(e) - c)
      }
      if (a!.value !== undefined) {
        const c = a!.value
        return make(args, (e) => c - g(e))
      }
      return make(args, (e) => f(e) - g(e))
    }
    case 'multiply': {
      if (args.length !== 2) {
        const runs = args.map((p) => p.run)
        return make(args, (e) => runs.reduce((s, r) => s * r(e), 1))
      }
      const f = a!.run
      const g = b!.run
      if (a!.value !== undefined) {
        const c = a!.value
        return make(args, (e) => c * g(e))
      }
      if (b!.value !== undefined) {
        const c = b!.value
        return make(args, (e) => f(e) * c)
      }
      return make(args, (e) => f(e) * g(e))
    }
    case 'divide': {
      const f = a!.run
      const g = b!.run
      addCrit(ctx, b!)
      if (b!.value !== undefined) {
        const c = b!.value
        return c === 0 ? make(args, () => Number.NaN) : make(args, (e) => f(e) / c)
      }
      if (a!.value !== undefined) {
        const c = a!.value
        return make(args, (e) => {
          const d = g(e)
          return d === 0 ? Number.NaN : c / d
        })
      }
      return make(args, (e) => {
        const d = g(e)
        return d === 0 ? Number.NaN : f(e) / d
      })
    }
    case 'pow':
      return compilePow(a!, b!, ctx, args)
    case 'unaryMinus': {
      const f = a!.run
      return make(args, (e) => -f(e))
    }
    case 'unaryPlus':
      return a!
    case 'mod': {
      const f = a!.run
      const g = b!.run
      return make(args, (e) => modOf(f(e), g(e)))
    }
    case 'factorial': {
      const f = a!.run
      return make(args, (e) => factorialOf(f(e)))
    }
    default:
      throw unsupported(`the ${String(rec(node).op)} sign inside a row`)
  }
}

function compileCall(k: number, node: MathNode, ctx: Ctx): Part {
  const body = ctx.scope.functions.get(k)
  if (!body) throw new CompileError('That function is not defined.')
  if (ctx.depth > LIMIT_DEPTH) throw new CompileError('Your functions call each other too deeply.')
  const arg = compileNode(argsOf(node)[0]!, ctx)
  const inner: Ctx = { scope: { ...ctx.scope, allowY: false }, crit: [], depth: ctx.depth + 1 }
  const bodyPart = compileNode(body, inner)
  const run = bodyPart.run
  const at = arg.run
  // The body's own breaks, seen through the argument: f(x) = 1/x has one at x = 0, so f(x − 2) has one at x = 2.
  for (const c of inner.crit) {
    ctx.crit.push((e) => {
      const saved = e.x
      e.x = at(e)
      const v = c(e)
      e.x = saved
      return v
    })
  }
  const call: Part = {
    run: (e) => {
      const saved = e.x
      e.x = at(e)
      const v = run(e)
      e.x = saved
      return v
    },
    usesX: bodyPart.usesX ? arg.usesX : false,
    usesY: bodyPart.usesX ? arg.usesY : false,
    live: bodyPart.live || (bodyPart.usesX && arg.live),
  }
  return make([call], call.run)
}

function compileFunction(node: MathNode, ctx: Ctx): Part {
  const k = carrierIndex(node)
  if (k !== null) return compileCall(k, node, ctx)
  const name = fnNameOf(node)
  const args = argsOf(node).map((a) => compileNode(a, ctx))
  const [a, b] = args
  const single = () => {
    if (args.length !== 1) throw new CompileError(`${name} takes one input, like ${name}(x).`)
    return a!.run
  }
  switch (name) {
    case 'sqrt': {
      const r = single()
      addCrit(ctx, a!)
      return make(args, (e) => {
        const v = r(e)
        return v < 0 ? Number.NaN : Math.sqrt(v)
      })
    }
    case 'cbrt': {
      const r = single()
      return make(args, (e) => Math.cbrt(r(e)))
    }
    case 'abs': {
      const r = single()
      return make(args, (e) => Math.abs(r(e)))
    }
    case 'nthRoot':
    case 'nthroot':
    case 'root': {
      if (args.length === 1) {
        const r = a!.run
        addCrit(ctx, a!)
        return make(args, (e) => nthRootOf(r(e), 2))
      }
      if (args.length !== 2) throw new CompileError('A root takes two inputs: nthRoot(x, 3).')
      const f = a!.run
      const g = b!.run
      addCrit(ctx, a!)
      if (b!.value !== undefined) {
        const n = b!.value
        return make(args, (e) => nthRootOf(f(e), n))
      }
      return make(args, (e) => nthRootOf(f(e), g(e)))
    }
    case 'log': {
      if (args.length === 1) {
        const r = a!.run
        addCrit(ctx, a!)
        return make(args, (e) => {
          const v = r(e)
          return v > 0 ? Math.log10(v) : Number.NaN
        })
      }
      if (args.length !== 2) throw new CompileError('A log takes its input and, if you like, a base: log(x) or log_2(x).')
      const f = a!.run
      const g = b!.run
      addCrit(ctx, a!)
      if (b!.usesX || b!.usesY) {
        addCrit(ctx, b!)
        ctx.crit.push((e) => g(e) - 1)
      }
      return make(args, (e) => logBase(f(e), g(e)))
    }
    case 'ln':
    case 'log10': {
      const r = single()
      addCrit(ctx, a!)
      const log = name === 'ln' ? Math.log : Math.log10
      return make(args, (e) => {
        const v = r(e)
        return v > 0 ? log(v) : Number.NaN
      })
    }
    case 'exp': {
      const r = single()
      return make(args, (e) => Math.exp(r(e)))
    }
    case 'sin': {
      const r = single()
      return make(args, (e) => (e.deg ? sinOf(r(e), true) : Math.sin(r(e))), true)
    }
    case 'cos': {
      const r = single()
      return make(args, (e) => (e.deg ? cosOf(r(e), true) : Math.cos(r(e))), true)
    }
    case 'tan': {
      const r = single()
      if (a!.usesX || a!.usesY) ctx.crit.push((e) => cosOf(r(e), e.deg))
      return make(args, (e) => (e.deg ? tanOf(r(e), true) : Math.tan(r(e))), true)
    }
    case 'asin':
    case 'acos': {
      const r = single()
      if (a!.usesX || a!.usesY) {
        ctx.crit.push((e) => r(e) - 1)
        ctx.crit.push((e) => r(e) + 1)
      }
      const inv = name === 'asin' ? Math.asin : Math.acos
      return make(args, (e) => (e.deg ? inv(r(e)) / DEG : inv(r(e))), true)
    }
    case 'atan': {
      const r = single()
      return make(args, (e) => (e.deg ? Math.atan(r(e)) / DEG : Math.atan(r(e))), true)
    }
    case 'min':
    case 'max': {
      if (args.length === 0) throw new CompileError(`${name} needs numbers to compare.`)
      const runs = args.map((p) => p.run)
      const pick = name === 'min' ? Math.min : Math.max
      return make(args, (e) => pick(...runs.map((r) => r(e))))
    }
    case 'floor': {
      const r = single()
      return make(args, (e) => Math.floor(r(e)))
    }
    case 'ceil': {
      const r = single()
      return make(args, (e) => Math.ceil(r(e)))
    }
    case 'round': {
      const r = single()
      // math.js rounds halves away from zero (round(−2.5) is −3); Math.round rounds them up.
      return make(args, (e) => {
        const v = r(e)
        return v < 0 ? -Math.round(-v) : Math.round(v)
      })
    }
    case 'sign': {
      const r = single()
      addCrit(ctx, a!)
      return make(args, (e) => Math.sign(r(e)))
    }
    default:
      throw new CompileError(`The grapher does not know the function ${name}.`)
  }
}

/** Compile a parsed side. Throws CompileError with a sentence for her when it holds something the grapher cannot draw. */
export function compileExpression(node: MathNode, scope: CompileScope): Compiled {
  const ctx: Ctx = { scope, crit: [], depth: 0 }
  const part = compileNode(node, ctx)
  return { run: part.run, crit: ctx.crit, usesX: part.usesX, usesY: part.usesY }
}

export function makeEnv(paramCount: number, mode: AngleMode = 'rad'): Env {
  return { x: 0, y: 0, p: new Array<number>(paramCount).fill(0), deg: mode === 'deg' }
}

/** A closure as a function of x alone (y fixed at 0), reading and restoring the shared Env. */
export function inX(run: Closure, env: Env): (x: number) => number {
  return (x) => {
    env.x = x
    env.y = 0
    return run(env)
  }
}
