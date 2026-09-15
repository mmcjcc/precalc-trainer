/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    /** Written by public/config.js; in the container by docker/20-config.sh. */
    __PRECALC_CONFIG__?: { pinHash: string; signOutUrl?: string }
  }
}
