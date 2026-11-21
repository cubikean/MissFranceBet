import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'
import { requireUid, useAuth } from './auth'
import { AppError } from './errors'
import { toDate, useSnapshot } from './live'
import type { Live, UserProfile } from './types'

export const USERNAME_MIN = 2
export const USERNAME_MAX = 20

/** Pseudo nettoyé : espaces en trop retirés. */
export function normalizeUsername(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Message d'erreur si le pseudo est invalide, sinon null (mêmes contraintes que les règles). */
export function usernameError(name: string): string | null {
  const n = normalizeUsername(name)
  const len = [...n].length
  if (len < USERNAME_MIN) return `Ton pseudo doit faire au moins ${USERNAME_MIN} caractères.`
  if (len > USERNAME_MAX) return `Ton pseudo doit faire au plus ${USERNAME_MAX} caractères.`
  if (n.includes('/')) return 'Ton pseudo ne peut pas contenir de « / ».'
  if (/^__.*__$/.test(n) || n === '.' || n === '..') return 'Choisis un autre pseudo.'
  return null
}

function toProfile(uid: string, d: DocumentData): UserProfile {
  return {
    uid,
    displayName: d.displayName,
    displayNameLower: d.displayNameLower,
    emoji: d.emoji,
    createdAt: toDate(d.createdAt),
  }
}

/**
 * Crée le profil (onboarding) ou change de pseudo, en réservant usernames/{pseudo en minuscules}
 * dans une transaction. Lève AppError('username-taken') si le pseudo est pris.
 */
export async function claimUsername(displayName: string, emoji: string): Promise<void> {
  const uid = requireUid()
  const name = normalizeUsername(displayName)
  const invalid = usernameError(name)
  if (invalid) throw new AppError('username-invalid', invalid)
  const lower = name.toLowerCase()
  const nameRef = doc(db, 'usernames', lower)
  const userRef = doc(db, 'users', uid)

  await runTransaction(db, async (tx) => {
    const nameSnap = await tx.get(nameRef)
    const userSnap = await tx.get(userRef)
    if (nameSnap.exists() && nameSnap.data().uid !== uid) {
      throw new AppError('username-taken', `Le pseudo « ${name} » est déjà pris. Choisis-en un autre.`)
    }
    if (!userSnap.exists()) {
      tx.set(nameRef, { uid })
      tx.set(userRef, { displayName: name, displayNameLower: lower, emoji, createdAt: serverTimestamp() })
      return
    }
    const oldLower: string = userSnap.data().displayNameLower
    if (oldLower !== lower) {
      tx.delete(doc(db, 'usernames', oldLower))
      tx.set(nameRef, { uid })
    }
    tx.update(userRef, { displayName: name, displayNameLower: lower, emoji })
  })
}

/** Modifie pseudo et/ou emoji du profil courant (le pseudo repasse par claimUsername). */
export async function updateProfile(
  current: UserProfile,
  patch: { displayName?: string; emoji?: string },
): Promise<void> {
  const emoji = patch.emoji ?? current.emoji
  if (patch.displayName !== undefined && normalizeUsername(patch.displayName) !== current.displayName) {
    await claimUsername(patch.displayName, emoji)
    return
  }
  await updateDoc(doc(db, 'users', requireUid()), { emoji })
}

/** Profil d'un utilisateur (par défaut : l'utilisateur connecté). null si pas encore créé. */
export function useProfile(uid?: string | null): Live<UserProfile | null> {
  const { user } = useAuth()
  const id = uid === undefined ? (user?.uid ?? null) : uid
  return useSnapshot<UserProfile | null>(
    id ? `users/${id}` : null,
    (next, fail) =>
      onSnapshot(
        doc(db, 'users', id!),
        (s) => next(s.exists() ? toProfile(s.id, s.data({ serverTimestamps: 'estimate' })) : null),
        fail,
      ),
    null,
  )
}

/** Tous les profils (≈20 joueurs), indexés par uid : pour afficher pseudo + emoji. */
export function useUsers(): Live<Record<string, UserProfile>> {
  const { user } = useAuth()
  return useSnapshot<Record<string, UserProfile>>(
    user ? 'users' : null,
    (next, fail) =>
      onSnapshot(
        collection(db, 'users'),
        (s) => next(Object.fromEntries(s.docs.map((d) => [d.id, toProfile(d.id, d.data())]))),
        fail,
      ),
    {},
  )
}
