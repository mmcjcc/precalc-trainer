// npm run tutor:mock — the tutor sidecar with the MOCK provider on http://127.0.0.1:3000, for UI work.
// No key, no network. Any variable already set in the environment wins over these defaults, e.g.
//   TUTOR_DAILY_LIMIT=3 npm run tutor:mock        (to see the limit message quickly)
// The Vite dev server must send X-MS-CLIENT-PRINCIPAL-NAME: dev@localhost.test on /api/ (see
// docs/progress/tutor-core.md, "Run it locally"): the tutor refuses requests without a listed account.
process.env.TUTOR_PROVIDER ??= 'mock'
process.env.ALLOWED_USERS ??= 'dev@localhost.test'
process.env.PARENT_USERS ??= 'dev@localhost.test'
process.env.TUTOR_DAILY_LIMIT ??= '30'
await import('./dist/tutor.mjs')
