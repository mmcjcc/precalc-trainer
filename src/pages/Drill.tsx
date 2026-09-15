import { useEffect, useMemo, useRef, useState } from 'react'
import { Katex } from '@/components/Katex'
import { generateDrill, randomSeed, type DrillItem } from '@/content'
import { toLatex } from '@/notation'
import { ALL_CHIPS, CHIP_LABEL, type ChipId } from '@/shared/types'
import { useStore } from '@/store'

const SET_SIZE = 10

type Pick = ChipId | 'legal' | 'illegal'
interface Answer {
  picked: Pick
  correct: boolean
}

function tex(text: string): string {
  try {
    return toLatex(text)
  } catch {
    return `\\texttt{${text.replace(/[\\{}$&#^_%~]/g, '')}}`
  }
}

function Feedback({ item, answer }: { item: DrillItem; answer: Answer }) {
  const chip = item.chip ? CHIP_LABEL[item.chip] : null
  let headline: string
  if (item.question === 'which_property') {
    headline = answer.correct ? `Right — ${chip}.` : `Not quite — this step is “${chip ?? 'a different move'}”.`
  } else if (item.verdict === 'legal') {
    headline = `${answer.correct ? 'Right' : 'Not quite'} — this move is legal${chip ? ` (${chip})` : ''}.`
  } else {
    headline = answer.correct ? 'Right — that move is illegal. Good catch.' : 'Not quite — this move is illegal.'
  }
  const showLesson = !answer.correct || item.verdict === 'illegal'
  return (
    <div
      className={`rounded-xl border-l-4 bg-white p-3 ring-1 ring-navy-100 ${answer.correct ? 'border-ok' : 'border-bad'}`}
    >
      <p className="font-semibold text-navy">
        <span aria-hidden className={answer.correct ? 'text-ok' : 'text-bad'}>
          {answer.correct ? '✓' : '✗'}{' '}
        </span>
        {headline}
      </p>
      {showLesson && <p className="mt-1 text-navy">{item.lesson}</p>}
    </div>
  )
}

function choiceClass(state: 'idle' | 'right' | 'wrong' | 'dim'): string {
  const base = 'inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold'
  if (state === 'right') return `${base} border-2 border-ok bg-white text-navy`
  if (state === 'wrong') return `${base} border-2 border-bad bg-white text-navy`
  if (state === 'dim') return `${base} border border-navy-100 bg-white text-navy/60`
  return `${base} border border-navy-100 bg-white text-navy hover:border-navy hover:bg-navy-50`
}

function ChoiceMark({ state }: { state: 'idle' | 'right' | 'wrong' | 'dim' }) {
  if (state === 'right')
    return (
      <span className="text-ok">
        <span aria-hidden>✓</span>
        <span className="sr-only">correct answer:</span>
      </span>
    )
  if (state === 'wrong')
    return (
      <span className="text-bad">
        <span aria-hidden>✗</span>
        <span className="sr-only">your answer:</span>
      </span>
    )
  return null
}

export function Drill() {
  const record = useStore((s) => s.recordDrillAnswer)
  const [seed, setSeed] = useState(() => randomSeed())
  const items = useMemo(() => generateDrill(seed, SET_SIZE), [seed])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0, setRight: 0 })
  const nextRef = useRef<HTMLButtonElement>(null)
  const item: DrillItem | undefined = items[index]

  useEffect(() => {
    if (answer) nextRef.current?.focus()
  }, [answer])

  function submit(picked: Pick) {
    if (!item || answer) return
    const correct = item.question === 'which_property' ? picked === item.chip : picked === item.verdict
    record(item.family, correct, item.question === 'which_property' ? 'property' : 'legal')
    setAnswer({ picked, correct })
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1, setRight: s.setRight + (correct ? 1 : 0) }))
  }

  function next() {
    setAnswer(null)
    setIndex((i) => i + 1)
  }

  function more() {
    setSeed(randomSeed())
    setIndex(0)
    setAnswer(null)
    setScore((s) => ({ ...s, setRight: 0 }))
  }

  function stateOf(choice: Pick): 'idle' | 'right' | 'wrong' | 'dim' {
    if (!item || !answer) return 'idle'
    const target = item.question === 'which_property' ? item.chip : item.verdict
    if (choice === target) return 'right'
    if (choice === answer.picked) return 'wrong'
    return 'dim'
  }

  const relation = item?.mode !== 'expression'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-navy">Properties drill</h1>
        <p className="text-navy/80">
          Ten quick calls at a time. Every answer counts toward your drill accuracy on the Progress page.
        </p>
        <p className="text-sm font-semibold text-navy">
          {score.right} of {score.total} right
        </p>
      </header>

      {!item ? (
        <section aria-labelledby="drill-done" className="rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="drill-done" className="text-lg font-semibold text-navy">
            Set done: {score.setRight} of {items.length} right
          </h2>
          <p className="mt-1 text-navy/80">
            {score.setRight === items.length
              ? 'Every call right — those properties are sticking.'
              : 'Each miss showed the rule that decides it. Another set gives those rules another run.'}
          </p>
          <button
            type="button"
            onClick={more}
            autoFocus
            className="mt-3 min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
          >
            10 more
          </button>
        </section>
      ) : (
        <section aria-labelledby="drill-question" className="space-y-4">
          <p className="text-sm text-navy/80">
            Question {index + 1} of {items.length}
          </p>
          <h2 id="drill-question" className="text-lg font-semibold text-navy">
            {item.question === 'which_property'
              ? 'Which property turns the old line into the new one?'
              : 'Is this step legal or illegal?'}
          </h2>
          <div className="rounded-2xl border border-navy-100 bg-white p-4">
            <p className="text-sm text-navy/80">{relation ? 'Old line' : 'Old expression'}</p>
            <Katex tex={tex(item.before)} display />
            <p className="mt-2 text-sm text-navy/80">{relation ? 'New line' : 'New expression'}</p>
            <Katex tex={tex(item.after)} display />
          </div>

          {item.question === 'which_property' ? (
            <div role="group" aria-label="Properties" className="flex flex-wrap gap-2">
              {ALL_CHIPS.map((id) => {
                const st = stateOf(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => submit(id)}
                    disabled={answer !== null}
                    className={choiceClass(st)}
                  >
                    <ChoiceMark state={st} />
                    {CHIP_LABEL[id]}
                  </button>
                )
              })}
            </div>
          ) : (
            <div role="group" aria-label="Legal or illegal" className="flex gap-3">
              {(['legal', 'illegal'] as const).map((v) => {
                const st = stateOf(v)
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => submit(v)}
                    disabled={answer !== null}
                    className={`${choiceClass(st)} flex-1 justify-center text-base`}
                  >
                    <ChoiceMark state={st} />
                    {v === 'legal' ? 'Legal' : 'Illegal'}
                  </button>
                )
              })}
            </div>
          )}

          <div aria-live="polite">{answer && <Feedback item={item} answer={answer} />}</div>

          {answer && (
            <button
              ref={nextRef}
              type="button"
              onClick={next}
              className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
            >
              {index + 1 >= items.length ? 'See the set score' : 'Next'}
            </button>
          )}
        </section>
      )}
    </div>
  )
}

export default Drill
