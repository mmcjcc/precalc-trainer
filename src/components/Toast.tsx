import { useEffect } from 'react'
import { useStore, useToasts, type ToastItem } from '@/store'

const AUTO_DISMISS_MS = 6000

function ToastCard({ toast }: { toast: ToastItem }) {
  const dismiss = useStore((s) => s.dismissToast)
  useEffect(() => {
    if (toast.tone === 'bad') return // errors stay until dismissed
    const t = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [toast.id, toast.tone, dismiss])
  const icon = toast.tone === 'ok' ? '✓' : toast.tone === 'bad' ? '✗' : 'ⓘ'
  const border = toast.tone === 'ok' ? 'border-ok' : toast.tone === 'bad' ? 'border-bad' : 'border-navy'
  return (
    <div className={`pointer-events-auto flex items-start gap-3 rounded-2xl border-l-4 ${border} bg-white p-3 shadow-lg ring-1 ring-navy-100`}>
      <span aria-hidden className={`mt-0.5 text-lg leading-none ${toast.tone === 'ok' ? 'text-ok' : toast.tone === 'bad' ? 'text-bad' : 'text-navy'}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-sm text-ink">
        <p className="font-semibold text-navy">{toast.message}</p>
        {toast.detail && <p className="mt-0.5 text-navy/80">{toast.detail}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-navy/60 hover:bg-navy-100 hover:text-navy"
        aria-label="Dismiss"
      >
        <span aria-hidden>×</span>
      </button>
    </div>
  )
}

/** Renders the store's toast queue. Mount once in the shell. */
export function Toasts() {
  const toasts = useToasts()
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  )
}
