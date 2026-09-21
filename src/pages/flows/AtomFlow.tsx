import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { getModule } from '@/content/registry'
import type { AnswerSpec, RuleCard } from '@/content/types'
import { chargeText, composeSigFigText, gradeAbundance, gradeAverageMass, gradeNotation, gradeParticles, parseChargeText } from '@/engine'
import type { AtomBox, AtomGrade, PatternHit, SigFigGrade } from '@/shared/types'
import { useStore, type Attempt, type AttemptFinal } from '@/store'
import type { ProgressLine } from '@/problem/stepEngine'
import { AtomRejection, BoxMark } from '@/components/AtomFeedback'
import { RuleCardView } from '@/components/HintPanel'
import { IsotopeTable, PeriodicTiles } from '@/components/IsotopeTable'
import { Katex } from '@/components/Katex'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { SigFigNumeralInput } from '@/components/SigFigNumeralInput'
import { useBreakpoint } from '@/components/useBreakpoint'
import { ProblemFrame } from './ProblemFrame'
import { recordAtomGrade, recordSigFigGrade } from './record'
import type { FlowProps } from './types'

type AtomAnswer = Extract<AnswerSpec, { type: 'atoms' }>

/** Hint-ladder key (attempt.hintsUsed): one ladder per problem. */
const HINT_KEY = 0
const SAVE_DEBOUNCE_MS = 300

interface BoxSpec {
  box: AtomBox
  label: string
  inputMode: 'numeric' | 'decimal' | 'text'
  placeholder?: string
  suffix?: string
}

function boxSpecs(answer: AtomAnswer): BoxSpec[] {
  const q = answer.question
  switch (q.kind) {
    case 'particles':
      return [
        { box: 'protons', label: 'Protons', inputMode: 'numeric' },
        { box: 'neutrons', label: 'Neutrons', inputMode: 'numeric' },
        { box: 'electrons', label: 'Electrons', inputMode: 'numeric' },
      ]
    case 'notation':
      return [
        { box: 'symbol', label: 'Element symbol', inputMode: 'text' },
        { box: 'massNumber', label: 'Mass number (A)', inputMode: 'numeric' },
        { box: 'atomicNumber', label: 'Atomic number (Z)', inputMode: 'numeric' },
        { box: 'charge', label: 'Charge', inputMode: 'text', placeholder: 'blank if neutral' },
      ]
    case 'abundance':
      return [
        { box: 'abundance1', label: `${q.isotopes[0].label} abundance`, inputMode: 'decimal', suffix: '%' },
        { box: 'abundance2', label: `${q.isotopes[1].label} abundance`, inputMode: 'decimal', suffix: '%' },
      ]
    case 'avgmass':
      return []
  }
}

const GRID: Record<AtomAnswer['question']['kind'], string> = {
  particles: 'grid grid-cols-3 gap-3',
  notation: 'grid grid-cols-2 gap-3 sm:grid-cols-4',
  abundance: 'grid gap-3 sm:grid-cols-2',
  avgmass: '',
}

function gradeBoxes(answer: AtomAnswer, e: Record<string, string>): AtomGrade | null {
  const q = answer.question
  const v = (k: AtomBox) => e[k] ?? ''
  switch (q.kind) {
    case 'particles':
      return gradeParticles(q, { protons: v('protons'), neutrons: v('neutrons'), electrons: v('electrons') })
    case 'notation':
      return gradeNotation(q, { symbol: v('symbol'), massNumber: v('massNumber'), atomicNumber: v('atomicNumber'), charge: v('charge') })
    case 'abundance':
      return gradeAbundance(q, [v('abundance1'), v('abundance2')])
    case 'avgmass':
      return null
  }
}

/** Live "reads as" nuclear symbol for the notation boxes; only digits and letters reach KaTeX. */
function notationPreview(e: Record<string, string>): string | null {
  const sym = (e.symbol ?? '').trim()
  const A = (e.massNumber ?? '').trim()
  const Z = (e.atomicNumber ?? '').trim()
  const ch = e.charge ?? ''
  if (sym === '' && A === '' && Z === '' && ch.trim() === '') return null
  const charge = parseChargeText(ch)
  const top = /^\d{1,3}$/.test(A) ? A : '?'
  const bottom = /^\d{1,3}$/.test(Z) ? Z : '?'
  const letters = /^[A-Za-z]{1,3}$/.test(sym) ? sym : '?'
  const sup = charge.ok ? chargeText(charge.value).replace('−', '-') : '?'
  return `{}^{${top}}_{${bottom}}\\mathrm{${letters}}${sup ? `^{${sup}}` : ''}`
}

/**
 * Three-rung hint ladder for an answer-only problem: nudge, rule card, worked explanation. Rung 3
 * shows the answer, so it is flagged on the attempt (`final.revealed`) and the answer no longer counts
 * as a first try.
 */
function useAtomHint(attempt: Attempt | null, disabled: boolean): { rung: 0 | 1 | 2 | 3; advance: () => void } {
  const rung = (attempt?.hintsUsed[String(HINT_KEY)] ?? 0) as 0 | 1 | 2 | 3
  const advance = useCallback(() => {
    if (disabled) return
    const s = useStore.getState()
    if (!s.attempt) return
    const cur = s.attempt.hintsUsed[String(HINT_KEY)] ?? 0
    if (cur >= 3) return
    const next = (cur + 1) as 1 | 2 | 3
    s.useHint(HINT_KEY, next)
    if (next === 3) s.setFinal({ revealed: true, firstCorrect: false })
  }, [disabled])
  return { rung, advance }
}

const HINT_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Explain the answer',
  3: 'All hints shown',
}

function AtomHintPanel({
  rung,
  nudge,
  card,
  related,
  explanation,
  onAdvance,
  disabled,
}: {
  rung: 0 | 1 | 2 | 3
  nudge: string
  card: RuleCard | null
  related: RuleCard[]
  explanation: string[]
  onAdvance: () => void
  disabled: boolean
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">Hints never appear on their own. Ctrl+Shift+H steps through them.</p>
      <button
        type="button"
        onClick={onAdvance}
        disabled={disabled || rung === 3}
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

/**
 * Atomic-structure flow (chemistry): count particles, write a nuclear symbol, average an isotope
 * table, or work back to the abundances. Answer-only: the statement card carries the particle (a
 * KaTeX nuclear symbol), the periodic-table lookups or the isotope table; she fills the boxes and
 * checks. Every graded check is recorded (named mistakes reach the Progress page); hints go nudge →
 * rule card → worked explanation; after a right answer the explanation appears. No graph, no
 * calculator panel. Her entries are saved to the attempt, so a reload keeps them.
 */
export function AtomFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'atoms') return <p className="text-navy">This problem has nothing to work with — pick another from the module page.</p>
  return <AtomBody {...props} answer={answer} />
}

function AtomBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: AtomAnswer }) {
  const done = Boolean(completion)
  const q = answer.question
  const mod = getModule(instance.moduleId)
  const bp = useBreakpoint()
  const cardsById = useMemo(() => new Map(mod.ruleCards.map((c) => [c.id, c])), [mod])
  const boxes = useMemo(() => boxSpecs(answer), [answer])
  const labels = useMemo(() => Object.fromEntries(boxes.map((b) => [b.box, b.label])) as Partial<Record<AtomBox, string>>, [boxes])

  // --- entry state (restored from the attempt after a reload) -----------------
  const [entries, setEntries] = useState<Record<string, string>>(() => ({ ...(attempt?.final?.atEntries ?? {}) }))
  const [coef, setCoef] = useState(attempt?.final?.sfText ?? '')
  const [power, setPower] = useState(attempt?.final?.sfPower ?? '')
  const [grade, setGrade] = useState<AtomGrade | null>(null)
  const [checked, setChecked] = useState<Record<string, string> | null>(null)
  const [sfGrade, setSfGrade] = useState<SigFigGrade | null>(null)
  const [lastPattern, setLastPattern] = useState<PatternHit | null>(null)
  // Re-checking the same entry is not a second try (no second record).
  const lastChecked = useRef<string | null>(null)

  // Typed boxes are saved to the attempt a moment after she stops typing, and on leaving the page.
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
  useEffect(() => flushSave, [flushSave])

  // --- hints ------------------------------------------------------------------
  const hint = useAtomHint(attempt, done)
  const patternCard: RuleCard | null = lastPattern ? { id: lastPattern.id, title: lastPattern.title, body: lastPattern.lesson, example: lastPattern.example } : null
  const card = patternCard ?? cardsById.get(answer.ruleCard) ?? null
  const related = answer.ruleCards
    .slice(patternCard ? 0 : 1)
    .map((id) => cardsById.get(id))
    .filter((c): c is RuleCard => c !== undefined)

  // --- grading ------------------------------------------------------------------
  function setBox(box: AtomBox, value: string) {
    const next = { ...entries, [box]: value }
    setEntries(next)
    save({ atEntries: next })
  }

  function submitBoxes(e: FormEvent) {
    e.preventDefault()
    if (done) return
    flushSave()
    useStore.getState().setFinal({ atEntries: entries })
    const g = gradeBoxes(answer, entries)
    if (!g) return
    setGrade(g)
    setChecked(entries)
    if (g.status === 'wrong') setLastPattern(g.patterns[0] ?? null)
    if (g.status === 'parse_error') return
    const key = JSON.stringify(boxes.map((b) => (entries[b.box] ?? '').trim()))
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordAtomGrade(g)
    if (g.status === 'correct') finish()
  }

  function submitNumeral() {
    if (done || q.kind !== 'avgmass') return
    flushSave()
    useStore.getState().setFinal({ sfText: coef, sfPower: power })
    const text = composeSigFigText(coef, power)
    const g = gradeAverageMass(q, text)
    setSfGrade(g)
    if (g.status === 'wrong') setLastPattern(g.pattern ?? null)
    if (g.status === 'parse_error') return
    if (lastChecked.current === text) return
    lastChecked.current = text
    recordSigFigGrade(g)
    if (g.status === 'correct') finish()
  }

  /** The verdict for a box, shown only while the box still holds what was checked. */
  function markFor(box: AtomBox): 'correct' | 'wrong' | null {
    if (!grade || grade.status === 'parse_error' || !checked) return null
    if ((checked[box] ?? '') !== (entries[box] ?? '')) return null
    const b = grade.boxes.find((x) => x.box === box)
    return b ? (b.status === 'correct' ? 'correct' : 'wrong') : null
  }

  function parseErrorFor(box: AtomBox): string | null {
    if (!grade || grade.status !== 'parse_error' || !checked) return null
    if ((checked[box] ?? '') !== (entries[box] ?? '')) return null
    return grade.boxes.find((x) => x.box === box)?.message ?? null
  }

  const preview = q.kind === 'notation' ? notationPreview(entries) : null

  // --- frame ------------------------------------------------------------------
  const progress: ProgressLine = {
    stage: done ? 1 : 0,
    total: 1,
    label: done ? 'answer checked' : 'give the answer',
    solved: done,
    offPath: false,
  }
  const particle = q.kind === 'particles' ? q.particle : null
  const firstParseError = boxes.find((b) => parseErrorFor(b.box) !== null)?.box

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      nudgeText="Still here? Fill in the boxes below — the hint button is right there."
      statement={
        <div className="space-y-3">
          {answer.context && <p className="text-sm text-navy/80">{answer.context}</p>}
          <p className="text-xl font-semibold text-navy sm:text-2xl">{answer.prompt}</p>
          {answer.latex && particle && (
            <div className="rounded-xl bg-white/70 px-4 py-1 text-center text-4xl text-navy">
              <Katex
                tex={answer.latex}
                display
                ariaLabel={`Nuclear symbol ${particle.symbol}: mass number ${particle.massNumber}, atomic number ${particle.z}${particle.charge === 0 ? '' : `, charge ${Math.abs(particle.charge)}${particle.charge > 0 ? ' plus' : ' minus'}`}`}
              />
            </div>
          )}
          {q.kind === 'avgmass' && <IsotopeTable rows={q.isotopes} caption={q.fictional ? 'Isotopes of element X' : `Natural isotopes of ${q.element}`} />}
          {q.kind === 'abundance' && <IsotopeTable rows={q.isotopes} caption={`Isotopes of ${q.element} (average atomic mass ${q.average} u)`} unknownLabel="?" />}
          <PeriodicTiles entries={answer.periodic} />
        </div>
      }
      hints={
        <AtomHintPanel
          rung={hint.rung}
          nudge={answer.nudge}
          card={card}
          related={related.filter((c) => c.id !== card?.id)}
          explanation={answer.reveal}
          onAdvance={hint.advance}
          disabled={done}
        />
      }
      keymap={{ onHint: hint.advance }}
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="at-answer-title">
        <h2 id="at-answer-title" className="font-semibold text-navy">
          Final answer
        </h2>
        {q.kind === 'avgmass' ? (
          <>
            <SigFigNumeralInput
              coefficient={coef}
              power={power}
              onChange={({ coefficient, power: p }) => {
                setCoef(coefficient)
                setPower(p)
                if (sfGrade?.status === 'parse_error') setSfGrade(null)
                save({ sfText: coefficient, sfPower: p })
              }}
              onSubmit={submitNumeral}
              unit="u"
              disabled={done}
              autoFocus={bp === 'desktop' && !done}
              error={sfGrade?.status === 'parse_error' ? sfGrade.parseError : null}
            />
            {sfGrade?.status === 'wrong' && <SigFigRejection message={sfGrade.message} patterns={sfGrade.pattern ? [sfGrade.pattern] : []} />}
            {sfGrade?.status === 'correct' && <SigFigCorrect message={sfGrade.message} note={sfGrade.note} />}
          </>
        ) : (
          <>
            <form onSubmit={submitBoxes} noValidate className="space-y-3" aria-label="Answer boxes">
              <div className={GRID[q.kind]}>
                {boxes.map((spec, i) => {
                  const mark = markFor(spec.box)
                  const err = parseErrorFor(spec.box)
                  const id = `at-${spec.box}`
                  return (
                    <div key={spec.box} className="min-w-0">
                      <label htmlFor={id} className="block text-sm font-semibold text-navy">
                        {spec.label}
                      </label>
                      <div className="mt-1 flex items-center gap-1.5">
                        <input
                          id={id}
                          type="text"
                          inputMode={spec.inputMode}
                          value={entries[spec.box] ?? ''}
                          disabled={done}
                          onChange={(ev) => setBox(spec.box, ev.target.value)}
                          autoCapitalize="off"
                          autoCorrect="off"
                          autoComplete="off"
                          spellCheck={false}
                          enterKeyHint={i === boxes.length - 1 ? 'go' : 'next'}
                          autoFocus={bp === 'desktop' && !done && i === 0}
                          placeholder={spec.placeholder}
                          aria-invalid={mark === 'wrong' || err ? true : undefined}
                          aria-describedby={err ? `${id}-error` : undefined}
                          className="min-h-12 w-full min-w-0 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(18px,1.125rem)] text-ink outline-none placeholder:font-sans placeholder:text-sm focus:border-navy disabled:bg-navy-50 aria-[invalid=true]:border-bad"
                        />
                        {spec.suffix && (
                          <span className="text-lg font-semibold text-navy" aria-hidden>
                            {spec.suffix}
                          </span>
                        )}
                        <BoxMark status={mark} />
                      </div>
                      {err && (
                        <p id={`${id}-error`} role={spec.box === firstParseError ? 'alert' : undefined} className="mt-1 text-sm font-medium text-bad">
                          {err}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
              {q.kind === 'notation' && (
                <p className="flex min-h-10 flex-wrap items-center gap-2 text-sm text-navy">
                  {preview ? (
                    <>
                      <span>reads as</span>
                      <Katex tex={preview} className="text-2xl" />
                    </>
                  ) : (
                    <span className="text-navy/60">Your symbol appears here as you type: mass number on top, atomic number below, charge at the top right.</span>
                  )}
                </p>
              )}
              <button type="submit" disabled={done} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
                Check answer
              </button>
            </form>
            {grade?.status === 'wrong' && <AtomRejection grade={grade} labels={labels} />}
            {grade?.status === 'correct' && <SigFigCorrect message={grade.message} note={grade.note} />}
          </>
        )}
        {done && <SigFigExplanation steps={answer.reveal} title="How it works out" />}
      </section>
    </ProblemFrame>
  )
}
