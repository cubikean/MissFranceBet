// Administration : actions de l'admin d'une party (son créateur) ou du super admin.
// Les règles Firestore vérifient les droits ; ces fonctions ne font qu'écrire proprement.
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { requireUid, useAuth } from './auth'
import { AppError } from './errors'
import { useSnapshot } from './live'
import { PARTY_NAME_MAX, PARTY_NAME_MIN } from './parties'
import type { Live, Party, PartyStatus, Results } from './types'

/** true si admins/{uid} existe : super admin (document créé à la main dans la console). */
export function useIsSuperAdmin(): Live<boolean> {
  const { user } = useAuth()
  return useSnapshot<boolean>(
    user ? `admins/${user.uid}` : null,
    (next, fail) => onSnapshot(doc(db, 'admins', user!.uid), (s) => next(s.exists()), fail),
    false,
  )
}

/**
 * Change la phase de la party (retour en arrière permis). Écrit dans le même batch
 * l'entrée parties/{p}/events/{n} (de, vers, par qui, heure serveur), visible de tous les membres.
 * Passe la party telle que lue : son statusChanges sert de compteur.
 */
export async function setPartyStatus(party: Party, status: PartyStatus): Promise<void> {
  const uid = requireUid()
  if (status === party.status) return
  const n = party.statusChanges + 1
  const batch = writeBatch(db)
  batch.update(doc(db, 'parties', party.id), { status, statusChanges: n })
  batch.set(doc(db, 'parties', party.id, 'events', String(n)), {
    from: party.status,
    to: status,
    by: uid,
    at: serverTimestamp(),
  })
  await batch.commit()
}

/** Renomme la party. */
export async function renameParty(partyId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (trimmed.length < PARTY_NAME_MIN || trimmed.length > PARTY_NAME_MAX) {
    throw new AppError('party-invalid', `Le nom doit faire entre ${PARTY_NAME_MIN} et ${PARTY_NAME_MAX} caractères.`)
  }
  await updateDoc(doc(db, 'parties', partyId), { name: trimmed })
}

/** Retire un membre de la party (pas son créateur). */
export async function removeMember(partyId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, 'parties', partyId, 'members', uid))
}

/** Saisit tout ou partie des résultats de la party (fusion). Passe null pour effacer un champ. */
export async function setResults(partyId: string, patch: Partial<Omit<Results, 'updatedAt'>>): Promise<void> {
  await setDoc(
    doc(db, 'parties', partyId, 'results', 'live'),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  )
}
