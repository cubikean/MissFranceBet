import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth'
import { useSnapshot } from './live'
import { toEdition } from './editions'
import { toResults } from './results'
import { trophyFor } from './game'
import type { Edition, Live, Results, Trophy } from './types'

export interface EditionTrophy {
  edition: Edition
  candidateId: string
  trophy: Trophy
}

/**
 * Mes trophées sur toutes les éditions terminées (status finished), plus récentes d'abord.
 * Calculés côté client à partir de mon prono et des résultats de chaque édition.
 */
export function useMyTrophies(): Live<EditionTrophy[]> {
  const { user } = useAuth()
  return useSnapshot<EditionTrophy[]>(
    user ? `trophies/${user.uid}` : null,
    (next, fail) => {
      const uid = user!.uid
      const inner = new Map<string, Array<() => void>>()
      const picks = new Map<string, string>()
      const results = new Map<string, Results>()
      let editions: Edition[] = []

      const emit = () =>
        next(
          editions.flatMap((edition) => {
            const candidateId = picks.get(edition.id)
            const trophy = candidateId ? trophyFor({ candidateId }, results.get(edition.id) ?? null) : null
            return candidateId && trophy ? [{ edition, candidateId, trophy }] : []
          }),
        )

      const outer = onSnapshot(
        query(collection(db, 'editions'), where('status', '==', 'finished')),
        (s) => {
          editions = s.docs
            .map((d) => toEdition(d.id, d.data()))
            .sort((a, b) => b.showAt.getTime() - a.showAt.getTime())
          const ids = new Set(editions.map((e) => e.id))
          for (const [id, unsubs] of inner) {
            if (!ids.has(id)) {
              unsubs.forEach((u) => u())
              inner.delete(id)
              picks.delete(id)
              results.delete(id)
            }
          }
          for (const id of ids) {
            if (inner.has(id)) continue
            inner.set(id, [
              onSnapshot(
                doc(db, 'editions', id, 'picks', uid),
                (p) => {
                  if (p.exists()) picks.set(id, p.data().candidateId)
                  else picks.delete(id)
                  emit()
                },
                fail,
              ),
              onSnapshot(
                doc(db, 'editions', id, 'results', 'live'),
                (r) => {
                  results.set(id, toResults(r.data()))
                  emit()
                },
                fail,
              ),
            ])
          }
          emit()
        },
        fail,
      )
      return () => {
        outer()
        inner.forEach((unsubs) => unsubs.forEach((u) => u()))
      }
    },
    [],
  )
}

