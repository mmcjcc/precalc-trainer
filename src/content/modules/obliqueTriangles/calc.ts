/**
 * Calculator steps for oblique triangles (TI-84 Plus CE and TI-Nspire CX II): DEGREE mode first wherever a trig key
 * meets an angle, then the keys for each law. The panel stays behind its button until she asks for it or finishes,
 * because these steps give the answer away.
 */
import type { CalcPanels, CalcStep } from '@/shared/types'
import { nspireMode, tiMode } from '../trig/calc'

function about(v: number): string {
  return Number(v.toFixed(4)).toString().replace(/^-/, '−')
}

const ROUND = 'Round it to the nearest tenth only now, at the very end.'

/** Every panel here: DEGREE mode first, then the steps. */
function panels(ti: CalcStep[], ns: CalcStep[], degrees = true): CalcPanels {
  return { ti84: degrees ? [tiMode('deg'), ...ti] : ti, nspire: degrees ? [nspireMode('deg'), ...ns] : ns }
}

/** The third angle, then a side by the law of sines. */
export function sinesCalc(o: { g1: number; g2: number; known: string; knownAngle: number; askedAngle: number; value: number }): CalcPanels {
  const third = { title: 'The third angle', keys: `180 − ${o.g1} − ${o.g2} → ENTER`, why: 'The angles of a triangle add to 180°.' }
  return panels(
    [third, { title: 'The side, by the law of sines', keys: `${o.known} × SIN( ${o.askedAngle} ) ÷ SIN( ${o.knownAngle} ) → ENTER`, why: `It shows about ${about(o.value)}. ${ROUND}` }],
    [{ ...third, keys: `180−${o.g1}−${o.g2} → enter` }, { title: 'The side, by the law of sines', keys: `${o.known}·sin(${o.askedAngle})/sin(${o.knownAngle}) → ctrl enter`, why: `It shows about ${about(o.value)}. ${ROUND}` }],
  )
}

/** The height h = b sin A, then B from sin⁻¹, then 180° minus it for the obtuse angle. */
export function ambiguousCalc(o: { A: number; a: string; b: string; h: number; B: number | null; obtuse: boolean }): CalcPanels {
  const ti: CalcStep[] = [{ title: 'The height h = b sin A', keys: `${o.b} × SIN( ${o.A} ) → ENTER`, why: `It shows about ${about(o.h)}. Compare it with a = ${o.a}, and compare a with b = ${o.b}.` }]
  const ns: CalcStep[] = [{ title: 'The height h = b sin A', keys: `${o.b}·sin(${o.A}) → ctrl enter`, why: `It shows about ${about(o.h)}. Compare it with a = ${o.a}, and compare a with b = ${o.b}.` }]
  if (o.B !== null) {
    ti.push({ title: 'B from sin⁻¹', keys: `2nd SIN (SIN⁻¹) ${o.b} × SIN( ${o.A} ) ÷ ${o.a} ) → ENTER`, why: `It shows about ${about(o.B)}, the acute angle. ${ROUND}`, caution: 'SIN⁻¹ only ever gives the acute angle.' })
    ns.push({ title: 'B from sin⁻¹', keys: `sin⁻¹(${o.b}·sin(${o.A})/${o.a}) → ctrl enter`, why: `sin⁻¹ is ctrl sin. It shows about ${about(o.B)}, the acute angle. ${ROUND}` })
    if (o.obtuse) {
      ti.push({ title: 'The obtuse B', keys: '180 − 2nd (−) (ANS) → ENTER', why: `It shows about ${about(180 - o.B)}: the angle with the same sine on the other side of a right angle.` })
      ns.push({ title: 'The obtuse B', keys: '180−ans → ctrl enter', why: `It shows about ${about(180 - o.B)}: the angle with the same sine on the other side of a right angle.` })
    }
  }
  return panels(ti, ns)
}

/** A side from two sides and the angle between them. */
export function sasCalc(o: { a: string; b: string; C: number; value: number }): CalcPanels {
  const why = `It shows about ${about(o.value)}. ${ROUND}`
  return panels(
    [{ title: 'The third side, by the law of cosines', keys: `2nd x² (√) ${o.a} x² + ${o.b} x² − 2 × ${o.a} × ${o.b} × COS( ${o.C} ) ) → ENTER`, why, caution: 'Close no bracket before COS: the calculator must multiply 2ab by cos C before it subtracts.' }],
    [{ title: 'The third side, by the law of cosines', keys: `√(${o.a}²+${o.b}²−2·${o.a}·${o.b}·cos(${o.C})) → ctrl enter`, why }],
  )
}

/** An angle from three sides: c is the side across from it. */
export function sssCalc(o: { a: string; b: string; c: string; value: number }): CalcPanels {
  const why = `It shows about ${about(o.value)}, the angle in degrees. ${ROUND}`
  return panels(
    [{ title: 'The angle, by the law of cosines', keys: `2nd COS (COS⁻¹) ( ${o.a} x² + ${o.b} x² − ${o.c} x² ) ÷ ( 2 × ${o.a} × ${o.b} ) ) → ENTER`, why, caution: 'Bracket the whole top and the whole bottom.' }],
    [{ title: 'The angle, by the law of cosines', keys: `cos⁻¹((${o.a}²+${o.b}²−${o.c}²)/(2·${o.a}·${o.b})) → ctrl enter`, why }],
  )
}

/** Area from two sides and the angle between them. */
export function sasAreaCalc(o: { a: string; b: string; C: number; value: number }): CalcPanels {
  const why = `It shows about ${about(o.value)}. ${ROUND}`
  return panels([{ title: 'Area = ½ab sin C', keys: `0.5 × ${o.a} × ${o.b} × SIN( ${o.C} ) → ENTER`, why }], [{ title: 'Area = ½ab sin C', keys: `0.5·${o.a}·${o.b}·sin(${o.C}) → ctrl enter`, why }])
}

/** Heron's formula: s first, then the root. No angle, so no mode. */
export function heronCalc(o: { a: string; b: string; c: string; s: number; value: number }): CalcPanels {
  const s = about(o.s)
  const why = `It shows about ${about(o.value)}. ${ROUND}`
  return panels(
    [
      { title: 'The semi-perimeter s', keys: `( ${o.a} + ${o.b} + ${o.c} ) ÷ 2 → ENTER`, why: `s is half the perimeter: ${s}.` },
      { title: 'Heron’s formula', keys: `2nd x² (√) ${s}( ${s} − ${o.a} )( ${s} − ${o.b} )( ${s} − ${o.c} ) ) → ENTER`, why },
    ],
    [
      { title: 'The semi-perimeter s', keys: `(${o.a}+${o.b}+${o.c})/2 → ctrl enter`, why: `s is half the perimeter: ${s}.` },
      { title: 'Heron’s formula', keys: `√(${s}·(${s}−${o.a})·(${s}−${o.b})·(${s}−${o.c})) → ctrl enter`, why },
    ],
    false,
  )
}

/** A right triangle: the Pythagorean theorem, or a side from an angle with SOH CAH TOA. */
export function rightCalc(o: { kind: 'legs' | 'leg'; x: string; y: string; value: number } | { kind: 'ratio'; fn: 'sin' | 'cos'; hyp: string; angle: number; value: number }): CalcPanels {
  const why = `It shows about ${about(o.value)}. ${ROUND}`
  if (o.kind === 'ratio') {
    const key = o.fn === 'sin' ? 'SIN' : 'COS'
    return panels([{ title: `The side, with ${o.fn}`, keys: `${o.hyp} × ${key}( ${o.angle} ) → ENTER`, why }], [{ title: `The side, with ${o.fn}`, keys: `${o.hyp}·${o.fn}(${o.angle}) → ctrl enter`, why }])
  }
  const op = o.kind === 'legs' ? '+' : '−'
  return panels(
    [{ title: 'The Pythagorean theorem', keys: `2nd x² (√) ${o.x} x² ${op} ${o.y} x² ) → ENTER`, why }],
    [{ title: 'The Pythagorean theorem', keys: `√(${o.x}²${op}${o.y}²) → ctrl enter`, why }],
    false,
  )
}
