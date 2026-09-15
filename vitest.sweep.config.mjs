// Opt-in engine regression sweep: `npm run test:sweep` (about 100 s). Not part of `npm test`.
import { fileURLToPath } from 'node:url'

export default {
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.sweep.ts'], environment: 'node', testTimeout: 300000 },
}
