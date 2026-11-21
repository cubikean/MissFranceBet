import { doc, onSnapshot, type DocumentData } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth'
import { toDate, useSnapshot } from './live'
import { EMPTY_RESULTS } from './game'
import type { Live, Results } from './types'

export function toResults(d: DocumentData | undefined): Results {
  if (!d) return EMPTY_RESULTS
  return {
    top15: Array.isArray(d.top15) ? d.top15 : null,
    top5: Array.isArray(d.top5) ? d.top5 : null,
    winner: d.winner ?? null,
    firstRunnerUp: d.firstRunnerUp ?? null,
    secondRunnerUp: d.secondRunnerUp ?? null,
    updatedAt: toDate(d.updatedAt),
  }
}

/** Résultats en direct de la party, saisis par son admin (EMPTY_RESULTS tant que rien n'est saisi). */
export function useResults(partyId: string | null): Live<Results> {
  const { user } = useAuth()
  return useSnapshot<Results>(
    user && partyId ? `parties/${partyId}/results/live` : null,
    (next, fail) =>
      onSnapshot(
        doc(db, 'parties', partyId!, 'results', 'live'),
        (s) => next(toResults(s.data({ serverTimestamps: 'estimate' }))),
        fail,
      ),
    EMPTY_RESULTS,
  )
}
