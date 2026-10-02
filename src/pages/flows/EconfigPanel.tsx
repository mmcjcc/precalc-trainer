import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { AnswerSpec, ElectronsEconfigQuestion, RuleCard } from '@/content/types'
import { ecPattern } from '@/content/modules/electrons/patterns'
import { getModule } from '@/content/registry'
import {
  gradeConfiguration,
  gradeFullConfiguration,
  gradeIdentifySpecies,
  gradeOrbitalDiagram,
  gradeShorthandConfiguration,
  gradeUnpairedElectrons,
  gradeValenceElectrons,
  orbitalDiagram,
  orbitalDiagramDisplay,
  orbitalDiagramText,
  parseConfiguration,
  parseOrbitalDiagram,
  termsDisplay,
} from '@/engine'
import type { EconfigGrade, Spin } from '@/engine'
import type { PatternHit } from '@/shared/types'
import { useStore, type Attempt, type AttemptFinal } from '@/store'
import type { ProgressLine } from '@/problem/stepEngine'
import { verdictFromEconfig } from '@/problem/tutorContext'
import { RuleCardView } from '@/components/HintPanel'
import { Katex } from '@/components/Katex'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { useBreakpoint } from '@/components/useBreakpoint'
import { ProblemFrame } from './ProblemFrame'
import { recordEconfigGrades } from './record'
import type { FlowProps } from './types'

type ElectronsAnswer = Extract<AnswerSpec, { type: 'electrons' }>

const FINAL_HINT = 0
const SAVE_DEBOUNCE_MS = 300

const HINT_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Explain the answer',
  3: 'All hints shown',
}

/** s, p, d, brackets, and the noble-gas cores she actually writes. 44 px targets. */
const CONFIG_KEYS: { label: string; insert: string; name: string }[] = [
  { label: 's', insert: 's', name: 's subshell' },
  { label: 'p', insert: 'p', name: 'p subshell' },
  { label: 'd', insert: 'd', name: 'd subshell' },
  { label: '[', insert: '[', name: 'Open bracket' },
  { label: ']', insert: ']', name: 'Close bracket' },
  { label: '[He]', insert: '[He] ', name: 'Helium core' },
  { label: '[Ne]', insert: '[Ne] ', name: 'Neon core' },
  { label: '[Ar]', insert: '[Ar] ', name: 'Argon core' },
]

/**
 * Three-rung hint ladder: nudge, rule card, explanation. Rung 3 shows the answer, so it is flagged
 * on the attempt the same way every other flow flags a reveal.
 */
function useEconfigHint(attempt: Attempt | null, disabled: boolean): { rung: 0 | 1 | 2 | 3; advance: () => void } {
  const rung = (attempt?.hintsUsed[String(FINAL_HINT)] ?? 0) as 0 | 1 | 2 | 3
  const advance = useCallback(() => {
    if (disabled) return
    const s = useStore.getState()
    if (!s.attempt) return
    const cur = s.attempt.hintsUsed[String(FINAL_HINT)] ?? 0
    if (cur >= 3) return
    const next = (cur + 1) as 1 | 2 | 3
    s.useHint(FINAL_HINT, next)
    if (next === 3) s.setFinal({ revealed: true, firstCorrect: false })
  }, [disabled])
  return { rung, advance }
}

function HintPanel({ rung, nudge, card, related, explanation, onAdvance, disabled }: { rung: 0 | 1 | 2 | 3; nudge: string; card: RuleCard | null; related: RuleCard[]; explanation: string[]; onAdvance: () => void; disabled: boolean }) {
  const exhausted = rung === 3
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">Hints never appear on their own. Ctrl+Shift+H steps through them.</p>
      <button
        type="button"
        onClick={onAdvance}
        disabled={disabled || exhausted}
        className="min-h-11 w-full rounded-xl bg-gold px-3 font-semibold text-navy hover:bg-gold/80 disabled:opacity-50"
      >
        {HINT_LABEL[rung]}
        {rung === 2 && <span className="ml-1 text-xs font-normal text-gold-text">(marks the answer as shown)</span>}
      </button>
      {rung >= 1 && (
        <div className="rounded-xl bg-navy-50 p-3 text-sm text-navy">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Nudge</p>
          <p className="mt-1">{nudge}</p>
        </div>
      )}
      {rung >= 2 && card && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/60">Rule</p>
          <RuleCardView card={card} />
          {related.length > 0 && (
            <details className="mt-2 rounded-xl border border-navy-100 bg-white p-2">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold text-navy">
                Related {related.length === 1 ? 'rule' : 'rules'} ({related.length})
              </summary>
              <div className="mt-2 space-y-2">
                {related.map((c) => (
                  <RuleCardView key={c.id} card={c} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {rung >= 3 && <SigFigExplanation steps={explanation} title="Worked explanation" />}
    </div>
  )
}

function gradeAsk(q: ElectronsEconfigQuestion, text: string, boxes: Spin[][]): EconfigGrade[] {
  const sp = q.species
  switch (q.ask) {
    case 'full':
      return [gradeFullConfiguration(sp, text)]
    case 'shorthand':
      return [gradeShorthandConfiguration(sp, text)]
    case 'ion':
      return [gradeConfiguration(sp, text, { form: q.form ?? 'either' })]
    case 'identify':
      return [gradeIdentifySpecies(sp, text)]
    case 'valence':
      return [gradeValenceElectrons(sp, text)]
    case 'diagram':
      return [
        gradeOrbitalDiagram(sp, boxes, { subshell: q.subshell }),
        gradeUnpairedElectrons(sp, text, { diagram: boxes, subshell: q.subshell }),
      ]
  }
}

interface PartFeedback {
  correct: boolean
  message: string
  pattern: PatternHit | null
}

type Feedback = { kind: 'invalid'; message: string } | { kind: 'parts'; parts: PartFeedback[] }

function toPart(g: EconfigGrade): PartFeedback {
  if (g.verdict === 'correct') return { correct: true, message: g.message, pattern: null }
  if (g.verdict === 'mistake') return { correct: false, message: g.witness, pattern: ecPattern(g.mistake, g.witness) }
  return { correct: false, message: g.message, pattern: null }
}

/** Live "reads as" line. Null when the box is empty. Superscripts come from the parser, not a retyped config. */
function readsAs(text: string): { ok: true; display: string } | { ok: false; message: string } | null {
  if (text.trim() === '') return null
  const parsed = parseConfiguration(text)
  if (!parsed.ok) return { ok: false, message: parsed.error.message }
  const core = parsed.value.core ? `[${parsed.value.core.symbol}]` : ''
  const terms = termsDisplay(parsed.value.terms)
  return { ok: true, display: [core, terms].filter(Boolean).join(' ') || '(nothing)' }
}

function initialBoxes(stored: string | undefined, orbitals: number): Spin[][] {
  const empty = Array.from({ length: orbitals }, () => [] as Spin[])
  if (!stored) return empty
  const parsed = parseOrbitalDiagram(stored)
  if (!parsed.ok || parsed.value.length !== orbitals) return empty
  return parsed.value.map((box) => [...box])
}

function boxName(box: readonly Spin[], index: number): string {
  if (box.length === 0) return `Box ${index + 1}, empty`
  return `Box ${index + 1}, ${box.map((s) => (s === 'up' ? 'up' : 'down')).join(' ')}`
}

const FIELD: Record<ElectronsEconfigQuestion['ask'], { label: string; wide: boolean; numeric: boolean }> = {
  full: { label: 'Your configuration', wide: true, numeric: false },
  shorthand: { label: 'Your configuration', wide: true, numeric: false },
  ion: { label: 'Your configuration', wide: true, numeric: false },
  identify: { label: 'Element', wide: false, numeric: false },
  valence: { label: 'Valence electrons', wide: false, numeric: true },
  diagram: { label: 'Unpaired electrons', wide: false, numeric: true },
}

/**
 * Electron configurations on the electrons screen: a typed configuration (with a live superscript
 * reading), an element or a count, or an orbital diagram she builds by tapping arrows. A grade of
 * invalid is shown and not recorded. Her text and diagram are stored on the attempt.
 */
export function EconfigBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: ElectronsAnswer }) {
  const q = answer.question
  if (q.kind !== 'econfig') return null
  return <EconfigForm instance={instance} attempt={attempt} flags={flags} templateTitle={templateTitle} completion={completion} finish={finish} answer={answer} question={q} />
}

function EconfigForm({ instance, attempt, flags, templateTitle, completion, finish, answer, question }: FlowProps & { answer: ElectronsAnswer; question: ElectronsEconfigQuestion }) {
  const done = Boolean(completion)
  const mod = getModule(instance.moduleId)
  const bp = useBreakpoint()
  const cardsById = new Map(mod.ruleCards.map((c) => [c.id, c]))
  const field = FIELD[question.ask]
  const configAsk = question.ask === 'full' || question.ask === 'shorthand' || question.ask === 'ion'
  const diagramInfo = question.ask === 'diagram' ? orbitalDiagram(question.species, question.subshell) : null

  const [text, setText] = useState(attempt?.final?.ecText ?? '')
  const [boxes, setBoxes] = useState<Spin[][]>(() => initialBoxes(attempt?.final?.ecDiagram, diagramInfo?.orbitals ?? 0))
  const [selected, setSelected] = useState(0)
  const [grades, setGrades] = useState<EconfigGrade[] | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [lastPattern, setLastPattern] = useState<PatternHit | null>(null)
  const lastChecked = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const boxRefs = useRef<(HTMLButtonElement | null)[]>([])

  const pending = useRef<Partial<AttemptFinal> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushSave = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!pending.current) return
    const patch = pending.current
    pending.current = null
    useStore.getState().setFinal(patch)
  }, [])
  const save = useCallback(
    (patch: Partial<AttemptFinal>) => {
      pending.current = { ...pending.current, ...patch }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS)
    },
    [flushSave],
  )
  const saveNow = useCallback(
    (patch: Partial<AttemptFinal>) => {
      pending.current = { ...pending.current, ...patch }
      flushSave()
    },
    [flushSave],
  )
  useEffect(() => flushSave, [flushSave])
  useEffect(() => {
    if (caret.current === null || !inputRef.current) return
    inputRef.current.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [text])

  const hint = useEconfigHint(attempt, done)
  const patternCard: RuleCard | null = lastPattern ? { id: lastPattern.id, title: lastPattern.title, body: lastPattern.lesson, example: lastPattern.example } : null
  const related = answer.ruleCards
    .slice(patternCard ? 0 : 1)
    .map((id) => cardsById.get(id))
    .filter((c): c is RuleCard => c !== undefined && c.title !== patternCard?.title)

  function onText(next: string) {
    setText(next)
    setFeedback((f) => (f?.kind === 'invalid' ? null : f))
    setGrades((g) => (g?.some((x) => x.verdict === 'invalid' || x.verdict === 'unsupported') ? null : g))
    save({ ecText: next })
  }

  function insert(token: string) {
    if (done) return
    const el = inputRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    caret.current = start + token.length
    onText(text.slice(0, start) + token + text.slice(end))
    el?.focus()
  }

  function commitBoxes(next: Spin[][]) {
    setBoxes(next)
    saveNow({ ecDiagram: orbitalDiagramText(next), ecText: text })
  }

  function addSpin(index: number, spin: Spin) {
    if (done || index < 0 || index >= boxes.length) return
    setSelected(index)
    const next = boxes.map((box, i) => (i === index ? [...box, spin] : box))
    commitBoxes(next)
  }

  function clearBox(index: number) {
    if (done || index < 0 || index >= boxes.length) return
    setSelected(index)
    const next = boxes.map((box, i) => (i === index ? [] : box))
    commitBoxes(next)
  }

  function onBoxKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (done) return
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      addSpin(index, 'up')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      addSpin(index, 'down')
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      clearBox(index)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const count = boxes.length
      if (count === 0) return
      const next = e.key === 'ArrowRight' ? (index + 1) % count : (index - 1 + count) % count
      setSelected(next)
      boxRefs.current[next]?.focus()
    }
  }

  function submit() {
    if (done) return
    flushSave()
    const patch: Partial<AttemptFinal> = { ecText: text }
    if (question.ask === 'diagram') patch.ecDiagram = orbitalDiagramText(boxes)
    useStore.getState().setFinal(patch)
    const nextGrades = gradeAsk(question, text, boxes)
    setGrades(nextGrades)
    const blocked = nextGrades.find((g) => g.verdict === 'invalid' || g.verdict === 'unsupported')
    if (blocked && (blocked.verdict === 'invalid' || blocked.verdict === 'unsupported')) {
      setFeedback({ kind: 'invalid', message: blocked.message })
      setLastPattern(null)
      return
    }
    setFeedback({ kind: 'parts', parts: nextGrades.map(toPart) })
    const mistake = nextGrades.find((g) => g.verdict === 'mistake')
    setLastPattern(mistake && mistake.verdict === 'mistake' ? ecPattern(mistake.mistake, mistake.witness) : null)
    const key = question.ask === 'diagram' ? `${orbitalDiagramText(boxes)}|${text}` : text
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordEconfigGrades(nextGrades)
    if (nextGrades.every((g) => g.verdict === 'correct')) finish()
  }

  const reading = configAsk ? readsAs(text) : null
  const progress: ProgressLine = {
    stage: done ? 1 : 0,
    total: 1,
    label: done ? 'answer checked' : 'give the answer',
    solved: done,
    offPath: false,
  }
  const tutorVerdict = grades ? verdictFromEconfig(grades) : undefined
  const inputClass = `min-h-12 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 text-[max(18px,1.125rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50 ${field.wide ? 'w-full max-w-xl font-mono' : 'w-40'}`

  let entry: ReactNode = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
      className="space-y-3"
    >
      {diagramInfo && (
        <div role="group" aria-label="Orbital diagram" className="space-y-2">
          <h3 className="font-semibold text-navy">Orbital diagram</h3>
          <p className="text-sm text-navy/70">Tap a box, then an arrow. A box may hold two arrows the same way: that is a real mistake the checker can name. Clear empties the selected box.</p>
          <div className="flex flex-wrap gap-2">
            {boxes.map((box, i) => (
              <button
                key={i}
                type="button"
                ref={(el) => {
                  boxRefs.current[i] = el
                }}
                aria-label={boxName(box, i)}
                aria-pressed={selected === i}
                disabled={done}
                onClick={() => setSelected(i)}
                onKeyDown={(e) => onBoxKey(e, i)}
                className={`min-h-11 min-w-11 rounded-xl border-2 px-2 font-mono text-lg font-semibold text-navy disabled:opacity-50 ${selected === i ? 'border-navy bg-gold-100' : 'border-navy-100 bg-white hover:border-navy'}`}
              >
                <span aria-hidden>{orbitalDiagramDisplay([box])}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Arrow controls">
            <button type="button" aria-label="Up arrow" disabled={done} onClick={() => addSpin(selected, 'up')} className="min-h-11 min-w-11 rounded-xl border-2 border-navy-100 bg-white px-3 text-lg font-semibold text-navy hover:border-navy disabled:opacity-50">
              ↑
            </button>
            <button type="button" aria-label="Down arrow" disabled={done} onClick={() => addSpin(selected, 'down')} className="min-h-11 min-w-11 rounded-xl border-2 border-navy-100 bg-white px-3 text-lg font-semibold text-navy hover:border-navy disabled:opacity-50">
              ↓
            </button>
            <button type="button" aria-label="Clear box" disabled={done} onClick={() => clearBox(selected)} className="min-h-11 min-w-11 rounded-xl border-2 border-navy-100 bg-white px-3 font-semibold text-navy hover:border-navy disabled:opacity-50">
              Clear
            </button>
          </div>
        </div>
      )}
      <div>
        <label htmlFor="ec-answer" className="block text-sm font-semibold text-navy">
          {field.label}
        </label>
        <input
          ref={inputRef}
          id="ec-answer"
          type="text"
          value={text}
          disabled={done}
          onChange={(e) => onText(e.target.value)}
          inputMode={field.numeric ? 'numeric' : 'text'}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          autoFocus={bp === 'desktop' && !done}
          aria-invalid={feedback?.kind === 'invalid' || reading?.ok === false ? true : undefined}
          aria-describedby={configAsk ? 'ec-reads' : undefined}
          className={inputClass}
        />
      </div>
      {configAsk && (
        <div role="toolbar" aria-label="Configuration symbols" className="-mx-1 flex gap-1 overflow-x-auto px-1 py-1">
          {CONFIG_KEYS.map((key) => (
            <button
              key={key.name}
              type="button"
              disabled={done}
              aria-label={key.name}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(key.insert)}
              className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-navy-100 bg-white px-2 font-mono text-base text-navy hover:bg-gold-100 disabled:opacity-50"
            >
              {key.label}
            </button>
          ))}
        </div>
      )}
      {configAsk && (
        <p id="ec-reads" className="text-sm text-navy">
          {reading?.ok ? (
            <>
              reads as <span className="font-semibold">{reading.display}</span>
            </>
          ) : reading ? (
            <span className="text-bad">{reading.message}</span>
          ) : (
            <span className="text-navy/60">What you type shows here with superscripts.</span>
          )}
        </p>
      )}
      {!done && (
        <button type="submit" className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
          Check answer
        </button>
      )}
      {feedback?.kind === 'invalid' && (
        <div role="alert" className="rounded-2xl border border-bad bg-bad-100 p-3 text-navy">
          <p className="font-semibold">This doesn’t count as an attempt</p>
          <p className="mt-1 text-sm">{feedback.message}</p>
        </div>
      )}
      {feedback?.kind === 'parts' &&
        feedback.parts.map((part, i) =>
          part.correct ? (
            <SigFigCorrect key={i} message={part.message} />
          ) : (
            <SigFigRejection key={i} message={part.message} patterns={part.pattern ? [part.pattern] : []} />
          ),
        )}
    </form>
  )

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={tutorVerdict}
      nudgeText="Still here? The answer goes in the box below — the hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<EconfigStatement answer={answer} question={question} />}
      hints={<HintPanel rung={hint.rung} nudge={answer.nudge} card={patternCard ?? cardsById.get(answer.ruleCard) ?? null} related={related} explanation={answer.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="el-answer-title">
        <h2 id="el-answer-title" className="font-semibold text-navy">
          Final answer
        </h2>
        {entry}
        {done && <SigFigExplanation steps={answer.reveal} />}
      </section>
    </ProblemFrame>
  )
}

function EconfigStatement({ answer, question }: { answer: ElectronsAnswer; question: ElectronsEconfigQuestion }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/80">{answer.context}</p>
      <p className="text-xl font-semibold text-navy sm:text-2xl">{answer.prompt}</p>
      <div className="rounded-xl bg-white/70 px-4 py-1 text-center text-4xl text-navy">
        <Katex tex={question.latex} display ariaLabel={question.display} />
      </div>
    </div>
  )
}
