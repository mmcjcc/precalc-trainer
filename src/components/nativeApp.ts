/**
 * Inside the phone app (the Capacitor fork wraps this web app), `window.Capacitor.isNativePlatform()` is true. The
 * web app never loads Capacitor, so there it is absent and this is false. Links into the app's own pages mean
 * nothing outside it there (its address is local to the phone), so the app hides "Copy link".
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.Capacitor?.isNativePlatform?.() === true
  } catch {
    return false
  }
}
