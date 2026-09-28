import { problemId } from '@/content/registry'
import type { DifficultyKnobs, ProblemInstance, TransformParent } from '@/content/types'
import type { TransformDraft } from './draft'
import {
  describeTransform,
  explicitFormula,
  fNotation,
  gradeMappedPoint,
  graphWindow,
  mapPoint,
  PARENTS,
  parentFormula,
  type ExactPoint,
  type StatementForm,
  type TransformSpec,
} from '@/engine'
import { ratToString } from '@/notation'
import type { CalcPanels } from '@/shared/types'

const NO_CALC: CalcPanels = { ti84: [], nspire: [] }

function show(text: string): string {
  return text.replace(/-/g, '−')
}

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

export interface TransformBuild {
  question: 'describe' | 'point' | 'equation'
  templateId: string
  version: number
  seed: number
  knobs: DifficultyKnobs
  title: string
  instructions: string
  draft: TransformDraft
  nudge: string
  ruleCard: string
  ruleCards: string[]
}

function imageOf(spec: TransformSpec, point: ExactPoint, form: StatementForm): { text: string; message: string } {
  const image = mapPoint(spec, point)
  const text = `(${ratToString(image.x)}, ${ratToString(image.y)})`
  const g = gradeMappedPoint(spec, point, text, { form })
  return { text, message: g.verdict === 'correct' ? g.message : `The image is ${show(text)}.` }
}

export function buildTransform(d: TransformBuild): ProblemInstance {
  const { spec, form, trap, point } = d.draft
  const described = describeTransform(spec, { form })
  const sentences = described.map((s) => s.sentence)
  const formula = explicitFormula(spec)
  const notation = d.question === 'equation' ? '' : fNotation(spec, form)
  const parent = spec.parent
  const words = PARENTS[parent].words
  const fText = parentFormula(parent)
  const stepLines = described.map((s) => `${cap(s.sentence)}: ${s.reason}.`)

  let sourcePoint: string | undefined
  let imagePoint: string | undefined
  let reveal = stepLines
  if (point) {
    sourcePoint = `(${ratToString(point.x)}, ${ratToString(point.y)})`
    const mapped = imageOf(spec, point, form)
    imagePoint = mapped.text
    reveal = [mapped.message, ...stepLines]
  }
  if (d.question === 'equation') reveal = [`g(x) = ${show(formula)}.`, ...stepLines]

  const statement =
    d.question === 'describe'
      ? `Let f(x) = ${fText}. g(x) = ${notation}.`
      : d.question === 'point'
        ? `${sourcePoint} is on the graph of f, where f(x) = ${fText}. g(x) = ${notation}. What point is on the graph of g?`
        : `f(x) = ${fText} (${words}). g is f after: ${sentences.join('; ')}. Write g(x) as a formula in x.`

  const reciprocal = parent === 'reciprocal'

  return {
    id: problemId('transformations', d.templateId, d.version, d.seed),
    moduleId: 'transformations',
    templateId: d.templateId,
    skill: d.templateId,
    genVersion: d.version,
    seed: d.seed >>> 0,
    knobs: d.knobs,
    kind: 'transformations',
    title: d.title,
    instructions: d.instructions,
    statementText: statement,
    vars: ['x'],
    start: null,
    canonical: [],
    answer: {
      type: 'transformations',
      question: d.question,
      parent: parent as TransformParent,
      parentFormula: fText,
      parentWords: words,
      a: ratToString(spec.a),
      b: ratToString(spec.b),
      h: ratToString(spec.h),
      k: ratToString(spec.k),
      form,
      notation,
      formula,
      sentences,
      sourcePoint,
      imagePoint,
      nudge: d.nudge,
      ruleCard: d.ruleCard,
      ruleCards: d.ruleCards,
      reveal,
      trap,
    },
    graph: {
      kind: 'function',
      f: fText,
      fColor: 'gray',
      ...(reciprocal ? { fBreaks: [0] } : {}),
      extra: [
        {
          expr: formula,
          label: 'g',
          style: 'solid' as const,
          color: 'coral' as const,
          ...(reciprocal ? { breaks: [spec.h.n / spec.h.d] } : {}),
        },
      ],
      xDomain: graphWindow(spec),
    },
    calc: NO_CALC,
    params: {
      trap,
      parent,
      form,
      question: d.question,
      ...(point ? { px: ratToString(point.x), py: ratToString(point.y) } : {}),
    },
  }
}
