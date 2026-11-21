import {
  collection,
  doc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'
import { requireUid, useAuth } from './auth'
import { AppError, isPermissionDenied } from './errors'
import { toDate, useSnapshot } from './live'
import type { Live, Pick, PickHistoryEntry } from './types'

function toPick(uid: string, d: DocumentData): Pick {
  return { uid, candidateId: d.candidateId, changeCount: d.changeCount, updatedAt: toDate(d.updatedAt) }
}

function toHistory(id: string, d: DocumentData): PickHistoryEntry {
  return { id, uid: d.uid, candidateId: d.candidateId, changeCount: d.changeCount, at: toDate(d.at) }
}

/**
 * Choisit (ou change) ma candidate. Un seul batch atomique :
 * picks/{uid} (changeCount + 1, updatedAt serveur) + pickHistory/{uid}_{n} + members/{uid}.hasPicked.
 * Sans effet si c'est déjà ma candidate. Lève AppError('picks-closed') si les règles refusent.
 */
export async function setPick(editionId: string, candidateId: string): Promise<{ changeCount: number }> {
  const uid = requireUid()
  const pickRef = doc(db, 'editions', editionId, 'picks', uid)
  const current = await getDocFromServer(pickRef)
  if (current.exists() && current.data().candidateId === candidateId) {
    return { changeCount: current.data().changeCount as number }
  }
  const n = (current.exists() ? (current.data().changeCount as number) : 0) + 1

  const batch = writeBatch(db)
  batch.set(pickRef, { candidateId, changeCount: n, updatedAt: serverTimestamp() })
  batch.set(doc(db, 'editions', editionId, 'pickHistory', `${uid}_${n}`), {
    uid,
    candidateId,
    changeCount: n,
    at: serverTimestamp(),
  })
  batch.update(doc(db, 'editions', editionId, 'members', uid), { hasPicked: true })
  try {
    await batch.commit()
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new AppError('picks-closed', "Ton choix n'a pas été enregistré : les pronos sont fermés.")
    }
    throw error
  }
  return { changeCount: n }
}

/** Mon prono pour l'édition (null si pas encore choisi). */
export function useMyPick(editionId: string | null): Live<Pick | null> {
  const { user } = useAuth()
  return useSnapshot<Pick | null>(
    user && editionId ? `editions/${editionId}/picks/${user.uid}` : null,
    (next, fail) =>
      onSnapshot(
        doc(db, 'editions', editionId!, 'picks', user!.uid),
        (s) => next(s.exists() ? toPick(s.id, s.data({ serverTimestamps: 'estimate' })) : null),
        fail,
      ),
    null,
  )
}

/**
 * Tous les pronos. Lisibles seulement après la fermeture (ou par l'admin) :
 * passe `null` tant que l'édition est `open`, sinon tu recevras une erreur permission-denied.
 */
export function usePicks(editionId: string | null): Live<Pick[]> {
  const { user } = useAuth()
  return useSnapshot<Pick[]>(
    user && editionId ? `editions/${editionId}/picks` : null,
    (next, fail) =>
      onSnapshot(
        collection(db, 'editions', editionId!, 'picks'),
        (s) => next(s.docs.map((d) => toPick(d.id, d.data({ serverTimestamps: 'estimate' })))),
        fail,
      ),
    [],
  )
}

/**
 * Historique des changements d'avis, trié par uid puis changeCount.
 * scope 'mine' : toujours lisible. scope 'all' : après la fermeture ou admin (sinon passe null).
 */
export function usePickHistory(
  editionId: string | null,
  scope: 'mine' | 'all',
): Live<PickHistoryEntry[]> {
  const { user } = useAuth()
  return useSnapshot<PickHistoryEntry[]>(
    user && editionId ? `editions/${editionId}/pickHistory?${scope === 'mine' ? user.uid : '*'}` : null,
    (next, fail) => {
      const col = collection(db, 'editions', editionId!, 'pickHistory')
      const q = scope === 'mine' ? query(col, where('uid', '==', user!.uid)) : col
      return onSnapshot(
        q,
        (s) =>
          next(
            s.docs
              .map((d) => toHistory(d.id, d.data({ serverTimestamps: 'estimate' })))
              .sort((a, b) => a.uid.localeCompare(b.uid) || a.changeCount - b.changeCount),
          ),
        fail,
      )
    },
    [],
  )
}
