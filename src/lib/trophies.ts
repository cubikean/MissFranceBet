import { collectionGroup, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth'
import { useSnapshot } from './live'
import { getEdition } from './editions'
import { toParty } from './parties'
import { toResults } from './results'
import { trophyFor } from './game'
import type { Edition, Live, Party, Results, Trophy } from './types'

export interface PartyTrophy {
  party: Party
  /** null si l'édition n'est plus embarquée dans l'app */
  edition: Edition | null
  candidateId: string
  trophy: Trophy
}

/**
 * Mes trophées dans toutes mes parties terminées (status finished), plus récentes d'abord.
 * Calculés côté client à partir de mon prono et des résultats saisis dans chaque party.
 */
export function useMyTrophies(): Live<PartyTrophy[]> {
  const { user } = useAuth()
  return useSnapshot<PartyTrophy[]>(
    user ? `trophies/${user.uid}` : null,
    (next, fail) => {
      const uid = user!.uid
      const inner = new Map<string, Array<() => void>>()
      const parties = new Map<string, Party>()
      const picks = new Map<string, string>()
      const results = new Map<string, Results>()

      const emit = () =>
        next(
          [...parties.values()]
            .filter((p) => p.status === 'finished')
            .flatMap((party) => {
              const candidateId = picks.get(party.id)
              const trophy = candidateId ? trophyFor({ candidateId }, results.get(party.id) ?? null) : null
              return candidateId && trophy ? [{ party, edition: getEdition(party.editionId), candidateId, trophy }] : []
            })
            .sort((a, b) => (b.party.createdAt?.getTime() ?? 0) - (a.party.createdAt?.getTime() ?? 0)),
        )

      const outer = onSnapshot(
        query(collectionGroup(db, 'members'), where('uid', '==', uid)),
        (s) => {
          const ids = new Set(s.docs.map((d) => d.ref.parent.parent!.id))
          for (const [id, unsubs] of inner) {
            if (!ids.has(id)) {
              unsubs.forEach((u) => u())
              inner.delete(id)
              parties.delete(id)
              picks.delete(id)
              results.delete(id)
            }
          }
          for (const id of ids) {
            if (inner.has(id)) continue
            inner.set(id, [
              onSnapshot(
                doc(db, 'parties', id),
                (p) => {
                  if (p.exists()) parties.set(id, toParty(id, p.data()))
                  else parties.delete(id)
                  emit()
                },
                fail,
              ),
              onSnapshot(
                doc(db, 'parties', id, 'picks', uid),
                (p) => {
                  if (p.exists()) picks.set(id, p.data().candidateId)
                  else picks.delete(id)
                  emit()
                },
                fail,
              ),
              onSnapshot(
                doc(db, 'parties', id, 'results', 'live'),
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
