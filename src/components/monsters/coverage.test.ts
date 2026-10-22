/**
 * Every screen that names a mistake shows its monster. A card that writes "Not quite: <title>" itself must carry the
 * catch (CaughtBanner) or hand the mistake to a shared card that does (PatternLesson). Found in review: the
 * optimization screen, built beside the monsters, wrote its own card and showed no monster.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return sources(path)
    return e.name.endsWith('.tsx') && !e.name.includes('.test.') ? [path] : []
  })
}

describe('a named mistake shows its monster on every screen', () => {
  it('each card that writes "Not quite: <title>" carries the catch, or passes the mistake to a card that does', () => {
    // Tests run from the project root.
    const files = [...sources(join(process.cwd(), 'src', 'pages')), ...sources(join(process.cwd(), 'src', 'components'))]
    const missing = files.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.includes('Not quite: ${') && !source.includes('CaughtBanner') && !source.includes('PatternLesson')
    })
    expect(missing.map((f) => f.slice(process.cwd().length + 1))).toEqual([])
  })
})
