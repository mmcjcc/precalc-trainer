/**
 * Which build this is. The family web app (the default) has every class, the AI tutor and the
 * developer sandbox, behind the family's sign-in. The store app (built with `--mode store`, which
 * sets VITE_EDITION=store) is the math classes only, runs offline on a phone, and has no tutor.
 */
export const EDITION: 'family' | 'store' = import.meta.env.VITE_EDITION === 'store' ? 'store' : 'family'

export const STORE = EDITION === 'store'

/** Module subjects the store app leaves out (its classes are math only). */
export const STORE_SKIPS_SUBJECTS: readonly string[] = ['Chemistry']

/** Does this build include a module of this subject? */
export function includesSubject(subject: string | undefined): boolean {
  return !STORE || subject === undefined || !STORE_SKIPS_SUBJECTS.includes(subject)
}
