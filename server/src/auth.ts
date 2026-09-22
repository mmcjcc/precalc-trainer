/**
 * Who is asking. Container Apps authentication (Sign in with Google) sets X-MS-CLIENT-PRINCIPAL-NAME
 * to the signed-in account's email and strips it from outside requests; nginx has already checked it
 * against ALLOWED_USERS. The sidecar checks again (defence in depth): a request that reaches it
 * without a listed account is refused, even if nginx were misconfigured or AUTH_ALLOWLIST=off.
 */
import type { IncomingMessage } from 'node:http'

export const PRINCIPAL_HEADER = 'x-ms-client-principal-name'

export type Caller =
  | { ok: true; user: string; isParent: boolean }
  | { ok: false }

export function identify(req: IncomingMessage, allowed: ReadonlySet<string>, parents: ReadonlySet<string>): Caller {
  const raw = req.headers[PRINCIPAL_HEADER]
  // Node joins two copies of the header into "a, b", which matches no entry: refused, never guessed.
  if (typeof raw !== 'string') return { ok: false }
  const user = raw.trim().toLowerCase()
  if (!user || !allowed.has(user)) return { ok: false }
  return { ok: true, user, isParent: parents.has(user) }
}
