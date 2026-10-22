import { useState } from 'react'
import { KEYPAD_SETS } from '@/components/keypadKeys'
import { MathTextInput } from '@/components/MathTextInput'
import { plainNumber } from '@/grapher/format'
import { evaluateConstant } from '@/grapher/model'

const DONE = { label: 'Done', name: 'done' }

/** A number box that commits on Enter or when she leaves it, and shows the stored value otherwise. */
export function NumberBox({ id, label, value, onCommit, className = 'w-20' }: { id?: string; label: string; value: number; onCommit: (v: number) => void; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const v = evaluateConstant(draft)
    if (v !== null) onCommit(v)
    setDraft(null)
  }
  return (
    <MathTextInput
      id={id}
      type="text"
      aria-label={label}
      value={draft ?? plainNumber(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
      keypad={{ keys: KEYPAD_SETS.number, enter: DONE }}
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      className={`min-h-11 min-w-0 rounded-lg border-2 border-navy-100 bg-white px-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy ${className}`}
    />
  )
}

