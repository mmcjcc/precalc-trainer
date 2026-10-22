/**
 * sg.model: sinusoidal models. A Ferris wheel (its diameter, its center height or the platform where riders board,
 * minutes or seconds per turn, where the ride starts), tides (a high tide and the next low tide), hours of daylight over a
 * year, the average high over a year, or a day's temperature. Three parts: the model (graded as a function of t, any
 * equivalent form), its value at a time, and the first time it reaches a height, rounded as asked, with the TI-84 in
 * RADIAN mode (intersect for the time). Every number comes from the seed.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart, TrigPartTrap } from '@/content/types'
import { exactPi, q, qAdd, qNeg, tx, type Q, type Wave } from '@/engine/trig'
import { LogSkip, roundPlaces } from '../explog/text'
import { decimalTraps } from '../rightTriangle/common'
import { modelCalc } from '../trig/calc5'
import { distinctFunctionTraps, functionCheck, sameForms } from '../trig/fn5'
import { plainGraph } from '../trig/graph5'
import { m } from '../trig/text'
import type { SgDrafted } from './features'
import { SG_RULE_IDS } from './rules'
import { SG_DECIMAL_HINT, SG_MODEL_HINT } from './words'

export type Story = 'wheel' | 'tide' | 'daylight' | 'temperature' | 'dayTemp'

/** A model y = D + A·f(B(t − C)) in numbers she can read: a terminating decimal or a whole number for each. */
export interface ModelInput {
  story: Story
  /** wheel: diameter and center height (from the platform when `platform` is set), minutes or seconds a turn, start. */
  wheel?: { diameter: number; center: number; platform: number | null; period: number; seconds: boolean; start: 'bottom' | 'rising'; feet: boolean }
  /** tide: the high tide's depth and time, the low tide's depth, half the period (hours). */
  tide?: { high: Q; low: Q; at: Q; half: Q }
  /** daylight: the longest day and its hours, the shortest's hours. */
  daylight?: { longest: number; maxHours: Q; minHours: Q }
  /** temperature: the warmest month's and the coldest month's average highs (July and January). */
  temperature?: { high: number; low: number }
  /** dayTemp: the lowest temperature, its hour, the highest twelve hours later. */
  dayTemp?: { low: number; at: number; high: number }
  /** Part 2: the time asked about. Part 3: the height reached. */
  at: Q
  target: Q
}

const qNum = (v: Q) => v.n / v.d

/** A terminating rational as a decimal: 13/5 → "2.6", 7 → "7". */
export function qDec(v: Q): string {
  const x = qNum(v)
  const s = Number(x.toFixed(6)).toString()
  return s.replace('-', '-')
}
const qSayDec = (v: Q) => qDec(v).replace('-', '−')

interface Story5 {
  name: string
  wave: Wave
  /** The other ways it can start: the curve for the start-point slip. */
  startSlip: Wave
  ampSlip: { id: 'trig_amplitude_as_diameter' | 'trig_amplitude_as_span'; wave: Wave; witness: string }
  prompt: string
  modelAsk: string
  valueAsk: string
  timeAsk: string
  valuePlaces: number
  timePlaces: number
  valueUnits: string[]
  timeUnits: string[]
  unitWord: string
  timeWord: string
  period: Q
  givens: number[]
  startWitness: string
}

const half = (v: Q) => q(v.n, v.d * 2)
/** "1 foot", "2.5 feet"; "1 hour", "6.2 hours". */
const feet = (v: Q) => (qNum(v) === 1 ? 'foot' : 'feet')
const hours = (v: Q) => (qNum(v) === 1 ? 'hour' : 'hours')

function story(o: ModelInput): Story5 {
  const targetTex = m(qDec(o.target))
  if (o.story === 'wheel') {
    const w = o.wheel!
    const r = q(w.diameter, 2)
    const len = w.feet ? { one: 'foot', many: 'feet', abbr: 'ft', units: ['ft', 'feet', 'foot'] } : { one: 'meter', many: 'meters', abbr: 'm', units: ['m', 'meters', 'meter', 'metres'] }
    const time = w.seconds ? { one: 'second', many: 'seconds', abbr: 's', units: ['s', 'sec', 'seconds', 'second'] } : { one: 'minute', many: 'minutes', abbr: 'min', units: ['min', 'minutes', 'minute'] }
    const period = q(w.period)
    const B = exactPi(q(2, w.period))
    const D = q(w.center)
    const wave: Wave = w.start === 'bottom' ? { fn: 'cos', A: qNeg(r), B, C: tx(q(0)), D } : { fn: 'sin', A: r, B, C: tx(q(0)), D }
    const where =
      w.platform !== null
        ? `Riders board at its lowest point, from a platform ${m(String(w.platform))} ${w.platform === 1 ? len.one : len.many} above the ground.`
        : `Its center is ${m(String(w.center))} ${len.many} above the ground.`
    const start = w.start === 'bottom' ? `A rider boards at the bottom at ${m('t = 0')}.` : `The timer starts, at ${m('t = 0')}, as the rider passes the height of the center, going up.`
    return {
      name: 'h',
      wave,
      startSlip: w.start === 'bottom' ? { ...wave, A: r } : { ...wave, fn: 'cos' },
      ampSlip: { id: 'trig_amplitude_as_diameter', wave: { ...wave, A: w.start === 'bottom' ? q(-w.diameter) : q(w.diameter) }, witness: 'Your amplitude is the whole diameter. A rider goes up one radius above the center and down one radius below it, so the amplitude is the radius.' },
      prompt: `A Ferris wheel is ${m(String(w.diameter))} ${len.many} across. ${where} It makes one full turn every ${m(String(w.period))} ${w.period === 1 ? time.one : time.many}. ${start}`,
      modelAsk: `Write a model ${m('h(t)')} for the rider’s height above the ground, in ${len.many}, ${m('t')} ${time.many} after ${w.start === 'bottom' ? 'boarding' : 'the timer starts'}.`,
      valueAsk: `How high is the rider at ${m(`t = ${qDec(o.at)}`)}? Round to the nearest tenth of ${len.one === 'foot' ? 'a foot' : 'a meter'}.`,
      timeAsk: `When is the rider first ${targetTex} ${len.many} above the ground? Round to the nearest ${w.seconds ? 'tenth of a second' : 'hundredth of a minute'}.`,
      valuePlaces: 1,
      timePlaces: w.seconds ? 1 : 2,
      valueUnits: len.units,
      timeUnits: time.units,
      unitWord: time.many,
      timeWord: time.many,
      period,
      givens: [w.diameter, w.platform ?? w.center, w.period, qNum(o.at), qNum(o.target)],
      startWitness:
        w.start === 'bottom'
          ? 'Your model starts at its highest point: cos is largest at zero. A rider who boards at the bottom starts at the lowest height, so the cosine needs a minus sign in front.'
          : 'Your model starts at a highest or lowest point. This rider starts at the height of the center going up, which is how sin starts.',
    }
  }
  if (o.story === 'tide') {
    const t = o.tide!
    const mid = half(qAdd(t.high, t.low))
    const amp = half(qAdd(t.high, qNeg(t.low)))
    const period = q(t.half.n * 2, t.half.d)
    const B = exactPi(q(2 * period.d, period.n))
    const wave: Wave = { fn: 'cos', A: amp, B, C: tx(t.at), D: mid }
    return {
      name: 'd',
      wave,
      startSlip: { ...wave, A: qNeg(amp) },
      ampSlip: { id: 'trig_amplitude_as_span', wave: { ...wave, A: qAdd(t.high, qNeg(t.low)) }, witness: 'Your amplitude is the whole change from low tide to high tide. The amplitude is half of it: from the middle depth up to the high tide.' },
      prompt: `At a harbor the water is deepest, ${m(qDec(t.high))} ${feet(t.high)}, ${m(qDec(t.at))} ${hours(t.at)} after midnight. The next low tide, ${m(qDec(t.low))} ${feet(t.low)} deep, comes ${m(qDec(t.half))} ${hours(t.half)} later. The depth follows a sinusoid.`,
      modelAsk: `Write a model ${m('d(t)')} for the depth of the water, in feet, ${m('t')} hours after midnight.`,
      valueAsk: `How deep is the water at ${m(`t = ${qDec(o.at)}`)}? Round to the nearest tenth of a foot.`,
      timeAsk: `When, after midnight, is the water first ${targetTex} ${feet(o.target)} deep? Round to the nearest hundredth of an hour.`,
      valuePlaces: 1,
      timePlaces: 2,
      valueUnits: ['ft', 'feet', 'foot'],
      timeUnits: ['h', 'hr', 'hours', 'hour'],
      unitWord: 'hours',
      timeWord: 'hours',
      period,
      givens: [qNum(t.high), qNum(t.at), qNum(t.low), qNum(t.half), qNum(o.at), qNum(o.target)],
      startWitness: 'Your model starts at a low point at the high tide’s time. At high tide the depth is at its greatest, which is how cos starts: no minus sign in front.',
    }
  }
  if (o.story === 'daylight') {
    const d = o.daylight!
    const mid = half(qAdd(d.maxHours, d.minHours))
    const amp = half(qAdd(d.maxHours, qNeg(d.minHours)))
    const wave: Wave = { fn: 'cos', A: amp, B: exactPi(q(2, 365)), C: tx(q(d.longest)), D: mid }
    return {
      name: 'H',
      wave,
      startSlip: { ...wave, A: qNeg(amp) },
      ampSlip: { id: 'trig_amplitude_as_span', wave: { ...wave, A: qAdd(d.maxHours, qNeg(d.minHours)) }, witness: 'Your amplitude is the whole difference between the longest and the shortest day. The amplitude is half of it: from the average up to the longest day.' },
      prompt: `In one city the longest day of the year, day ${m(String(d.longest))}, has ${m(qDec(d.maxHours))} hours of daylight, and the shortest day, about half a year later, has ${m(qDec(d.minHours))} hours. The hours of daylight follow a sinusoid with a period of ${m('365')} days.`,
      modelAsk: `Write a model ${m('H(t)')} for the hours of daylight on day ${m('t')} of the year.`,
      valueAsk: `How many hours of daylight are there on day ${m(String(qNum(o.at)))}? Round to the nearest tenth of an hour.`,
      timeAsk: `On what day of the year does the city first have ${targetTex} hours of daylight? Round to the nearest day.`,
      valuePlaces: 1,
      timePlaces: 0,
      valueUnits: ['hours', 'hour', 'h', 'hr'],
      timeUnits: ['days', 'day'],
      unitWord: 'days',
      timeWord: 'days',
      period: q(365),
      givens: [d.longest, qNum(d.maxHours), qNum(d.minHours), 365, qNum(o.at), qNum(o.target)],
      startWitness: 'Your model starts at a low point on the longest day. On the longest day the hours are at their greatest, which is how cos starts: no minus sign in front.',
    }
  }
  if (o.story === 'temperature') {
    const t = o.temperature!
    const mid = q(t.high + t.low, 2)
    const amp = q(t.high - t.low, 2)
    const wave: Wave = { fn: 'cos', A: amp, B: exactPi(q(1, 6)), C: tx(q(7)), D: mid }
    return {
      name: 'T',
      wave,
      startSlip: { ...wave, A: qNeg(amp) },
      ampSlip: { id: 'trig_amplitude_as_span', wave: { ...wave, A: q(t.high - t.low) }, witness: 'Your amplitude is the whole difference between July and January. The amplitude is half of it: from the yearly average up to July.' },
      prompt: `In one city the average daily high is ${m(String(t.high))}°F in July, the warmest month, and ${m(String(t.low))}°F in January, the coldest. Let ${m('t')} be the month, with ${m('t = 1')} for January. The average high follows a sinusoid with a period of ${m('12')} months.`,
      modelAsk: `Write a model ${m('T(t)')} for the average high, in °F, in month ${m('t')}.`,
      valueAsk: `What is the average high in month ${m(`t = ${qDec(o.at)}`)}? Round to the nearest tenth of a degree.`,
      timeAsk: `When is the average high first ${targetTex}°F? Round to the nearest tenth of a month.`,
      valuePlaces: 1,
      timePlaces: 1,
      valueUnits: ['°F', 'degrees F', 'degrees', 'F'],
      timeUnits: ['months', 'month'],
      unitWord: 'months',
      timeWord: 'months',
      period: q(12),
      givens: [t.high, t.low, 7, 1, 12, qNum(o.at), qNum(o.target)],
      startWitness: 'Your model starts at a low point in July. July is the warmest month, the highest point, which is how cos starts: no minus sign in front.',
    }
  }
  const t = o.dayTemp!
  const mid = q(t.high + t.low, 2)
  const amp = q(t.high - t.low, 2)
  const wave: Wave = { fn: 'cos', A: qNeg(amp), B: exactPi(q(1, 12)), C: tx(q(t.at)), D: mid }
  return {
    name: 'T',
    wave,
    startSlip: { ...wave, A: amp },
    ampSlip: { id: 'trig_amplitude_as_span', wave: { ...wave, A: q(t.low - t.high) }, witness: 'Your amplitude is the whole difference between the low and the high. The amplitude is half of it: from the middle temperature up to the high.' },
    prompt: `On a spring day the temperature is lowest, ${m(String(t.low))}°F, at ${m(String(t.at))} a.m., and highest, ${m(String(t.high))}°F, twelve hours later. Let ${m('t')} be the hours after midnight; the temperature follows a sinusoid with a period of ${m('24')} hours.`,
    modelAsk: `Write a model ${m('T(t)')} for the temperature, in °F, ${m('t')} hours after midnight.`,
    valueAsk: `What is the temperature at ${m(`t = ${qDec(o.at)}`)}? Round to the nearest tenth of a degree.`,
    timeAsk: `When, after midnight, is the temperature first ${targetTex}°F? Round to the nearest hundredth of an hour.`,
    valuePlaces: 1,
    timePlaces: 2,
    valueUnits: ['°F', 'degrees F', 'degrees', 'F'],
    timeUnits: ['h', 'hr', 'hours', 'hour'],
    unitWord: 'hours',
    timeWord: 'hours',
    period: q(24),
    givens: [t.low, t.at, t.high, 12, 24, qNum(o.at), qNum(o.target)],
    startWitness: 'Your model starts at a high point at the coldest hour. The day starts its cycle at the low, so the cosine needs a minus sign in front.',
  }
}

/** A model's value at t, as a number; `degrees` reads B(t − C) as degrees (DEGREE mode). */
export function modelValue(w: Wave, t: number, degrees = false): number {
  const B = (w.B.c.n / w.B.c.d) * (w.B.pi === 1 ? Math.PI : 1)
  const C = w.C.c.n / w.C.c.d
  let u = B * (t - C)
  if (degrees) u = (u * Math.PI) / 180
  const f = w.fn === 'sin' ? Math.sin(u) : Math.cos(u)
  return qNum(w.A) * f + qNum(w.D)
}

/** The first two times after zero the model equals the height (by a fine scan, then bisection). */
export function crossings(f: (t: number) => number, target: number, upTo: number): number[] {
  const out: number[] = []
  const n = 4000
  let prev = f(0) - target
  for (let i = 1; i <= n && out.length < 2; i++) {
    const t = (upTo * i) / n
    const cur = f(t) - target
    if (prev === 0) out.push((upTo * (i - 1)) / n)
    else if (Math.sign(cur) !== Math.sign(prev)) {
      let a = (upTo * (i - 1)) / n
      let b = t
      for (let k = 0; k < 80; k++) {
        const mid = (a + b) / 2
        if (Math.sign(f(mid) - target) === Math.sign(f(a) - target)) a = mid
        else b = mid
      }
      out.push((a + b) / 2)
    }
    prev = cur
  }
  return out
}

function modelText(name: string, w: Wave): string {
  // The midline first, as a textbook writes a model: h(t) = 30 − 25cos(πt/2).
  const a = qNum(w.A)
  const B = w.B
  const bt = `${B.c.n === 1 ? '' : B.c.n}${B.pi === 1 ? 'π' : ''}t${B.c.d === 1 ? '' : `/${B.c.d}`}`
  const C = w.C.c.n / w.C.c.d
  const factor = `${B.c.n === 1 ? '' : B.c.n}${B.pi === 1 ? 'π' : ''}`
  const inside = C === 0 ? bt : `${B.c.d === 1 ? factor : `(${factor}/${B.c.d})`}(t ${C > 0 ? '-' : '+'} ${qDec(q(Math.abs(w.C.c.n), w.C.c.d))})`
  const D = qNum(w.D)
  const ampText = qDec(q(Math.abs(w.A.n), w.A.d))
  const lead = D === 0 ? `${a < 0 ? '-' : ''}${ampText}` : `${qDec(w.D)} ${a < 0 ? '-' : '+'} ${ampText}`
  return `${name}(t) = ${lead}${w.fn}(${inside})`
}

function modelTex(name: string, w: Wave): string {
  const a = qNum(w.A)
  const B = w.B
  const top = `${B.c.n === 1 ? '' : B.c.n}${B.pi === 1 ? '\\pi ' : ''}`
  const C = w.C.c.n / w.C.c.d
  const inside = C === 0 ? `\\frac{${top}t}{${B.c.d}}` : `\\frac{${top}}{${B.c.d}}\\left(t ${C > 0 ? '-' : '+'} ${qDec(q(Math.abs(w.C.c.n), w.C.c.d))}\\right)`
  const D = qNum(w.D)
  const ampText = qDec(q(Math.abs(w.A.n), w.A.d))
  const lead = D === 0 ? `${a < 0 ? '-' : ''}${ampText}` : `${qDec(w.D)} ${a < 0 ? '-' : '+'} ${ampText}`
  return `${name}(t) = ${lead}\\${w.fn}\\left(${B.c.d === 1 && C === 0 ? `${top}t` : inside}\\right)`
}

/** The model in TI-84 keys: "30 − 25 COS( π X,T,θ,n ÷ 2 )". */
function modelTiKeys(w: Wave): string {
  const B = w.B
  const top = `${B.c.n === 1 ? '' : `${B.c.n} `}${B.pi === 1 ? 'π ' : ''}`
  const C = w.C.c.n / w.C.c.d
  const inner = C === 0 ? `${top}X,T,θ,n ÷ ${B.c.d}` : `${top}÷ ${B.c.d} × ( X,T,θ,n ${C > 0 ? '−' : '+'} ${qDec(q(Math.abs(w.C.c.n), w.C.c.d))} )`
  const a = qNum(w.A)
  const D = qNum(w.D)
  const amp = qDec(q(Math.abs(w.A.n), w.A.d))
  const fn = w.fn === 'sin' ? 'SIN' : 'COS'
  const lead = D === 0 ? (a < 0 ? '(−) ' : '') : `${qDec(w.D)} ${a < 0 ? '−' : '+'} `
  return `${lead}${amp} ${fn}( ${inner} )`
}

/** The sg.model problem (exported for the hand-worked tests). */
export function modelProblem(o: ModelInput): SgDrafted {
  const s = story(o)
  const w = s.wave
  const P = qNum(s.period)
  const t0 = w.C.c.n / w.C.c.d
  const answerText = modelText(s.name, w)
  const keyTs = [0, 1, 2, 3, 4].map((i) => tx(qAdd(w.C.c.d === 1 && w.C.c.n === 0 ? q(0) : w.C.c, q(i * s.period.n, 4 * s.period.d))))
  const check = functionCheck(answerText, 't', keyTs, 0, 2 * P)
  const slipModel = (wave: Wave) => modelText(s.name, wave)
  const modelTraps: TrigPartTrap[] = distinctFunctionTraps(check, [
    { id: s.ampSlip.id, text: slipModel(s.ampSlip.wave), witness: s.ampSlip.witness },
    { id: 'trig_midline_zero', text: slipModel({ ...w, D: q(0) }), witness: 'Your model has no midline: it swings around zero. Add the middle value, halfway between the highest and the lowest.' },
    { id: 'trig_b_as_period', text: slipModel({ ...w, B: tx(s.period) }), witness: 'Your model puts the period where B goes. B is 2π divided by the period, so one cycle takes exactly one period.' },
    { id: 'trig_model_start_point', text: slipModel(s.startSlip), witness: s.startWitness },
    ...(t0 !== 0 ? [{ id: 'trig_shift_wrong_way' as const, text: slipModel({ ...w, C: tx(q(-w.C.c.n, w.C.c.d)) }), witness: 'Your model is shifted the wrong way. The high point at a time c means t − c inside, which is zero at t = c.' }] : []),
  ])
  const forms = sameForms(check, [
    answerText.replace(/^(\w)\(t\)/, '$1'),
    answerText.replace(/π/g, 'pi'),
    modelText(s.name, w.fn === 'cos' ? { ...w, fn: 'sin', C: tx(qAdd(w.C.c, q(-s.period.n, 4 * s.period.d))) } : { ...w, fn: 'cos', C: tx(qAdd(w.C.c, q(s.period.n, 4 * s.period.d))) }),
  ])
  const model: TrigPart = {
    id: 'model',
    kind: 'function',
    label: 'Model',
    ask: s.modelAsk,
    formatHint: SG_MODEL_HINT,
    nudge: `The midline is the average of the highest and lowest values and the amplitude is half their difference; ${m('B = \\frac{2\\pi}{P}')} for the period ${m('P')}. Start the curve the way the story starts.`,
    ruleCard: SG_RULE_IDS.model,
    reveal: [`The midline is ${m(qDec(w.D))}, the amplitude ${m(qDec(q(Math.abs(w.A.n), w.A.d)))}, and ${m(`B = \\frac{2\\pi}{${qDec(s.period)}}`)}: ${m(modelTex(s.name, w))}.`],
    answerText,
    forms,
    check,
    wrongNote: 'That model does not fit the story. Check the midline, the amplitude, the period and how the curve starts.',
    traps: modelTraps,
  }

  // Part 2: the value at a time.
  const at = qNum(o.at)
  const v = modelValue(w, at)
  const vText = roundPlaces(v, s.valuePlaces)
  const valueSlips = [{ id: 'trig_degree_mode' as const, value: modelValue(w, at, true), witness: 'That is what the calculator gives in DEGREE mode: it read the inside of the cosine as degrees. Press MODE, choose RADIAN, and work it out again.' }]
  const value: TrigPart = {
    id: 'value',
    kind: 'decimal',
    label: 'Value',
    ask: s.valueAsk,
    formatHint: SG_DECIMAL_HINT,
    nudge: `Put ${m(`t = ${qDec(o.at)}`)} into your model, with the calculator in RADIAN mode.`,
    ruleCard: SG_RULE_IDS.model,
    reveal: [`${m(`${s.name}(${qDec(o.at)}) \\approx ${v.toFixed(4)}`)}, which rounds to ${m(vText)}.`],
    answerText: vText,
    forms: [],
    check: { kind: 'decimal', value: v, places: s.valuePlaces, units: s.valueUnits },
    wrongNote: 'That is not the value at that time. Put the time into your model in RADIAN mode.',
    traps: decimalTraps(v, s.valuePlaces, valueSlips),
  }

  // Part 3: the first time it reaches the target.
  const target = qNum(o.target)
  const f = (t: number) => modelValue(w, t)
  const [first, second] = crossings(f, target, 1.6 * P)
  if (first === undefined || second === undefined) throw new LogSkip('the height is not reached twice in the first cycle')
  const tText = roundPlaces(first, s.timePlaces)
  const degTimes = crossings((t) => modelValue(w, t, true), target, 400 * P)
  const timeSlips = [
    ...(degTimes[0] !== undefined ? [{ id: 'trig_degree_mode' as const, value: degTimes[0], witness: 'That is the time the calculator finds in DEGREE mode, where the model barely moves. Press MODE, choose RADIAN, and find the crossing again.' }] : []),
    { id: 'trig_model_later_time' as const, value: second, witness: 'That is the second time it reaches that height. The first time comes earlier: look for the first crossing after the start.' },
  ]
  const time: TrigPart = {
    id: 'time',
    kind: 'decimal',
    label: 'First time',
    ask: s.timeAsk,
    formatHint: SG_DECIMAL_HINT,
    nudge: `Graph ${m('Y_1')} = your model and ${m('Y_2')} = the height in RADIAN mode, and use intersect near the first crossing after ${m('t = 0')}.`,
    ruleCard: SG_RULE_IDS.model,
    reveal: [`The model first equals ${m(qDec(o.target))} at ${m(`t \\approx ${first.toFixed(4)}`)}, which rounds to ${m(tText)}.`],
    answerText: tText,
    forms: [],
    check: { kind: 'decimal', value: first, places: s.timePlaces, units: s.timeUnits },
    wrongNote: 'That is not the first time. Solve model = height on the calculator, in RADIAN mode, and take the earliest crossing after zero.',
    traps: decimalTraps(first, s.timePlaces, timeSlips),
  }

  const lo = qNum(w.D) - Math.abs(qNum(w.A))
  const hi = qNum(w.D) + Math.abs(qNum(w.A))
  const pad = (hi - lo) * 0.15 + 1
  const yWindow: [number, number] = [Math.min(0, lo - pad), hi + pad]
  const step = (span: number) => [0.5, 1, 2, 5, 10, 20, 25, 50, 100].find((x) => span / x <= 10) ?? 200
  // One period, or a little more when a labelled point lies past it: a gentler curve leaves room for the labels.
  const right = Math.max(P, at + P / 6, first + P / 6)
  const graph = plainGraph(f, {
    window: [0, right],
    yWindow,
    ticks: { xStep: step(right), yStep: step(yWindow[1] - yWindow[0]) },
    markers: [
      { x: at, y: v, label: `(${qSayDec(o.at)}, ${vText.replace('-', '−')})` },
      { x: first, y: target, label: `(${tText}, ${qSayDec(o.target)})` },
    ],
  })
  const tiModel = modelTiKeys(w)
  return {
    question: 'model',
    prompt: s.prompt,
    figure: { kind: 'none', deg: 0, label: '', ariaLabel: '' },
    stages: [model, value, time],
    promisable: [...model.traps, ...value.traps, ...time.traps],
    calc: modelCalc({ tiModel, nsModel: modelText(s.name, w).replace(/^.*= /, '').replace(/t/g, 'x'), period: P, ylo: yWindow[0], yhi: yWindow[1], at, height: target, unitWord: s.unitWord }),
    ruleCards: [SG_RULE_IDS.model, SG_RULE_IDS.amplitude, SG_RULE_IDS.period],
    graph,
    givens: s.givens.map((g) => ({ value: g, sources: [] })),
  }
}

// ---------------------------------------------------------------------------
// Drawing from the seed
// ---------------------------------------------------------------------------

/** A time strictly inside the first cycle, away from its quarter points (where the value is a given height). */
function drawAt(rng: Rng, period: number, places: number, offset = 0): Q {
  for (let i = 0; i < 60; i++) {
    const f = 0.06 + 0.88 * rng.next()
    const raw = offset + f * period
    const t = Number(raw.toFixed(places))
    const phase = (((t - offset) / period) * 4) % 1
    if (Math.min(phase, 1 - phase) < 0.12) continue
    return places === 0 ? q(Math.round(t)) : q(Math.round(t * 10 ** places), 10 ** places)
  }
  throw new LogSkip('no time to ask about')
}

/** A height strictly between the lowest and highest, away from the midline and the ends, in steps of `step`. */
function drawTarget(rng: Rng, mid: number, amp: number, step: number): Q {
  for (let i = 0; i < 60; i++) {
    const frac = 0.2 + 0.6 * rng.next()
    const raw = mid + (rng.chance(0.5) ? 1 : -1) * frac * amp
    const v = Math.round(raw / step) * step
    if (Math.abs(v - mid) < 0.15 * amp || Math.abs(v - mid) > 0.85 * amp) continue
    const k = Math.round(v / step)
    return step === 1 ? q(k) : q(k, Math.round(1 / step))
  }
  throw new LogSkip('no height to ask about')
}

export function drawModel(rng: Rng): SgDrafted {
  const story = rng.pick(['wheel', 'wheel', 'wheel', 'tide', 'tide', 'daylight', 'temperature', 'dayTemp'] as const)
  if (story === 'wheel') {
    const feet = rng.chance(0.4)
    const diameter = feet ? rng.pick([50, 64, 80, 90, 100, 120, 136, 150, 160]) : rng.pick([30, 40, 50, 56, 60, 64, 70, 76, 80, 90, 100])
    const platform = rng.chance(0.45) ? (feet ? rng.int(2, 12) : rng.int(1, 5)) : null
    const center = platform !== null ? platform + diameter / 2 : diameter / 2 + (feet ? rng.int(3, 20) : rng.int(2, 10))
    const seconds = rng.chance(0.25)
    const period = seconds ? rng.pick([30, 40, 45, 50, 60, 72, 80, 90, 120]) : rng.pick([2, 3, 4, 5, 6, 8, 10, 12, 15, 20])
    const start = rng.chance(0.7) ? ('bottom' as const) : ('rising' as const)
    const at = drawAt(rng, period, seconds ? 0 : 1)
    const target = drawTarget(rng, center, diameter / 2, 1)
    return modelProblem({ story, wheel: { diameter, center, platform, period, seconds, start, feet }, at, target })
  }
  if (story === 'tide') {
    const mid = rng.int(40, 90) / 10
    const amp = rng.int(15, Math.min(45, Math.floor(mid * 10) - 5)) / 10
    const tenths = (v: number) => q(Math.round(v * 10), 10)
    const high = tenths(mid + amp)
    const low = tenths(mid - amp)
    const at = q(rng.pick([0, 1, 1.5, 2, 2.5, 3, 4, 4.5, 5]) * 2, 2)
    const halfPeriod = rng.chance(0.75) ? q(6) : q(31, 5)
    const period = (2 * halfPeriod.n) / halfPeriod.d
    const t2 = drawAt(rng, period, 1, at.n / at.d)
    const target = drawTarget(rng, mid, amp, 0.5)
    return modelProblem({ story, tide: { high, low, at, half: halfPeriod }, at: t2, target })
  }
  if (story === 'daylight') {
    const maxHours = q(rng.int(140, 156), 10)
    const minHours = q(rng.int(86, 100), 10)
    const longest = rng.pick([171, 172, 173])
    const mid = (maxHours.n / maxHours.d + minHours.n / minHours.d) / 2
    const amp = (maxHours.n / maxHours.d - minHours.n / minHours.d) / 2
    const at = q(rng.pick([20, 35, 45, 60, 75, 100, 110, 140, 200, 230, 250, 290, 310, 330]))
    const target = drawTarget(rng, mid, amp, 0.5)
    return modelProblem({ story, daylight: { longest, maxHours, minHours }, at, target })
  }
  if (story === 'temperature') {
    const high = rng.int(78, 96)
    const low = high - 2 * rng.int(14, 26)
    const at = q(rng.pick([2, 3, 5, 6, 8, 9, 11, 12]))
    const target = drawTarget(rng, (high + low) / 2, (high - low) / 2, 1)
    return modelProblem({ story, temperature: { high, low }, at, target })
  }
  const low = rng.int(38, 60)
  const high = low + 2 * rng.int(6, 14)
  const atHour = rng.pick([3, 4, 5, 6])
  const at = drawAt(rng, 24, 1)
  const target = drawTarget(rng, (high + low) / 2, (high - low) / 2, 1)
  return modelProblem({ story: 'dayTemp', dayTemp: { low, at: atHour, high }, at, target })
}

