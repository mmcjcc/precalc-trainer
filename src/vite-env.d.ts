/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    __PRECALC_CONFIG__?: { pinHash: string }
  }
}
