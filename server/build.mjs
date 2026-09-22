// Bundles the tutor sidecar into ONE file, server/dist/tutor.mjs (ESM, Node 22), with the provider
// SDKs and src/shared/tutor.ts inside it. esbuild comes with vite (node_modules/esbuild).
//   node server/build.mjs            (from the repository root; the server Dockerfile runs it too)
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const result = await build({
  absWorkingDir: root,
  entryPoints: ['server/src/main.ts'],
  outfile: 'server/dist/tutor.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // The SDKs pull in a few CommonJS dependencies that call require(); give the ESM bundle one.
  banner: { js: "import { createRequire as __tutorCreateRequire } from 'node:module'; const require = __tutorCreateRequire(import.meta.url);" },
  legalComments: 'none',
  sourcemap: false,
  minify: false,
  metafile: true,
  logLevel: 'warning',
})

const bytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0)
console.log(`server/dist/tutor.mjs ${(bytes / 1024).toFixed(0)} KB`)
