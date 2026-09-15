/**
 * Turns a CalcStep.keys string ("Y= → Y1 = ³√(7X+3)-1", "menu → Window/Zoom → Zoom – Standard")
 * into keycap / code / text tokens for rendering. Pure.
 */
export type KeyToken = { kind: 'kbd' | 'code' | 'text' | 'arrow'; text: string }

const KEY_WORDS = new Set([
  '2nd',
  'ALPHA',
  'MATH',
  'MODE',
  'PRGM',
  'VARS',
  'WINDOW',
  'GRAPH',
  'TABLE',
  'TRACE',
  'ZOOM',
  'ENTER',
  'CLEAR',
  'DEL',
  'STAT',
  'QUIT',
  'TBLSET',
  'DRAW',
  'Y=',
  'Y-VARS',
  'X,T,θ,n',
  'menu',
  'ctrl',
  'tab',
  'esc',
  'doc',
  'enter',
  'del',
  'shift',
  'var',
  'Scratchpad',
  '(−)',
  '(-)',
  '◄',
  '►',
  '▲',
  '▼',
  '⌸',
])

const MENU_ITEM = /^[0-9A-Z]:[A-Za-z][\w–-]*$/ // 6:ZStandard, 8:DrawInv, B:Zoom-Square

function isKeyWord(word: string): boolean {
  return KEY_WORDS.has(word) || MENU_ITEM.test(word) || /^[◄►▲▼]+$/.test(word)
}

const ASSIGNMENT = /^\s*(Y\d|f\d\(x\)|f\d|x)\s*=/i

function tokenizeSegment(seg: string, out: KeyToken[]): void {
  const s = seg.trim()
  if (!s) return
  if (ASSIGNMENT.test(s)) {
    out.push({ kind: 'code', text: s })
    return
  }
  const words = s.split(/\s+/)
  let text: string[] = []
  const flushText = () => {
    if (text.length) out.push({ kind: 'text', text: text.join(' ') })
    text = []
  }
  for (const raw of words) {
    const m = raw.match(/^(.*?)([,.;:]?)$/)
    const word = m?.[1] ?? raw
    const punct = m?.[2] ?? ''
    if (isKeyWord(word)) {
      flushText()
      out.push({ kind: 'kbd', text: word })
      if (punct) text.push(punct)
    } else {
      text.push(raw)
    }
  }
  flushText()
}

export function tokenizeKeys(keys: string): KeyToken[] {
  const out: KeyToken[] = []
  const segments = keys.split(/\s*→\s*/)
  segments.forEach((seg, i) => {
    if (i > 0) out.push({ kind: 'arrow', text: '→' })
    tokenizeSegment(seg, out)
  })
  return out
}
