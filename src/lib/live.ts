import { useEffect, useState } from 'react'
import type { Unsubscribe } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import type { Live } from './types'

type Subscribe<T> = (next: (value: T) => void, fail: (error: Error) => void) => Unsubscribe

/**
 * Brique commune des hooks temps réel : s'abonne quand `key` change,
 * se désabonne au démontage. `key === null` = pas d'abonnement (données absentes).
 * `key` doit encoder tout ce dont dépend `subscribe` (ex. un chemin Firestore).
 */
export function useSnapshot<T>(key: string | null, subscribe: Subscribe<T>, initial: T): Live<T> {
  const [state, setState] = useState<{
    key: string | null
    data: T
    error: Error | null
    ready: boolean
  }>({ key: null, data: initial, error: null, ready: false })

  useEffect(() => {
    if (key === null) return
    return subscribe(
      (data) => setState({ key, data, error: null, ready: true }),
      (error) => {
        console.error(`[firestore] ${key}`, error)
        setState((s) => ({ key, data: s.key === key ? s.data : initial, error, ready: true }))
      },
    )
    // `key` encode les dépendances de `subscribe` et `initial`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (key === null) return { data: initial, loading: false, error: null }
  if (state.key !== key) return { data: initial, loading: true, error: null }
  return { data: state.data, loading: !state.ready, error: state.error }
}

/** Timestamp Firestore (ou estimation locale d'un serverTimestamp en attente) → Date. */
export function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  return null
}
