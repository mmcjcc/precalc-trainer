import { useMemo, useState } from 'react'
import type { ProblemInstance } from '@/content/types'
import { toLatex } from '@/notation'
import { buildWorkedExample, type WorkedExample as WorkedExampleData } from '@/problem/workedExample'
import { Katex } from './Katex'

function safeTex(text: string): string {
  try {
    return toLatex(text)
  } catch {
    return ''
  }
}

function isProseStatement(text: string): boolean {
  // Word problems and chemistry prompts are prose sentences rather than bare algebra expressions.
  return text.includes(' ') && /[A-Za-z]{4,}/.test(text) && !/^[fgh]\(x\)\s*=/.test(text.trim())
}

type Props = {
  instance: ProblemInstance
}

/**
 * "Example — see one like it": a worked solution of a sibling problem (same module and template,
 * different seed, never her numbers).
 * - Line-by-line types: shows the sibling's starting line and reveals one walked step at a time on
 *   each "Next line" tap, with each step's reason in the module's own hint/rule wording.
 * - Answer / parts types: shows the sibling's statement and each part with its answer and the part's
 *   hint as the why.
 */
export function WorkedExample({ instance }: Props) {
  const [offset, setOffset] = useState(1)
  const example = useMemo<WorkedExampleData | null>(() => buildWorkedExample(instance, offset), [instance, offset])
  // Key revealedCount to the current sibling id so switching problems or offsets resets the walk to line 0.
  const siblingId = example?.sibling.id ?? ''
  const [walkState, setWalkState] = useState<{ id: string; count: number }>({ id: siblingId, count: 0 })
  const revealedCount = walkState.id === siblingId ? walkState.count : 0

  if (!example) return null

  const { sibling } = example
  const prose = isProseStatement(sibling.statementText)
  const statementTex = prose ? '' : safeTex(sibling.statementText)

  const revealNextLine = () => {
    if (example.kind !== 'steps') return
    setWalkState({
      id: siblingId,
      count: Math.min(example.lines.length, revealedCount + 1),
    })
  }

  const showAnother = () => {
    setOffset((n) => n + 1)
  }

  return (
    <div data-worked-example="" data-example-kind={example.kind} className="space-y-3 text-navy">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-coral-700">
          Similar problem · not your numbers
        </p>
        <button
          type="button"
          onClick={showAnother}
          className="min-h-9 rounded-lg border border-navy-100 bg-white px-2.5 text-xs font-semibold text-navy hover:bg-navy-50"
        >
          Another example
        </button>
      </div>

      <div
        data-example-statement=""
        data-sibling-seed={sibling.seed}
        className="rounded-xl bg-gold-100 px-3.5 py-2.5 text-navy"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">{sibling.title}</p>
        {statementTex ? (
          <div className="mt-1">
            <Katex tex={statementTex} display />
            <span className="sr-only" data-example-statement-text="">
              {sibling.statementText}
            </span>
          </div>
        ) : (
          <p className="mt-1 text-sm font-medium text-navy" data-example-statement-text="">
            {sibling.statementText}
          </p>
        )}
        {example.kind === 'parts' &&
          example.prompt &&
          example.prompt.trim() !== sibling.statementText.trim() && (
            <p className="mt-1 text-xs text-navy/80">{example.prompt}</p>
          )}
      </div>

      {example.kind === 'steps' ? (
        <div className="space-y-3">
          <ol className="space-y-2" aria-label="Example steps">
            <li
              data-example-start=""
              className="flex items-start gap-3 rounded-xl border border-navy-100 bg-navy-50 px-3 py-2"
            >
              <span className="mt-0.5 w-12 shrink-0 text-xs font-semibold uppercase tracking-wide text-navy/60">
                start
              </span>
              <div className="min-w-0 flex-1 overflow-x-auto text-sm text-navy">
                {safeTex(example.startLine) ? (
                  <>
                    <Katex tex={safeTex(example.startLine)} />
                    <span className="sr-only">{example.startLine}</span>
                  </>
                ) : (
                  <span>{example.startLine}</span>
                )}
              </div>
            </li>

            {example.lines.slice(0, revealedCount).map((line) => {
              const lineTex = safeTex(line.displayText)
              return (
                <li
                  key={line.index}
                  data-example-step={line.index}
                  data-example-line-text={line.text}
                  className="space-y-1.5 rounded-xl border border-navy-100 bg-white px-3 py-2.5"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-12 shrink-0 text-xs font-semibold uppercase tracking-wide text-navy/60">
                      line {line.index}
                    </span>
                    <div className="min-w-0 flex-1 overflow-x-auto text-sm font-semibold text-navy">
                      {lineTex ? (
                        <>
                          <Katex tex={lineTex} />
                          <span className="sr-only">{line.displayText}</span>
                        </>
                      ) : (
                        <span>{line.displayText}</span>
                      )}
                    </div>
                  </div>
                  <div
                    data-example-reason=""
                    className="rounded-lg bg-navy-50 px-2.5 py-1.5 text-xs text-navy/90"
                  >
                    {line.ruleTitle && <span className="font-semibold text-navy">{line.ruleTitle}: </span>}
                    <span>{line.nudge}</span>
                  </div>
                </li>
              )
            })}
          </ol>

          {revealedCount < example.lines.length ? (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={revealNextLine}
                data-example-next-line=""
                className="min-h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-600"
              >
                Next line
              </button>
              <span className="text-xs font-medium text-navy/70">
                {revealedCount} of {example.lines.length} {example.lines.length === 1 ? 'line' : 'lines'} shown
              </span>
            </div>
          ) : (
            example.conclusion && (
              <div
                data-example-conclusion=""
                className="space-y-1 rounded-xl border border-ok bg-ok-100 px-3 py-2.5 text-sm text-navy"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-ok">
                  ✓ {example.conclusion.label}
                </p>
                {example.conclusion.items.map((item) => (
                  <p key={item.label} className="font-medium text-navy">
                    <span className="font-semibold">{item.label}:</span> {item.value}
                  </p>
                ))}
              </div>
            )
          )}
        </div>
      ) : (
        <ol className="space-y-2.5" aria-label="Example parts">
          {example.parts.map((part) => (
            <li
              key={part.id}
              data-example-part={part.id}
              className="space-y-1.5 rounded-xl border border-navy-100 bg-white px-3 py-2.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-navy/70">{part.label}</span>
                <span
                  data-example-part-answer=""
                  className="rounded-lg bg-ok-100 px-2 py-0.5 text-sm font-semibold text-navy"
                >
                  {part.answer}
                </span>
              </div>
              {part.ask && <p className="text-xs text-navy/80">{part.ask}</p>}
              <div
                data-example-part-why=""
                className="rounded-lg bg-navy-50 px-2.5 py-1.5 text-xs text-navy/90"
              >
                {part.ruleTitle && <span className="font-semibold text-navy">{part.ruleTitle}: </span>}
                <span>{part.why}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
