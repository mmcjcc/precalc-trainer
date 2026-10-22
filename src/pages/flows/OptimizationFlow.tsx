import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Katex } from '@/components/Katex'
import { SymbolStrip } from '@/components/MathSymbolStrip'
import { OptFigure } from '@/components/OptFigure'
import { RuleCardView } from '@/components/HintPanel'
import { StuckChip, useStuckRequest } from '@/components/Stuck'
import { KEYPAD_SETS, letterKey } from '@/components/keypadKeys'
import { insertToken, type StripKey } from '@/components/symbolStrip'
import { CaughtBanner, MistakeAvatar } from '@/components/monsters/MonsterTag'
import { useMathKeypadOn } from '@/components/useMathKeypad'
import { gradeOptPart, stagesFor, type OptPartGrade } from '@/content/modules/optimization/parts'
import { pieces } from '@/content/modules/optimization/text'
import { getModule } from '@/content/registry'
import type { OptimizationAnswer, OptPart, RuleCard } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { displayNode, finalRoute, readOptEquation, readOptNumber, type OptVar } from '@/engine/optim'
import { nodeToLatex } from '@/notation'
import type { ProgressLine } from '@/problem/stepEngine'
import { safeLatex } from '@/problem/stepEngine'
import { verdictFromOptPart } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { NotAnAttemptNotice, useHintLadder, type LadderRung } from './hintLadder'
import { PolyTextBox, savePolyEntries } from './polyUi'
import { recordOptPartGrade } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

interface Feedback {
  stage: number
  grade: OptPartGrade
}

const squash = (s: string) => s.replace(/\s+/g, '')

/** What the status line says she is doing, part by part. */
const DOING: Record<string, string> = {
  secondary: 'write the secondary equation',
  primary: 'write the primary equation',
  final: 'write the final equation',
  best: 'find the vertex',
  other: 'find the other value',
  max: 'find the largest value',
}

/** A math string: words, with every formula between dollar signs drawn by KaTeX (a \$ inside is money). */
export function OptTex({ text }: { text: string }) {
  return (
    <>
      {pieces(text).map((p, i) => (p.tex ? <Katex key={i} tex={p.text} /> : <span key={i}>{p.text}</span>))}
    </>
  )
}

/** Split a catalog example ("2l + 2w ✗ → 2l + w") into arrow-joined plain segments, as the shared cards do. */
function ExampleLine({ example }: { example: string }) {
  const parts = example
    .split('→')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-navy/70">Example:</span>
      {parts.map((seg, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>→</span>}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm text-navy ring-1 ring-navy-100">{seg}</code>
        </span>
      ))}
    </p>
  )
}

/**
 * The verdict of one check, in the app's card styling (✓/✗ and words, never colour alone): the named mistake's title,
 * lesson, the sentence about her own work (with its math drawn) and the wrong → right example; a plain note; or the
 * notice that the check did not count.
 */
function GradeNote({ grade }: { grade: OptPartGrade }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') {
    return (
      <div role="status" className="rounded-2xl border border-ok bg-ok-100 p-3 text-navy">
        <p className="font-semibold">
          <span aria-hidden>✓ </span>
          <OptTex text={grade.message} />
        </p>
      </div>
    )
  }
  const info = grade.verdict === 'mistake' ? ERROR_PATTERNS[grade.mistake] : null
  const caught = grade.verdict === 'mistake' ? grade.mistake : null
  return (
    <>
      <div role="alert" className="rounded-2xl border border-bad bg-bad-100 p-3 text-navy">
        {/* Mistake Monsters: the first time she makes this mistake, its monster, caught; after that, its avatar. */}
        <CaughtBanner pattern={caught} />
        <p className="font-semibold">
          <MistakeAvatar pattern={caught} className="mr-1.5" />
          <span aria-hidden>✗ </span>
          {info ? `Not quite: ${info.title}` : 'Not quite'}
        </p>
        {info?.lesson && <p className="mt-1 text-sm">{info.lesson}</p>}
        <p className={`mt-1 text-sm ${info ? 'font-medium' : ''}`}>
          <OptTex text={grade.verdict === 'mistake' ? grade.witness : grade.message} />
        </p>
        {info?.example && <ExampleLine example={info.example} />}
      </div>
      <StuckChip />
    </>
  )
}

const HINT_LABEL: Record<LadderRung, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Explain the answer',
  3: 'All hints shown',
}

/** The worked lines, one per row, formulas in KaTeX. */
function WorkedLines({ lines, title }: { lines: readonly string[]; title: string }) {
  if (lines.length === 0) return null
  return (
    <section className="rounded-2xl border border-navy-100 bg-navy-50 p-3 text-navy" aria-label={title}>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">{title}</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
        {lines.map((s, i) => (
          <li key={i} data-worked-line="">
            <OptTex text={s} />
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The part's three hint rungs: the nudge (KaTeX), the rule card with related cards folded under it, the worked lines. */
function OptHintLadder({ rung, nudge, card, related, explanation, onAdvance, disabled }: { rung: LadderRung; nudge: string; card: RuleCard | null; related: RuleCard[]; explanation: readonly string[]; onAdvance: () => void; disabled: boolean }) {
  const exhausted = rung === 3
  useStuckRequest(rung, onAdvance, disabled || exhausted)
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">
        Hints never appear on their own.<span className="pointer-coarse:hidden"> Ctrl+Shift+H steps through them.</span>
      </p>
      <button type="button" onClick={onAdvance} disabled={disabled || exhausted} className="min-h-11 w-full rounded-xl bg-gold px-3 font-semibold text-navy hover:bg-gold/80 disabled:opacity-50">
        {HINT_LABEL[rung]}
        {rung === 2 && <span className="ml-1 text-xs font-normal text-gold-text">(marks the answer as shown)</span>}
      </button>
      {rung >= 1 && (
        <div className="rounded-xl bg-navy-50 p-3 text-sm text-navy">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Nudge</p>
          <p className="mt-1">
            <OptTex text={nudge} />
          </p>
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
      {rung >= 3 && <WorkedLines lines={explanation} title="Worked explanation" />}
    </div>
  )
}

function StageCard({ index, total, part, passed, children }: { index: number; total: number; part: OptPart; passed: boolean; children: ReactNode }) {
  const titleId = `opt-part-${index}`
  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
      {/* A plain-text heading: KaTeX inside a heading breaks its accessible name. */}
      <h2 id={titleId} className="font-semibold text-navy">
        {`Part ${index + 1} of ${total}: ${part.label}`}
      </h2>
      <p className="text-sm text-navy">
        <OptTex text={part.ask} />
      </p>
      {children}
      {passed && (
        <p role="status" className="text-sm font-semibold text-navy">
          <span aria-hidden>✓ </span>
          Right.
        </p>
      )}
    </section>
  )
}

/** "Reads as" preview of what she typed: the equation drawn by KaTeX (A upper case), or the number with its unit. */
function previewTex(answer: OptimizationAnswer, part: OptPart, value: string): string {
  if (!value.trim()) return ''
  if (part.kind === 'equation') {
    const r = readOptEquation(value, answer.quantity)
    if (!r.ok) return ''
    try {
      return `${nodeToLatex(displayNode(r.lhs, answer.quantity))} = ${nodeToLatex(displayNode(r.rhs, answer.quantity))}`
    } catch {
      return ''
    }
  }
  const n = readOptNumber(value, answer.units)
  if (!n.ok) return ''
  return n.tex || safeLatex(value)
}

/** The keys a box needs: x, y and the quantity's letter for an equation; the problem's units for a number. */
function keysFor(answer: OptimizationAnswer, part: OptPart): { strip: StripKey[]; keypad: readonly StripKey[]; vars?: readonly string[] } {
  if (part.kind === 'equation') {
    const strip: StripKey[] = [
      letterKey('x'),
      letterKey('y'),
      letterKey(answer.quantity),
      { label: '=', insert: ' = ', caret: 0, name: 'equals' },
      { label: '²', insert: '^2', caret: 0, name: 'squared' },
      { label: '(', insert: '(', caret: 0, name: 'open parenthesis' },
      { label: ')', insert: ')', caret: 0, name: 'close parenthesis' },
      { label: '/', insert: '/', caret: 0, name: 'divide' },
    ]
    return { strip, keypad: KEYPAD_SETS.optimization, vars: ['x', 'y', answer.quantity] }
  }
  const c = part.check
  const units: StripKey[] = []
  const u = answer.units.lengthUnit
  if (c.kind === 'number' && (c.dim === 'length' || c.dim === 'area') && u) {
    units.push({ label: u, insert: ` ${u}`, caret: 0, name: u === 'ft' ? 'feet' : u === 'm' ? 'meters' : 'yards' })
    units.push({ label: `${u}²`, insert: ` ${u}²`, caret: 0, name: u === 'ft' ? 'square feet' : u === 'm' ? 'square meters' : 'square yards' })
  }
  if (c.kind === 'number' && c.dim === 'money') units.push({ label: '$', insert: '$', caret: 0, name: 'dollars' })
  if (c.kind === 'number' && c.dim === 'count' && answer.units.count?.[0]) units.push({ label: answer.units.count[0], insert: ` ${answer.units.count[0]}`, caret: 0, name: answer.units.count[0] })
  return { strip: [...units, { label: '/', insert: '/', caret: 0, name: 'divide' }], keypad: units }
}

/**
 * Optimization with quadratics, one part at a time: a later part is not on the page until the one before it is right.
 * Each part has its own three-rung hint ladder; her boxes and the part she is on survive a reload. The letter of her
 * final equation (x or y) decides which value parts 4 and 5 ask for first. The same answer checked twice (or with a
 * trailing space) is one record.
 */
export function OptimizationFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'optimization') return <p className="text-navy">This problem has no optimization question to work with — pick another from the module page.</p>
  return <OptPartsBody {...props} answer={answer} />
}

function OptPartsBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: OptimizationAnswer }) {
  const done = Boolean(completion)
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  const last = answer.stages.length - 1
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const lastChecked = useRef<string | null>(null)
  const boxes = useRef(new Map<string, HTMLInputElement>())
  const hint = useHintLadder(attempt, done, passed)
  const keypadOn = useMathKeypadOn()
  // The final equation's letter, once that part is right: it decides parts 4 and 5.
  const finalText = entries.final ?? ''
  const route: OptVar | null = useMemo(() => (passed > 2 && finalText ? finalRoute(finalText, answer.quantity, answer.domain) : null), [passed, finalText, answer])
  const stages = useMemo(() => stagesFor(answer, route), [answer, route])
  const stage = stages[passed]!

  const restoredFor = useRef<string | null>(attempt?.id ?? null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
    lastChecked.current = null
    setFeedback(null)
    setEntries({ ...attempt.final?.polyEntries })
    setPassed(Math.min(attempt.final?.polyStage ?? 0, last))
  }, [attempt, last])

  const register = useCallback(
    (key: string) => (el: HTMLInputElement | null) => {
      if (el) boxes.current.set(key, el)
      else boxes.current.delete(key)
    },
    [],
  )

  const focusBox = useCallback((key: string) => {
    boxes.current.get(key)?.focus({ preventScroll: true })
  }, [])

  const opened = useRef(passed)
  useEffect(() => {
    if (opened.current === passed) return
    opened.current = passed
    focusBox(stages[passed]!.id)
  }, [passed, stages, focusBox])

  function store(next: Entries) {
    setEntries(next)
    savePolyEntries(next)
    setFeedback((f) => (f && f.grade.verdict === 'invalid' ? null : f))
  }

  function update(key: string, value: string) {
    store({ ...entries, [key]: value })
  }

  function insert(key: string, strip: StripKey) {
    const el = boxes.current.get(key)
    const value = entries[key] ?? ''
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = insertToken(value, start, end, strip)
    update(key, next.value)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.caret, next.caret)
    })
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const text = entries[stage.id] ?? ''
    const g = gradeOptPart(answer, stage, text)
    setFeedback({ stage: passed, grade: g })
    if (g.verdict === 'invalid') {
      focusBox(stage.id)
      return
    }
    const sig = `${attempt?.id ?? ''} ${passed} ${squash(text)}`
    if (lastChecked.current === sig) return
    lastChecked.current = sig
    recordOptPartGrade(g)
    const s = useStore.getState()
    if (g.verdict !== 'correct') {
      s.setFinal({ firstCorrect: false })
      return
    }
    if (passed === last) {
      finish()
      return
    }
    s.setFinal({ polyStage: passed + 1 })
    setPassed(passed + 1)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    check()
  }

  const shown = feedback && feedback.stage === passed ? feedback : null
  const invalid = shown?.grade.verdict === 'invalid'
  const mod = getModule(instance.moduleId)
  const { card, related } = useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? 'all parts checked' : (DOING[stage.id] ?? 'give the answer'),
    solved: done,
    offPath: false,
  }

  const statement = (
    <div className="space-y-3">
      <p className="text-navy">
        <OptTex text={answer.prompt} />
      </p>
      {answer.figure && <OptFigure spec={answer.figure} />}
    </div>
  )

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={shown ? verdictFromOptPart(shown.grade, entries[stage.id] ?? '') : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={statement}
      hints={<OptHintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const value = entries[s.id] ?? ''
        const preview = open ? previewTex(answer, s, value) : ''
        const keys = keysFor(answer, s)
        return (
          <StageCard key={s.id} index={i} total={stages.length} part={s} passed={!open}>
            {open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                {preview && (
                  <div aria-label="Preview" className="flex min-h-10 items-center overflow-x-auto rounded-lg bg-navy-50 px-3 py-1.5 text-navy">
                    <Katex tex={preview} />
                  </div>
                )}
                <PolyTextBox
                  id={`opt-${s.id}`}
                  label={s.label}
                  hint={s.formatHint}
                  placeholder=""
                  value={value}
                  disabled={false}
                  invalid={Boolean(invalid)}
                  onChange={(v) => update(s.id, v)}
                  inputRef={register(s.id)}
                  keypad={{ keys: keys.keypad, ...(keys.vars ? { vars: keys.vars } : {}) }}
                />
                {!keypadOn && <SymbolStrip onInsert={(k) => insert(s.id, k)} keys={keys.strip} disabled={false} />}
                <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  Check
                </button>
                {shown && <GradeNote grade={shown.grade} />}
              </form>
            ) : (
              <PolyTextBox id={`opt-${s.id}`} label={s.label} hint={s.formatHint} placeholder="" value={value} disabled invalid={false} onChange={() => {}} />
            )}
          </StageCard>
        )
      })}

      {done && (
        <section aria-labelledby="opt-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="opt-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <WorkedLines lines={stages.flatMap((s) => s.reveal)} title="How it works out" />
        </section>
      )}
    </ProblemFrame>
  )
}
