import type { ReactNode } from 'react'

/** A calculator/keyboard key rendered as <kbd>. */
export function Keycap({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={`keycap ${className ?? ''}`}>{children}</kbd>
}
