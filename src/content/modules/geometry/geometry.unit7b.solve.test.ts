/**
 * Unit 7, second half, solved again from what she reads. This file reads each prompt and the figure's labels with its
 * own parsers and decides every answer with plain Math, not the generators' helpers. It also requires a real triangle:
 * positive lengths, acute given angles, and the right angle where it is marked. It imports no generator code.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoPoint, ModuleId } from '@/shared/types'

const N = 300
const SEEDS = Array.from({ length: N }, (_, i) => i + 1)
const HEAVY = 120_000
const RAD = Math.PI / 180

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed}`)
  return p.answer
}

function roundAway(v: number, places: number): string {
  const f = 10 ** places
  const r = Math.floor(Math.abs(v) * f + 0.5 + 1e-9) / f
  return (v < 0 ? '-' : '') + r.toFixed(places)
}

function num(text: string): number {
  const t = text.trim().replace(/−/g, '-')
  let m = /^\((\d*)√(\d+)\)\/(\d+)$/.exec(t)
  if (m) return ((m[1] ? Number(m[1]) : 1) * Math.sqrt(Number(m[2]))) / Number(m[3])
  m = /^(\d*)√(\d+)\/(\d+)$/.exec(t)
  if (m) return ((m[1] ? Number(m[1]) : 1) * Math.sqrt(Number(m[2]))) / Number(m[3])
  m = /^(-?\d*)√(\d+)$/.exec(t)
  if (m) return (m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1])) * Math.sqrt(Number(m[2]))
  m = /^(-?\d+)\/(\d+)$/.exec(t)
  if (m) return Number(m[1]) / Number(m[2])
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  throw new Error(`not a number: ${text}`)
}

function pt(a: GeometryAnswer, id: string): GeoPoint {
  const p = a.figure.points.find((q) => q.id === id)
  if (!p) throw new Error(`no point ${id}`)
  return p
}

function len(a: GeometryAnswer, from: string, to: string): number {
  const p = pt(a, from)
  const q = pt(a, to)
  return Math.hypot(p.x - q.x, p.y - q.y)
}

function angleAt(a: GeometryAnswer, v: string, f: string, t: string): number {
  const V = pt(a, v)
  const F = pt(a, f)
  const T = pt(a, t)
  const c = ((F.x - V.x) * (T.x - V.x) + (F.y - V.y) * (T.y - V.y)) / (Math.hypot(F.x - V.x, F.y - V.y) * Math.hypot(T.x - V.x, T.y - V.y))
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}

function close(got: number, want: number) {
  expect(Math.abs(got - want) / Math.max(1, Math.abs(want))).toBeLessThan(1e-4)
}

const LEN = 'to the nearest (meter|tenth of a meter|hundredth of a meter)'
const DEG = 'to the nearest (degree|tenth of a degree)'
const placesOf = (phrase: string) => (phrase.includes('hundredth') ? 2 : phrase.includes('tenth') ? 1 : 0)

/** Sides a story may use, in meters. A tree is not 900 m and a cliff is not 2 m. Angles stay between 8° and 80°. */
const BAND: Record<string, { opp: [number, number]; adj: [number, number]; hyp: [number, number] }> = {
  tree: { opp: [4, 40], adj: [6, 80], hyp: [8, 90] },
  building: { opp: [8, 80], adj: [8, 100], hyp: [12, 130] },
  cliff: { opp: [15, 100], adj: [15, 400], hyp: [20, 420] },
  lighthouse: { opp: [15, 80], adj: [20, 400], hyp: [25, 420] },
  window: { opp: [10, 60], adj: [12, 150], hyp: [16, 170] },
  ladder: { opp: [3, 16], adj: [2, 12], hyp: [4, 16] },
  kite: { opp: [6, 60], adj: [8, 80], hyp: [15, 90] },
  ramp: { opp: [2, 8], adj: [6, 30], hyp: [6, 32] },
  guy: { opp: [6, 25], adj: [4, 30], hyp: [8, 40] },
  plane: { opp: [400, 1200], adj: [200, 2500], hyp: [500, 3000] },
}

interface Story {
  kind: string
  elev: 'elevation' | 'depression'
  asked: 'opp' | 'adj' | 'hyp' | 'angle'
  deg: number
  opp: number
  adj: number
  hyp: number
  places: number
}

function storyOf(prompt: string): Story {
  const endLen = LEN
  const endDeg = DEG
  let m: RegExpExecArray | null
  const pack = (kind: string, elev: Story['elev'], asked: Story['asked'], deg: number, opp: number, adj: number, hyp: number, places: number): Story => ({ kind, elev, asked, deg, opp, adj, hyp, places })
  m = new RegExp(`^From a point (\\d+) meters from the base of a (tree|building), the angle of elevation to the top is (\\d+)°\\. How tall is the \\2, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const adj = Number(m[1])
    const deg = Number(m[3])
    const opp = adj * Math.tan(deg * RAD)
    return pack(m[2]!, 'elevation', 'opp', deg, opp, adj, adj / Math.cos(deg * RAD), placesOf(m[4]!))
  }
  m = new RegExp(`^The angle of elevation to the top of a (tree|building) (\\d+) meters tall is (\\d+)°\\. How far is the observer from the base, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const opp = Number(m[2])
    const deg = Number(m[3])
    const adj = opp / Math.tan(deg * RAD)
    return pack(m[1]!, 'elevation', 'adj', deg, opp, adj, opp / Math.sin(deg * RAD), placesOf(m[4]!))
  }
  m = new RegExp(`^A (tree|building) is (\\d+) meters tall\\. From a point (\\d+) meters from its base, find the angle of elevation to the top, ${endDeg}\\.$`).exec(prompt)
  if (m) {
    const opp = Number(m[2])
    const adj = Number(m[3])
    return pack(m[1]!, 'elevation', 'angle', (Math.atan2(opp, adj) * 180) / Math.PI, opp, adj, Math.hypot(opp, adj), placesOf(m[4]!))
  }
  const high = '(lighthouse|building|cliff)'
  const low = '(boat|car)'
  m = new RegExp(`^From the top of a ${high} (\\d+) meters high, the angle of depression to a ${low} is (\\d+)°\\. How far is the \\3 from the base, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const opp = Number(m[2])
    const deg = Number(m[4])
    const adj = opp / Math.tan(deg * RAD)
    return pack(m[1] === 'building' ? 'window' : m[1]!, 'depression', 'adj', deg, opp, adj, opp / Math.sin(deg * RAD), placesOf(m[5]!))
  }
  m = new RegExp(`^From the top of a ${high}, the angle of depression to a ${low} (\\d+) meters from the base is (\\d+)°\\. How high is the \\1, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const adj = Number(m[3])
    const deg = Number(m[4])
    const opp = adj * Math.tan(deg * RAD)
    return pack(m[1] === 'building' ? 'window' : m[1]!, 'depression', 'opp', deg, opp, adj, adj / Math.cos(deg * RAD), placesOf(m[5]!))
  }
  m = new RegExp(`^From the top of a ${high} (\\d+) meters high, the angle of depression to a ${low} is (\\d+)°\\. How far is the \\3 along the line of sight, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const opp = Number(m[2])
    const deg = Number(m[4])
    return pack(m[1] === 'building' ? 'window' : m[1]!, 'depression', 'hyp', deg, opp, opp / Math.tan(deg * RAD), opp / Math.sin(deg * RAD), placesOf(m[5]!))
  }
  m = new RegExp(`^A ${high} is (\\d+) meters high, and a ${low} is (\\d+) meters from its base\\. Find the angle of depression from the top to the \\3, ${endDeg}\\.$`).exec(prompt)
  if (m) {
    const opp = Number(m[2])
    const adj = Number(m[4])
    return pack(m[1] === 'building' ? 'window' : m[1]!, 'depression', 'angle', (Math.atan2(opp, adj) * 180) / Math.PI, opp, adj, Math.hypot(opp, adj), placesOf(m[5]!))
  }
  m = new RegExp(`^A ladder (\\d+) meters long leans against a wall\\. The angle of elevation from the ground to the ladder is (\\d+)°\\. How high up the wall does the ladder reach, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const hyp = Number(m[1])
    const deg = Number(m[2])
    return pack('ladder', 'elevation', 'opp', deg, hyp * Math.sin(deg * RAD), hyp * Math.cos(deg * RAD), hyp, placesOf(m[3]!))
  }
  m = new RegExp(`^A ladder leans against a wall and reaches (\\d+) meters up the wall\\. The angle of elevation from the ground to the ladder is (\\d+)°\\. How long is the ladder, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const opp = Number(m[1])
    const deg = Number(m[2])
    return pack('ladder', 'elevation', 'hyp', deg, opp, opp / Math.tan(deg * RAD), opp / Math.sin(deg * RAD), placesOf(m[3]!))
  }
  m = new RegExp(`^A ladder (\\d+) meters long leans against a wall\\. The angle of elevation from the ground to the ladder is (\\d+)°\\. How far is the foot of the ladder from the wall, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const hyp = Number(m[1])
    const deg = Number(m[2])
    return pack('ladder', 'elevation', 'adj', deg, hyp * Math.sin(deg * RAD), hyp * Math.cos(deg * RAD), hyp, placesOf(m[3]!))
  }
  m = new RegExp(`^A ladder (\\d+) meters long leans against a wall and reaches (\\d+) meters up the wall\\. Find the angle of elevation from the ground to the ladder, ${endDeg}\\.$`).exec(prompt)
  if (m) {
    const hyp = Number(m[1])
    const opp = Number(m[2])
    return pack('ladder', 'elevation', 'angle', (Math.asin(opp / hyp) * 180) / Math.PI, opp, Math.sqrt(hyp * hyp - opp * opp), hyp, placesOf(m[3]!))
  }
  m = new RegExp(`^A kite string is (\\d+) meters long\\. The angle of elevation of the string is (\\d+)°\\. How high is the kite, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const hyp = Number(m[1])
    const deg = Number(m[2])
    return pack('kite', 'elevation', 'opp', deg, hyp * Math.sin(deg * RAD), hyp * Math.cos(deg * RAD), hyp, placesOf(m[3]!))
  }
  m = new RegExp(`^A kite is (\\d+) meters above the ground\\. The angle of elevation of the string is (\\d+)°\\. How long is the string, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const opp = Number(m[1])
    const deg = Number(m[2])
    return pack('kite', 'elevation', 'hyp', deg, opp, opp / Math.tan(deg * RAD), opp / Math.sin(deg * RAD), placesOf(m[3]!))
  }
  m = new RegExp(`^A kite string is (\\d+) meters long\\. The angle of elevation of the string is (\\d+)°\\. How far is the holder from the point on the ground below the kite, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const hyp = Number(m[1])
    const deg = Number(m[2])
    return pack('kite', 'elevation', 'adj', deg, hyp * Math.sin(deg * RAD), hyp * Math.cos(deg * RAD), hyp, placesOf(m[3]!))
  }
  m = new RegExp(`^A kite string is (\\d+) meters long, and the kite is (\\d+) meters above the ground\\. Find the angle of elevation of the string, ${endDeg}\\.$`).exec(prompt)
  if (m) {
    const hyp = Number(m[1])
    const opp = Number(m[2])
    return pack('kite', 'elevation', 'angle', (Math.asin(opp / hyp) * 180) / Math.PI, opp, Math.sqrt(hyp * hyp - opp * opp), hyp, placesOf(m[3]!))
  }
  m = new RegExp(`^A ramp (\\d+) meters long rises at an angle of elevation of (\\d+)°\\. How high does the ramp rise, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const hyp = Number(m[1])
    const deg = Number(m[2])
    return pack('ramp', 'elevation', 'opp', deg, hyp * Math.sin(deg * RAD), hyp * Math.cos(deg * RAD), hyp, placesOf(m[3]!))
  }
  m = new RegExp(`^A ramp rises (\\d+) meters at an angle of elevation of (\\d+)°\\. How long is the ramp, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const opp = Number(m[1])
    const deg = Number(m[2])
    return pack('ramp', 'elevation', 'hyp', deg, opp, opp / Math.tan(deg * RAD), opp / Math.sin(deg * RAD), placesOf(m[3]!))
  }
  m = new RegExp(`^A ramp is (\\d+) meters long and rises (\\d+) meters\\. Find the angle of elevation of the ramp, ${endDeg}\\.$`).exec(prompt)
  if (m) {
    const hyp = Number(m[1])
    const opp = Number(m[2])
    return pack('ramp', 'elevation', 'angle', (Math.asin(opp / hyp) * 180) / Math.PI, opp, Math.sqrt(hyp * hyp - opp * opp), hyp, placesOf(m[3]!))
  }
  m = new RegExp(`^A guy wire (\\d+) meters long runs from the top of a pole to the ground\\. The angle of elevation of the wire is (\\d+)°\\. How tall is the pole, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const hyp = Number(m[1])
    const deg = Number(m[2])
    return pack('guy', 'elevation', 'opp', deg, hyp * Math.sin(deg * RAD), hyp * Math.cos(deg * RAD), hyp, placesOf(m[3]!))
  }
  m = new RegExp(`^A pole is (\\d+) meters tall\\. A guy wire runs from its top to the ground at an angle of elevation of (\\d+)°\\. How long is the guy wire, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const opp = Number(m[1])
    const deg = Number(m[2])
    return pack('guy', 'elevation', 'hyp', deg, opp, opp / Math.tan(deg * RAD), opp / Math.sin(deg * RAD), placesOf(m[3]!))
  }
  m = new RegExp(`^A pole is (\\d+) meters tall, and a guy wire from its top to the ground is (\\d+) meters long\\. Find the angle of elevation of the wire, ${endDeg}\\.$`).exec(prompt)
  if (m) {
    const opp = Number(m[1])
    const hyp = Number(m[2])
    return pack('guy', 'elevation', 'angle', (Math.asin(opp / hyp) * 180) / Math.PI, opp, Math.sqrt(hyp * hyp - opp * opp), hyp, placesOf(m[3]!))
  }
  m = new RegExp(`^A plane flies at an altitude of (\\d+) meters\\. The angle of elevation from an observer on the ground to the plane is (\\d+)°\\. How far is the plane from the observer along the line of sight, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const opp = Number(m[1])
    const deg = Number(m[2])
    return pack('plane', 'elevation', 'hyp', deg, opp, opp / Math.tan(deg * RAD), opp / Math.sin(deg * RAD), placesOf(m[3]!))
  }
  m = new RegExp(`^The angle of elevation from an observer to a plane is (\\d+)°, and the plane is (\\d+) meters from the observer along the ground\\. How high is the plane, ${endLen}\\?$`).exec(prompt)
  if (m) {
    const deg = Number(m[1])
    const adj = Number(m[2])
    return pack('plane', 'elevation', 'opp', deg, adj * Math.tan(deg * RAD), adj, adj / Math.cos(deg * RAD), placesOf(m[3]!))
  }
  m = new RegExp(`^A plane flies at an altitude of (\\d+) meters and is (\\d+) meters from an observer along the ground\\. Find the angle of elevation to the plane, ${endDeg}\\.$`).exec(prompt)
  if (m) {
    const opp = Number(m[1])
    const adj = Number(m[2])
    return pack('plane', 'elevation', 'angle', (Math.atan2(opp, adj) * 180) / Math.PI, opp, adj, Math.hypot(opp, adj), placesOf(m[3]!))
  }
  throw new Error(`unparsed story: ${prompt}`)
}

function wanted(s: Story): number {
  if (s.asked === 'angle') return s.deg
  return s[s.asked]
}

function inBand(n: number, [lo, hi]: [number, number]) {
  expect(n).toBeGreaterThanOrEqual(lo - 1e-6)
  expect(n).toBeLessThanOrEqual(hi + 1e-6)
}

function pairs(text: string): [string, number][] {
  return [...text.matchAll(/\b([A-Z]{2}) = ([^,.]+?)(?=,| and |\.|$)/g)].map((m) => [m[1]!, num(m[2]!)])
}

function sideName(a: string, b: string): string {
  return [a, b].sort().join('')
}

function rolesOf(name: string, right: string, angle: string): { opp: string; adj: string; hyp: string } {
  const letters = name.split('')
  const hyp = sideName(letters.find((ch) => ch !== right)!, letters.filter((ch) => ch !== right)[1]!)
  const opp = sideName(...(letters.filter((ch) => ch !== angle) as [string, string]))
  const adj = sideName(angle, right)
  return { opp, adj, hyp }
}

function lookup(list: [string, number][], name: string): number | undefined {
  const key = sideName(name[0]!, name[1]!)
  return list.find(([n]) => sideName(n[0]!, n[1]!) === key)?.[1]
}

function assertRight(a: GeometryAnswer, where: string) {
  const marks = (a.figure.angles ?? []).filter((g) => g.right)
  expect(marks.length, where).toBeGreaterThan(0)
  for (const g of marks) {
    const got = angleAt(a, g.vertex, g.from, g.to)
    expect(Math.abs(got - 90), `${where} right angle at ${g.vertex}`).toBeLessThan(0.05)
  }
}

function assertDrawn(a: GeometryAnswer, from: string, to: string, want: number, where: string) {
  const got = len(a, from, to)
  expect(got, `${where} ${from}${to}`).toBeGreaterThan(0)
  close(got, want)
}

describe('tr.ratio, solved again from the labeled triangle', () => {
  it('the fraction is the ratio of the two sides the sentence names, in a real right triangle', { timeout: HEAVY }, () => {
    for (const seed of SEEDS) {
      const a = answerOf('geoTrigRatios', 'tr.ratio', seed)
      const where = `tr.ratio/${seed}`
      assertRight(a, where)
      const wrote = /^In right triangle ([A-Z]{3}), the right angle is at ([A-Z])\. (.+) Write the (sine|cosine|tangent) ratio of angle ([A-Z]) as a fraction in lowest terms\.$/.exec(a.prompt)
      const which = /^In right triangle ([A-Z]{3}), the right angle is at ([A-Z])\. (.+) Which ratio of angle ([A-Z]) uses (.+)\?$/.exec(a.prompt)
      expect(Boolean(wrote) !== Boolean(which), where).toBe(true)
      const name = (wrote ?? which)![1]!
      const right = (wrote ?? which)![2]!
      const body = (wrote ?? which)![3]!
      const angle = wrote ? wrote[5]! : which![4]!
      const given = pairs(body)
      expect(given.length, where).toBe(3)
      const roles = rolesOf(name, right, angle)
      const opp = lookup(given, roles.opp)!
      const adj = lookup(given, roles.adj)!
      const hyp = lookup(given, roles.hyp)!
      expect(opp, where).toBeGreaterThan(0)
      expect(adj, where).toBeGreaterThan(0)
      expect(hyp, where).toBeGreaterThan(opp)
      expect(hyp, where).toBeGreaterThan(adj)
      expect(Math.abs(opp * opp + adj * adj - hyp * hyp) / (hyp * hyp), where).toBeLessThan(1e-6)
      const acute = (Math.atan2(opp, adj) * 180) / Math.PI
      expect(acute, where).toBeGreaterThan(1)
      expect(acute, where).toBeLessThan(89)
      assertDrawn(a, roles.opp[0]!, roles.opp[1]!, opp, where)
      assertDrawn(a, roles.adj[0]!, roles.adj[1]!, adj, where)
      assertDrawn(a, roles.hyp[0]!, roles.hyp[1]!, hyp, where)
      const fn = wrote ? wrote[4]! : which![5]!.includes('leg that touches') && which![5]!.includes('hypotenuse') ? 'cosine' : which![5]!.includes('hypotenuse') ? 'sine' : 'tangent'
      const value = fn === 'sine' ? opp / hyp : fn === 'cosine' ? adj / hyp : opp / adj
      if (wrote) {
        expect(Math.abs(num(a.stages[0]!.answerText) - value), where).toBeLessThan(1e-9)
      } else {
        const id = fn === 'sine' ? 'sin' : fn === 'cosine' ? 'cos' : 'tan'
        expect(a.stages[0]!.answerText, where).toBe(id)
      }
      for (const s of a.figure.segments ?? []) {
        const label = s.label?.trim()
        if (label && label !== 'x' && label !== '?') expect(a.prompt.includes(label), `${where} label ${label}`).toBe(true)
      }
    }
  })
})

describe('tr.side and tr.angle, solved again from the given angle or sides', () => {
  it('the side is the ratio applied to the given side, and the asked side is marked x', { timeout: HEAVY }, () => {
    for (const seed of SEEDS) {
      const a = answerOf('geoTrigRatios', 'tr.side', seed)
      const where = `tr.side/${seed}`
      const m = /^In right triangle ([A-Z]{3}), the right angle is at ([A-Z]) and the measure of angle ([A-Z]) is (\d+)°\. ([A-Z]{2}) = (\d+)\. Find ([A-Z]{2}) to the nearest (tenth|hundredth)\.$/.exec(a.prompt)
      expect(m, a.prompt).toBeTruthy()
      const name = m![1]!
      const right = m![2]!
      const angle = m![3]!
      const deg = Number(m![4])
      const knownName = m![5]!
      const known = Number(m![6])
      const askedName = m![7]!
      const places = m![8] === 'hundredth' ? 2 : 1
      expect(deg, where).toBeGreaterThanOrEqual(1)
      expect(deg, where).toBeLessThanOrEqual(89)
      expect([30, 45, 60].includes(deg), where).toBe(false)
      const roles = rolesOf(name, right, angle)
      const knownRole = sideName(knownName[0]!, knownName[1]!) === sideName(roles.opp[0]!, roles.opp[1]!) ? 'opp' : sideName(knownName[0]!, knownName[1]!) === sideName(roles.hyp[0]!, roles.hyp[1]!) ? 'hyp' : 'adj'
      const askedRole = sideName(askedName[0]!, askedName[1]!) === sideName(roles.opp[0]!, roles.opp[1]!) ? 'opp' : sideName(askedName[0]!, askedName[1]!) === sideName(roles.hyp[0]!, roles.hyp[1]!) ? 'hyp' : 'adj'
      const opp = knownRole === 'opp' ? known : knownRole === 'hyp' ? known * Math.sin(deg * RAD) : known * Math.tan(deg * RAD)
      const adj = knownRole === 'adj' ? known : knownRole === 'hyp' ? known * Math.cos(deg * RAD) : known / Math.tan(deg * RAD)
      const hyp = knownRole === 'hyp' ? known : Math.hypot(opp, adj)
      expect(opp, where).toBeGreaterThan(0)
      expect(adj, where).toBeGreaterThan(0)
      expect(hyp, where).toBeGreaterThan(0)
      assertDrawn(a, roles.opp[0]!, roles.opp[1]!, opp, where)
      assertDrawn(a, roles.adj[0]!, roles.adj[1]!, adj, where)
      assertDrawn(a, roles.hyp[0]!, roles.hyp[1]!, hyp, where)
      const value = askedRole === 'opp' ? opp : askedRole === 'adj' ? adj : hyp
      expect(value, where).toBeGreaterThan(0)
      expect(a.stages[0]!.answerText, where).toBe(roundAway(value, places))
      assertRight(a, where)
      const marked = (a.figure.angles ?? []).find((g) => g.label && !g.right)!
      expect(marked.label, where).toBe(`${deg}°`)
      expect(Math.abs(angleAt(a, marked.vertex, marked.from, marked.to) - deg), where).toBeLessThan(0.05)
      const askedSeg = (a.figure.segments ?? []).find((s) => sideName(s.from, s.to) === sideName(askedName[0]!, askedName[1]!))
      expect(askedSeg?.label?.trim(), where).toBe('x')
      const answerN = Number(a.stages[0]!.answerText)
      const givens = [...a.prompt.matchAll(/\d+(?:\.\d+)?/g)].map((x) => Number(x[0]))
      expect(givens.some((g) => Math.abs(g - answerN) < 1e-9), where).toBe(false)
    }
  })

  it('the angle is the inverse of the ratio of the two given sides', { timeout: HEAVY }, () => {
    for (const seed of SEEDS) {
      const a = answerOf('geoTrigRatios', 'tr.angle', seed)
      const where = `tr.angle/${seed}`
      const m = /^In right triangle ([A-Z]{3}), the right angle is at ([A-Z])\. (.+) Find the measure of angle ([A-Z]) to the nearest (degree|tenth of a degree)\.$/.exec(a.prompt)
      expect(m, a.prompt).toBeTruthy()
      const roles = rolesOf(m![1]!, m![2]!, m![4]!)
      const given = pairs(m![3]!)
      expect(given.length, where).toBe(2)
      const opp = lookup(given, roles.opp)
      const adj = lookup(given, roles.adj)
      const hyp = lookup(given, roles.hyp)
      let deg: number
      if (opp !== undefined && hyp !== undefined) deg = (Math.asin(opp / hyp) * 180) / Math.PI
      else if (adj !== undefined && hyp !== undefined) deg = (Math.acos(adj / hyp) * 180) / Math.PI
      else deg = (Math.atan2(opp!, adj!) * 180) / Math.PI
      expect(deg, where).toBeGreaterThan(1)
      expect(deg, where).toBeLessThan(89)
      const places = m![5]!.startsWith('tenth') ? 1 : 0
      expect(a.stages[0]!.answerText, where).toBe(roundAway(deg, places))
      assertRight(a, where)
      const marked = (a.figure.angles ?? []).find((g) => g.label && !g.right)!
      expect(marked.label, where).toBe('?')
      expect(Math.abs(angleAt(a, marked.vertex, marked.from, marked.to) - deg), where).toBeLessThan(0.05)
      for (const s of a.figure.segments ?? []) if (s.label?.trim() === 'x') expect(s.label).not.toBe(a.stages[0]!.answerText)
    }
  })
})

describe('el.story and el.two, solved again from the story', () => {
  it('the story’s lengths stay in a sane band, and the answer is the trig of the numbers she was given', { timeout: HEAVY }, () => {
    for (const seed of SEEDS) {
      const a = answerOf('geoElevDepress', 'el.story', seed)
      const where = `el.story/${seed}`
      const s = storyOf(a.prompt)
      expect(s.deg, where).toBeGreaterThanOrEqual(8)
      expect(s.deg, where).toBeLessThanOrEqual(80)
      expect(s.opp, where).toBeGreaterThan(0)
      expect(s.adj, where).toBeGreaterThan(0)
      expect(s.hyp, where).toBeGreaterThan(0)
      const band = BAND[s.kind]!
      inBand(s.opp, band.opp)
      inBand(s.adj, band.adj)
      inBand(s.hyp, band.hyp)
      if (s.kind === 'plane') {
        for (const n of a.prompt.match(/\d+/g) ?? []) expect(Number(n), where).toBeLessThanOrEqual(900)
      }
      expect(a.stages[0]!.answerText, where).toBe(roundAway(wanted(s), s.places))
      const givens = [...a.prompt.matchAll(/\d+/g)].map((m) => Number(m[0]))
      expect(givens.some((g) => Math.abs(g - Number(a.stages[0]!.answerText)) < 1e-9), where).toBe(false)
      assertRight(a, where)
      const drawn = (a.figure.segments ?? []).filter((seg) => !seg.dashed).map((seg) => len(a, seg.from, seg.to)).sort((p, q) => p - q)
      const want = [s.opp, s.adj, s.hyp].sort((p, q) => p - q)
      expect(drawn.length, where).toBe(3)
      drawn.forEach((got, i) => close(got, want[i]!))
      if (s.elev === 'depression') {
        const dashed = (a.figure.segments ?? []).filter((seg) => seg.dashed)
        expect(dashed.length, where).toBe(1)
        const marked = (a.figure.angles ?? []).find((g) => g.label && !g.right)!
        const dash = dashed[0]!
        expect([dash.from, dash.to].includes(marked.vertex), where).toBe(true)
        const horizon = dash.from === marked.vertex ? dash.to : dash.from
        expect([marked.from, marked.to].includes(horizon), where).toBe(true)
        const foot = (a.figure.angles ?? []).find((g) => g.right)!.vertex
        expect([marked.from, marked.to].includes(foot), `${where} depression marked inside the triangle`).toBe(false)
      } else {
        expect((a.figure.segments ?? []).some((seg) => seg.dashed), where).toBe(false)
      }
      for (const seg of a.figure.segments ?? []) {
        const label = seg.label?.trim()
        if (!label || label === 'x' || label === '?') continue
        expect(a.prompt.includes(label), `${where} label ${label}`).toBe(true)
        expect(label, where).not.toBe(a.stages[0]!.answerText)
      }
    }
  })

  it('two observations share the height, and each ground piece is only its own length', { timeout: HEAVY }, () => {
    for (const seed of SEEDS) {
      const a = answerOf('geoElevDepress', 'el.two', seed)
      const where = `el.two/${seed}`
      const lenEnd = new RegExp(LEN)
      let gap = 0
      let near = 0
      let far = 0
      let how: 'add' | 'sub' = 'sub'
      let asked: 'height' | 'near' | 'far' = 'height'
      let m = /^Two observers stand on opposite sides of a tower, (\d+) meters apart\. The angles of elevation to the top are (\d+)° and (\d+)°\. (.+)$/.exec(a.prompt)
      if (m) {
        how = 'add'
        gap = Number(m[1])
        near = Number(m[2])
        far = Number(m[3])
        if (m[4]!.startsWith('How tall')) asked = 'height'
        else if (m[4]!.includes(`${near}°`)) asked = 'near'
        else asked = 'far'
      } else {
        m = /^From a point on level ground, the angle of elevation to the top of a tower is (\d+)°\. From a second point (\d+) meters (closer to|farther from) the tower, the angle of elevation is (\d+)°\. (.+)$/.exec(a.prompt)
        expect(m, a.prompt).toBeTruthy()
        how = 'sub'
        gap = Number(m![2])
        if (m![3] === 'closer to') {
          far = Number(m![1])
          near = Number(m![4])
        } else {
          near = Number(m![1])
          far = Number(m![4])
        }
        const tail = m![5]!
        asked = tail.startsWith('How tall') ? 'height' : tail.includes('closer') ? 'near' : 'far'
      }
      expect(near, where).toBeGreaterThan(far)
      expect(near, where).toBeLessThan(90)
      expect(far, where).toBeGreaterThan(0)
      const tn = Math.tan(near * RAD)
      const tf = Math.tan(far * RAD)
      const h = (gap * tn * tf) / (how === 'add' ? tn + tf : tn - tf)
      const nearDist = h / tn
      const farDist = h / tf
      const value = asked === 'height' ? h : asked === 'near' ? nearDist : farDist
      expect(h, where).toBeGreaterThan(0)
      expect(h, where).toBeLessThanOrEqual(400)
      expect(farDist, where).toBeLessThanOrEqual(800)
      const places = placesOf(lenEnd.exec(a.prompt)![1] ? a.prompt : a.prompt)
      const phrase = /to the nearest (meter|tenth of a meter|hundredth of a meter)/.exec(a.prompt)![1]!
      expect(a.stages[0]!.answerText, where).toBe(roundAway(value, placesOf(phrase)))
      assertRight(a, where)
      const right = (a.figure.angles ?? []).find((g) => g.right)!
      const vertical = [right.from, right.to].map((id) => ({ id, p: pt(a, id) })).find((q) => Math.abs(q.p.x - pt(a, right.vertex).x) < 1e-4)!
      close(len(a, right.vertex, vertical.id), h)
      for (const seg of a.figure.segments ?? []) {
        if (!seg.label) continue
        const drawn = len(a, seg.from, seg.to)
        const label = seg.label.trim()
        if (label === 'x') {
          close(drawn, value)
          continue
        }
        close(drawn, Number(label))
        if (how === 'sub' && seg.from !== vertical.id && seg.to !== vertical.id) expect(drawn).toBeLessThan(farDist - 1)
      }
      expect(places).toBeGreaterThanOrEqual(0)
    }
  })
})
