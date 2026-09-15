// Global Vitest setup. UI tests opt into jsdom with a `// @vitest-environment jsdom` docblock.
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})
