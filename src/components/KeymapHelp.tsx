import { BottomSheet } from './BottomSheet'
import { Keycap } from './Keycap'
import { KEYMAP_HELP } from './useKeymap'

/** `?` cheat-sheet (UX-07). */
export function KeymapHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Keyboard shortcuts">
      <ul className="space-y-2 text-sm text-navy">
        {KEYMAP_HELP.map((row) => (
          <li key={row.does} className="flex items-center justify-between gap-3">
            <span>{row.does}</span>
            <span className="flex shrink-0 items-center gap-1">
              {row.keys.map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden>+</span>}
                  <Keycap>{k}</Keycap>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
