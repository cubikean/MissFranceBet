import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'
import { requireUid, useAuth } from './auth'
import { AppError, isPermissionDenied } from './errors'
import { toDate, useSnapshot } from './live'
import type { Edition, Live, Membership } from './types'

export function toEdition(id: string, d: DocumentData): Edition {
  return {
    id,
    title: d.title,
    showAt: toDate(d.showAt) ?? new Date(0),
    status: d.status,
    createdAt: toDate(d.createdAt),
  }
}

/** Code de soirée normalisé (même normalisation à la création et à la saisie). */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase()
}

/** Toutes les éditions, la plus récente (showAt) en premier. */
export function useEditions(): Live<Edition[]> {
  const { user } = useAuth()
  return useSnapshot<Edition[]>(
    user ? 'editions' : null,
    (next, fail) =>
      onSnapshot(
        query(collection(db, 'editions'), orderBy('showAt', 'desc')),
        (s) => next(s.docs.map((d) => toEdition(d.id, d.data({ serverTimestamps: 'estimate' })))),
        fail,
      ),
    [],
  )
}

/** Édition en cours = dernière par date d'émission. null s'il n'y en a aucune. */
export function useCurrentEdition(): Live<Edition | null> {
  const { user } = useAuth()
  return useSnapshot<Edition | null>(
    user ? 'editions:current' : null,
    (next, fail) =>
      onSnapshot(
        query(collection(db, 'editions'), orderBy('showAt', 'desc'), limit(1)),
        (s) => {
          const d = s.docs[0]
          next(d ? toEdition(d.id, d.data({ serverTimestamps: 'estimate' })) : null)
        },
        fail,
      ),
    null,
  )
}

/** Une édition précise. */
export function useEdition(editionId: string | null): Live<Edition | null> {
  const { user } = useAuth()
  return useSnapshot<Edition | null>(
    user && editionId ? `editions/${editionId}` : null,
    (next, fail) =>
      onSnapshot(
        doc(db, 'editions', editionId!),
        (s) => next(s.exists() ? toEdition(s.id, s.data({ serverTimestamps: 'estimate' })) : null),
        fail,
      ),
    null,
  )
}

/**
 * Rejoint l'édition avec le code de soirée. Le code est vérifié par les règles Firestore :
 * un mauvais code lève AppError('wrong-code'). Sans effet si déjà membre.
 */
export async function joinEdition(editionId: string, code: string): Promise<void> {
  const uid = requireUid()
  const ref = doc(db, 'editions', editionId, 'members', uid)
  if ((await getDoc(ref)).exists()) return
  try {
    await setDoc(ref, { joinedAt: serverTimestamp(), code: normalizeCode(code), hasPicked: false })
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new AppError('wrong-code', "Ce code ne marche pas. Vérifie-le auprès de l'organisateur.")
    }
    throw error
  }
}

function toMembership(uid: string, d: DocumentData): Membership {
  return { uid, joinedAt: toDate(d.joinedAt), hasPicked: d.hasPicked === true }
}

/** Mon adhésion à l'édition : null si je ne l'ai pas rejointe. */
export function useMembership(editionId: string | null): Live<Membership | null> {
  const { user } = useAuth()
  return useSnapshot<Membership | null>(
    user && editionId ? `editions/${editionId}/members/${user.uid}` : null,
    (next, fail) =>
      onSnapshot(
        doc(db, 'editions', editionId!, 'members', user!.uid),
        (s) => next(s.exists() ? toMembership(s.id, s.data({ serverTimestamps: 'estimate' })) : null),
        fail,
      ),
    null,
  )
}

/** Tous les membres (lisible par les membres) : compte des joueurs et de ceux qui ont pronostiqué. */
export function useMembers(editionId: string | null): Live<Membership[]> {
  const { user } = useAuth()
  return useSnapshot<Membership[]>(
    user && editionId ? `editions/${editionId}/members` : null,
    (next, fail) =>
      onSnapshot(
        collection(db, 'editions', editionId!, 'members'),
        (s) => next(s.docs.map((d) => toMembership(d.id, d.data({ serverTimestamps: 'estimate' })))),
        fail,
      ),
    [],
  )
}
