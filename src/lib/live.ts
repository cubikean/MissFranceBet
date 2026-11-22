import { useEffect, useState } from 'react'
import type { Unsubscribe } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { isPermissionDenied } from './errors'
import type { Live } from './types'

type Subscribe<T> = (next: (value: T) => void, fail: (error: Error) => void) => Unsubscribe

/** Délai avant le réabonnement unique qui suit un refus des règles. */
export const RETRY_AFTER_DENIED_MS = 1200

export interface SnapshotOptions {
  /** Quand `key` change, garder les données précédentes pendant le chargement (ex. profils). */
  keepData?: boolean
}

/**
 * Brique commune des hooks temps réel : s'abonne quand `key` change,
 * se désabonne au démontage. `key === null` = pas d'abonnement (données absentes).
 * `key` doit encoder tout ce dont dépend `subscribe` (ex. un chemin Firestore).
 *
 * Un refus des règles (permission-denied) tue l'écouteur côté Firestore. Il arrive aussi juste
 * après une écriture locale pas encore confirmée par le serveur (création, adhésion, fermeture des
 * pronos) : on se réabonne donc une fois, après un court délai, avant d'exposer l'erreur.
 */
export function useSnapshot<T>(
  key: string | null,
  subscribe: Subscribe<T>,
  initial: T,
  options: SnapshotOptions = {},
): Live<T> {
  const [state, setState] = useState<{
    key: string | null
    data: T
    error: Error | null
    ready: boolean
  }>({ key: null, data: initial, error: null, ready: false })

  useEffect(() => {
    if (key === null) return
    let unsub: Unsubscribe | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let retried = false
    let stopped = false
    const start = () => {
      unsub = subscribe(
        (data) => setState({ key, data, error: null, ready: true }),
        (error) => {
          if (!retried && isPermissionDenied(error)) {
            retried = true
            timer = setTimeout(() => {
              if (stopped) return
              unsub?.() // libère aussi les écouteurs internes (ex. useMyParties)
              start()
            }, RETRY_AFTER_DENIED_MS)
            return
          }
          console.error(`[firestore] ${key}`, error)
          setState((s) => ({ key, data: s.key === key ? s.data : initial, error, ready: true }))
        },
      )
    }
    start()
    return () => {
      stopped = true
      clearTimeout(timer)
      unsub?.()
    }
    // `key` encode les dépendances de `subscribe` et `initial`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (key === null) return { data: initial, loading: false, error: null }
  if (state.key !== key) {
    return { data: options.keepData && state.ready && !state.error ? state.data : initial, loading: true, error: null }
  }
  return { data: state.data, loading: !state.ready, error: state.error }
}

/** Timestamp Firestore (ou estimation locale d'un serverTimestamp en attente) → Date. */
export function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  return null
}
