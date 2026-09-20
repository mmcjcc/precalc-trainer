import { BottomSheet } from './BottomSheet'
import { Keycap } from './Keycap'
import { KEYMAP_HELP } from './useKeymap'

/** `?` cheat-sheet (UX-07). `omit` drops the rows of panels this page does not have. */
export function KeymapHelp({ open, onClose, omit = [] }: { open: boolean; onClose: () => void; omit?: ('graph' | 'calc')[] }) {
  const rows = KEYMAP_HELP.filter((row) => !row.panel || !omit.includes(row.panel))
  return (
    <BottomSheet open={open} onClose={onClose} title="Keyboard shortcuts">
      <ul className="space-y-2 text-sm text-navy">
        {rows.map((row) => (
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
