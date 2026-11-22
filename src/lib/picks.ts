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
  type DocumentReference,
} from 'firebase/firestore'
import { db } from './firebase'
import { requireUid, useAuth } from './auth'
import { AppError, isPermissionDenied } from './errors'
import { toDate, useSnapshot } from './live'
import { getCandidate } from './candidates'
import type { Live, Party, Pick, PickHistoryEntry } from './types'

function toPick(uid: string, d: DocumentData): Pick {
  return { uid, candidateId: d.candidateId, changeCount: d.changeCount, updatedAt: toDate(d.updatedAt) }
}

function toHistory(id: string, d: DocumentData): PickHistoryEntry {
  return { id, uid: d.uid, candidateId: d.candidateId, changeCount: d.changeCount, at: toDate(d.at) }
}

/**
 * Choisit (ou change) ma candidate dans la party. Un seul batch atomique :
 * picks/{uid} (changeCount + 1, updatedAt serveur) + pickHistory/{uid}_{n} + members/{uid}.hasPicked.
 * Sans effet si c'est déjà ma candidate. Lève AppError('unknown-candidate') si la candidate
 * n'appartient pas à l'édition de la party ; si les règles refusent, AppError('picks-closed'),
 * 'not-member' (retiré, party supprimée) ou 'pick-conflict' (changé sur un autre appareil).
 */
export async function setPick(party: Party, candidateId: string): Promise<{ changeCount: number }> {
  const uid = requireUid()
  // Les règles ne voient pas les données embarquées : la candidate est vérifiée ici.
  // Un id inventé ne ferait de toute façon gagner aucun trophée.
  if (!getCandidate(party.editionId, candidateId)) {
    throw new AppError('unknown-candidate', "Cette candidate n'existe pas pour cette édition.")
  }
  const pickRef = doc(db, 'parties', party.id, 'picks', uid)
  const current = await getDocFromServer(pickRef)
  if (current.exists() && current.data().candidateId === candidateId) {
    return { changeCount: current.data().changeCount as number }
  }
  const n = (current.exists() ? (current.data().changeCount as number) : 0) + 1

  const batch = writeBatch(db)
  batch.set(pickRef, { candidateId, changeCount: n, updatedAt: serverTimestamp() })
  batch.set(doc(db, 'parties', party.id, 'pickHistory', `${uid}_${n}`), {
    uid,
    candidateId,
    changeCount: n,
    at: serverTimestamp(),
  })
  batch.update(doc(db, 'parties', party.id, 'members', uid), { hasPicked: true })
  try {
    await batch.commit()
  } catch (error) {
    if (isPermissionDenied(error)) throw await explainRefusal(party.id, pickRef, n - 1)
    throw error
  }
  return { changeCount: n }
}

/**
 * Pourquoi les règles ont refusé le prono : on relit la party et mon prono sur le serveur.
 * Pronos fermés, party supprimée ou quittée (retrait), ou prono changé entre-temps sur un autre
 * appareil (le compteur ne suit plus).
 */
async function explainRefusal(partyId: string, pickRef: DocumentReference, expectedCount: number): Promise<AppError> {
  const notSaved = "Ton choix n'a pas été enregistré"
  try {
    const party = await getDocFromServer(doc(db, 'parties', partyId))
    if (!party.exists() || party.data().status === 'deleted') {
      return new AppError('not-member', `${notSaved}\u00a0: cette party a été supprimée.`)
    }
    if (party.data().status !== 'open') return new AppError('picks-closed', `${notSaved}\u00a0: les pronos sont fermés.`)
    const mine = await getDocFromServer(pickRef)
    const count = mine.exists() ? (mine.data().changeCount as number) : 0
    if (count !== expectedCount) {
      return new AppError('pick-conflict', `${notSaved}\u00a0: ton prono vient de changer sur un autre appareil. Vérifie-le et réessaie.`)
    }
  } catch (e) {
    if (isPermissionDenied(e)) return new AppError('not-member', `${notSaved}\u00a0: tu ne fais plus partie de cette party.`)
  }
  return new AppError('picks-closed', `${notSaved}. Réessaie dans un instant.`)
}

/** Mon prono dans la party (null si pas encore choisi). */
export function useMyPick(partyId: string | null): Live<Pick | null> {
  const { user } = useAuth()
  return useSnapshot<Pick | null>(
    user && partyId ? `parties/${partyId}/picks/${user.uid}` : null,
    (next, fail) =>
      onSnapshot(
        doc(db, 'parties', partyId!, 'picks', user!.uid),
        (s) => next(s.exists() ? toPick(s.id, s.data({ serverTimestamps: 'estimate' })) : null),
        fail,
      ),
    null,
  )
}

/**
 * Tous les pronos de la party. Lisibles seulement après la fermeture, par personne avant
 * (ni l'admin de la party, ni le super admin) : passe `null` tant que la party est `open`,
 * sinon tu recevras une erreur permission-denied.
 */
export function usePicks(partyId: string | null): Live<Pick[]> {
  const { user } = useAuth()
  return useSnapshot<Pick[]>(
    user && partyId ? `parties/${partyId}/picks` : null,
    (next, fail) =>
      onSnapshot(
        collection(db, 'parties', partyId!, 'picks'),
        (s) => next(s.docs.map((d) => toPick(d.id, d.data({ serverTimestamps: 'estimate' })))),
        fail,
      ),
    [],
  )
}

/**
 * Historique des changements d'avis, trié par uid puis changeCount.
 * scope 'mine' : toujours lisible. scope 'all' : seulement après la fermeture (sinon passe null).
 */
export function usePickHistory(partyId: string | null, scope: 'mine' | 'all'): Live<PickHistoryEntry[]> {
  const { user } = useAuth()
  return useSnapshot<PickHistoryEntry[]>(
    user && partyId ? `parties/${partyId}/pickHistory?${scope === 'mine' ? user.uid : '*'}` : null,
    (next, fail) => {
      const col = collection(db, 'parties', partyId!, 'pickHistory')
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
