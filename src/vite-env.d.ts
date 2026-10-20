/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    /** Written by public/config.js; in the container by docker/20-config.sh. */
    __PRECALC_CONFIG__?: { pinHash: string; signOutUrl?: string }
    /** Present only inside the phone app (the Capacitor fork injects it); this repo has no Capacitor dependency. */
    Capacitor?: { isNativePlatform?: () => boolean }
  }
}
