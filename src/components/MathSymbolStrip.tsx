import { STRIP_KEYS, type StripKey } from './symbolStrip'

type Props = {
  onInsert: (key: StripKey) => void
  keys?: readonly StripKey[]
  disabled?: boolean
}

/**
 * One horizontally scrollable row of 44×44 keys (UX-06). pointerdown is prevented so tapping a key
 * never blurs the input (iOS would close the keyboard) — UX-02.
 */
export function SymbolStrip({ onInsert, keys = STRIP_KEYS, disabled = false }: Props) {
  return (
    <div role="toolbar" aria-label="Math symbols" className="symbol-strip -mx-1 flex gap-1 overflow-x-auto px-1 py-1">
      {keys.map((k) => (
        <button
          key={k.insert + k.label}
          type="button"
          disabled={disabled}
          aria-label={k.name}
          title={k.insert.trim()}
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(k)}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-navy-100 bg-white px-2 font-mono text-base text-navy hover:bg-gold-100 active:bg-gold disabled:opacity-50"
        >
          {k.label}
        </button>
      ))}
    </div>
  )
}
