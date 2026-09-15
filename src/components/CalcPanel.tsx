import { Fragment, useEffect, useState } from 'react'
import { CALC_LABEL, type CalcId, type CalcPanels } from '@/shared/types'
import { useSettings, useStore } from '@/store'
import { tokenizeKeys } from './calcKeys'
import { Keycap } from './Keycap'

type Props = {
  panels: CalcPanels
  /** The expression to offer under "Copy expression" (app syntax or calculator syntax). */
  expression?: string
  footer?: string
  /** Start collapsed (mobile default per UX-17); remembered per session. */
  collapsible?: boolean
}

const CALC_IDS: CalcId[] = ['ti84', 'nspire']

function KeysLine({ keys }: { keys: string }) {
  const tokens = tokenizeKeys(keys)
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg bg-gold-100 px-2 py-1.5 text-[13px] leading-snug text-navy">
      {tokens.map((t, i) => (
        <Fragment key={i}>
          {t.kind === 'kbd' && <Keycap>{t.text}</Keycap>}
          {t.kind === 'code' && <code className="rounded bg-white px-1.5 py-0.5 font-mono text-navy ring-1 ring-navy-100">{t.text}</code>}
          {t.kind === 'arrow' && (
            <span aria-hidden className="text-navy/50">
              →
            </span>
          )}
          {t.kind === 'text' && <span>{t.text}</span>}
        </Fragment>
      ))}
    </p>
  )
}

/**
 * Calculator panel: segmented control (persisted in settings.calculator), ordered keycap steps,
 * cautions in coral-700 with an icon and the word "Careful", and a copy-expression button.
 */
export function CalcPanel({ panels, expression, footer, collapsible = false }: Props) {
  const settings = useSettings()
  const setSettings = useStore((s) => s.setSettings)
  const calc = settings.calculator
  const steps = panels[calc] ?? []
  const [open, setOpen] = useState(!collapsible)
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    if (copied === 'idle') return
    const t = setTimeout(() => setCopied('idle'), 2000)
    return () => clearTimeout(t)
  }, [copied])

  async function copy() {
    if (!expression) return
    try {
      await navigator.clipboard.writeText(expression)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
  }

  return (
    <section className="rounded-2xl border border-navy-100 bg-white p-4" aria-label="Calculator steps">
      <div className="mb-3 flex gap-2" role="group" aria-label="Which calculator">
        {CALC_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={calc === id}
            onClick={() => setSettings({ calculator: id })}
            className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${calc === id ? 'bg-navy text-white' : 'bg-navy-100 text-navy hover:bg-navy-50'}`}
          >
            {CALC_LABEL[id]}
          </button>
        ))}
      </div>

      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mb-2 min-h-11 w-full rounded-lg border border-navy-100 px-3 text-left text-sm font-semibold text-navy"
        >
          {open ? 'Hide' : 'Show'} the {steps.length} steps
        </button>
      )}

      {/* Not collapsible (e.g. the layout widened after mount) → always show the steps. */}
      {(open || !collapsible) && (
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="text-sm">
              <div className="font-semibold text-navy">
                {i + 1}. {step.title}
              </div>
              <KeysLine keys={step.keys} />
              {step.why && <p className="mt-1 text-navy/70">{step.why}</p>}
              {step.caution && (
                <p className="mt-1 text-coral-700">
                  <span aria-hidden>⚠ </span>
                  <span className="font-semibold">Careful: </span>
                  {step.caution}
                </p>
              )}
            </li>
          ))}
          {steps.length === 0 && <li className="text-sm text-navy/60">No calculator steps for this problem.</li>}
        </ol>
      )}

      {expression && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="rounded bg-navy-50 px-2 py-1 font-mono text-sm text-navy">{expression}</code>
          <button type="button" onClick={copy} className="min-h-10 rounded-lg border border-navy-100 px-3 text-sm font-semibold text-navy hover:bg-navy-50">
            Copy expression
          </button>
          <span role="status" className="text-sm text-navy/70">
            {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Could not copy — select it and copy by hand' : ''}
          </span>
        </div>
      )}
      {footer && <p className="mt-4 text-xs text-navy/50">{footer}</p>}
    </section>
  )
}
