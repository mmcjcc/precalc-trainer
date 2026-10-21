/** A tiny publish/subscribe channel: the juice's moments (useJuice.ts) reach the layers mounted once in the shell. */
export interface Channel<T> {
  emit: (value: T) => void
  on: (listener: (value: T) => void) => () => void
}

export function channel<T>(): Channel<T> {
  const listeners = new Set<(value: T) => void>()
  return {
    emit: (value) => {
      for (const l of [...listeners]) l(value)
    },
    on: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
