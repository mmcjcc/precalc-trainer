import { useDeferredValue, useId, useMemo, useState, type ReactNode } from 'react'
import { Katex } from '@/components/Katex'
import { MathInput } from '@/components/MathInput'
import { parseStatement, verifyStep } from '@/engine'
import { toLatex } from '@/notation'
import { CHIP_LABEL, type ParseError, type StepResult, type VarName } from '@/shared/types'

const VARS: VarName[] = ['x', 'y', 'n']

const EXAMPLES: { label: string; prev: string; next: string; allowSwap?: boolean }[] = [
  { label: 'Divide by a negative', prev: '-14 <= -14x', next: '1 <= x' },
  { label: 'Distribute', prev: '2(x - 3) > 4', next: '2x - 3 > 4' },
  { label: 'Square root', prev: 'x^2 = 9', next: 'x = 3' },
  { label: 'Swap x and y', prev: 'y = cbrt(x) + 1', next: 'x = cbrt(y) + 1', allowSwap: true },
]

const VERDICT_WORDS: Record<StepResult['verdict'], string> = {
  equivalent: 'same solutions',
  equivalent_by_rename: 'same relation with x and y renamed',
  extraneous_superset: 'the new line picks up extra solutions',
  lost_subset: 'the new line lost solutions',
  not_equivalent: 'different solutions',
  undecidable: 'the checker could not decide',
  parse_error: 'a line could not be read',
}

type Outcome = { kind: 'result'; result: StepResult } | { kind: 'crash'; message: string }

function tex(text: string): string {
  try {
    return toLatex(text)
  } catch {
    return ''
  }
}

function ErrorCaret({ text, error }: { text: string; error: ParseError }) {
  const len = Math.max(1, error.length ?? 1)
  const at = Math.min(Math.max(0, error.position), text.length)
  const bad = text.slice(at, at + len)
  return (
    <code className="mt-1 block overflow-x-auto whitespace-pre rounded-lg bg-navy-50 px-2 py-1 font-mono text-navy">
      {text.slice(0, at)}
      <mark className="rounded bg-gold px-0.5 text-navy underline decoration-bad decoration-wavy">{bad || ' '}</mark>
      {text.slice(at + len)}
    </code>
  )
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-navy/70">{term}</dt>
      <dd className="mt-0.5 text-navy">{children}</dd>
    </div>
  )
}

function ResultView({ result, prev, next }: { result: StepResult; prev: string; next: string }) {
  const errorOnCurrent = result.parseError ? !parseStatement(prev, VARS).ok : false
  return (
    <div className="space-y-3">
      <div className={`rounded-xl border-l-4 bg-white p-3 ring-1 ring-navy-100 ${result.ok ? 'border-ok' : 'border-bad'}`}>
        <p className="text-lg font-semibold text-navy">
          <span aria-hidden className={result.ok ? 'text-ok' : 'text-bad'}>
            {result.ok ? '✓' : '✗'}{' '}
          </span>
          {result.ok ? (result.caveat ? 'Accepted — with a check at the end' : 'Accepted') : 'Not accepted'}
        </p>
        <p className="mt-0.5 text-sm text-navy">
          Verdict <code className="rounded bg-navy-50 px-1 font-mono">{result.verdict}</code>: {VERDICT_WORDS[result.verdict]}.
        </p>
      </div>

      <dl className="divide-y divide-navy-100 rounded-xl border border-navy-100 bg-white px-3">
        {result.parseError && (
          <Row term={`Parse error in the ${errorOnCurrent ? 'current' : 'proposed'} line`}>
            <p>
              {result.parseError.message} (at character {result.parseError.position + 1})
            </p>
            <ErrorCaret text={errorOnCurrent ? prev : next} error={result.parseError} />
          </Row>
        )}
        {result.detected && (
          <Row term="Detected move">
            <p>{result.detected.detail}</p>
            <p className="mt-0.5 text-sm text-navy/80">
              Chip: {CHIP_LABEL[result.detected.chip]} ·{' '}
              {result.detected.exact ? 'this exact chip is required' : 'any rewrite chip is accepted'}
            </p>
          </Row>
        )}
        <Row term="Acceptable chips">
          {result.acceptableChips.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {result.acceptableChips.map((c) => (
                <li key={c} className="rounded-full bg-navy-50 px-2.5 py-0.5 text-sm">
                  {CHIP_LABEL[c]}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-navy/80">none — no move was detected</span>
          )}
        </Row>
        {result.pattern && (
          <Row term="Error pattern">
            <p className="font-semibold">{result.pattern.title}</p>
            <p className="mt-0.5">{result.pattern.lesson}</p>
            <p className="mt-0.5 font-mono text-sm text-navy/80">{result.pattern.example}</p>
            {result.pattern.witness && <p className="mt-0.5 text-sm">This time: {result.pattern.witness}</p>}
          </Row>
        )}
        {result.counterexample && (
          <Row term="Counterexample">
            <p>{result.counterexample.message}</p>
          </Row>
        )}
        {(result.caveat || result.restriction) && (
          <Row term="Caveat">
            {result.caveat === 'extraneous_check' && (
              <p>This move can add solutions, so check every answer in the original line at the end.</p>
            )}
            {result.restriction && (
              <p>
                Restriction to keep: <code className="font-mono">{result.restriction}</code>
              </p>
            )}
          </Row>
        )}
        {result.swapped && (
          <Row term="Swap">
            <p>This step was the one x ↔ y swap of an inverse problem.</p>
          </Row>
        )}
        {result.normalized && (
          <Row term="Stored as">
            <Katex tex={result.normalized.latex} />
            <code className="ml-2 font-mono text-sm text-navy/80">{result.normalized.text}</code>
          </Row>
        )}
      </dl>
    </div>
  )
}

export function Sandbox() {
  const [prev, setPrev] = useState('-14 <= -14x')
  const [next, setNext] = useState('')
  const [allowSwap, setAllowSwap] = useState(false)
  const prevId = useId()
  const swapId = useId()
  const dPrev = useDeferredValue(prev)
  const dNext = useDeferredValue(next)

  const outcome = useMemo<Outcome | null>(() => {
    if (!dNext.trim() || !dPrev.trim()) return null
    try {
      return { kind: 'result', result: verifyStep(dPrev, dNext, { vars: VARS, seed: 1, allowSwap }) }
    } catch (e) {
      return { kind: 'crash', message: e instanceof Error ? e.message : String(e) }
    }
  }, [dPrev, dNext, allowSwap])

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-navy">Sandbox</h1>
        <p className="text-navy/80">
          Type a current line and a proposed next line to see exactly what the step checker decides, and why.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => {
              setPrev(ex.prev)
              setNext(ex.next)
              setAllowSwap(Boolean(ex.allowSwap))
            }}
            className="min-h-11 rounded-xl border border-navy-100 bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor={prevId} className="block text-sm font-semibold text-navy">
          Current line
        </label>
        <input
          id={prevId}
          value={prev}
          onChange={(e) => setPrev(e.target.value)}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          className="min-h-12 w-full rounded-xl border-2 border-navy-100 px-3 font-mono text-navy focus:border-navy"
        />
        <div className="min-h-10 rounded-lg bg-navy-50 px-3 py-1">
          <Katex tex={tex(prev)} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-navy">Proposed next line</p>
        <MathInput value={next} onChange={setNext} label="Proposed next line" placeholder="e.g. 1 >= x" showSubmit={false} />
      </div>

      <div className="flex min-h-11 items-center gap-3">
        <input
          id={swapId}
          type="checkbox"
          checked={allowSwap}
          onChange={(e) => setAllowSwap(e.target.checked)}
          className="h-5 w-5 accent-navy"
        />
        <label htmlFor={swapId} className="text-sm text-navy">
          Allow the x ↔ y swap (inverse problems, before the swap has happened)
        </label>
      </div>

      <section aria-labelledby="sandbox-result" className="space-y-2">
        <h2 id="sandbox-result" className="text-lg font-semibold text-navy">
          What the checker says
        </h2>
        {!outcome && <p className="text-navy/80">Type a proposed next line to check the step.</p>}
        {outcome?.kind === 'crash' && (
          <p role="alert" className="font-semibold text-bad">
            <span aria-hidden>✗ </span>The checker hit an internal error: {outcome.message}
          </p>
        )}
        {outcome?.kind === 'result' && <ResultView result={outcome.result} prev={dPrev} next={dNext} />}
      </section>
    </div>
  )
}

export default Sandbox
