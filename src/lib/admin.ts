// Administration : actions de l'admin d'une party (son créateur, ou celui à qui il a transmis
// le rôle) ou du super admin. Les règles Firestore vérifient les droits ; ces fonctions ne font
// qu'écrire proprement.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { requireUid, useAuth } from './auth'
import { AppError } from './errors'
import { toDate, useSnapshot } from './live'
import { PARTY_NAME_MAX, PARTY_NAME_MIN, setActivePartyId } from './parties'
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
 * Change la phase de la party (retour en arrière permis). Écrit dans le même batch l'entrée
 * parties/{p}/events/{n} (type 'status', de, vers, par qui, heure serveur), visible des membres.
 * Passe la party telle que lue : son eventCount sert de compteur.
 */
export async function setPartyStatus(party: Party, status: PartyStatus): Promise<void> {
  const uid = requireUid()
  if (status === party.status) return
  const n = party.eventCount + 1
  const batch = writeBatch(db)
  batch.update(doc(db, 'parties', party.id), { status, eventCount: n })
  batch.set(doc(db, 'parties', party.id, 'events', String(n)), {
    type: 'status',
    from: party.status,
    to: status,
    by: uid,
    at: serverTimestamp(),
  })
  await batch.commit()
}

/**
 * Transmet le rôle d'admin à un autre membre de la party. Journalisé (type 'owner').
 * L'ancien admin reste membre ; il perd ses droits d'admin (sauf s'il est super admin).
 */
export async function transferOwnership(party: Party, newOwnerUid: string): Promise<void> {
  const uid = requireUid()
  if (newOwnerUid === party.ownerUid) return
  const n = party.eventCount + 1
  const batch = writeBatch(db)
  batch.update(doc(db, 'parties', party.id), { ownerUid: newOwnerUid, eventCount: n })
  batch.set(doc(db, 'parties', party.id, 'events', String(n)), {
    type: 'owner',
    from: party.ownerUid,
    to: newOwnerUid,
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

/** Retire un membre de la party (pas son admin). */
export async function removeMember(partyId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, 'parties', partyId, 'members', uid))
}

/**
 * Je quitte la party (à confirmer dans l'interface). L'admin doit d'abord transmettre son rôle.
 * Mon prono reste dans la party ; si je reviens avec le code, je le retrouve.
 */
export async function leaveParty(party: Party): Promise<void> {
  const uid = requireUid()
  if (party.ownerUid === uid) {
    throw new AppError('party-invalid', "Tu es l'admin de cette party : transmets d'abord ton rôle à un autre membre.")
  }
  await deleteDoc(doc(db, 'parties', party.id, 'members', uid))
  setActivePartyId(null)
}

/** Phrase à recopier mot pour mot pour supprimer une party (double confirmation). */
export const DELETE_PARTY_PHRASE = 'je confirme la suppression de la party'

/** true si la phrase saisie correspond (majuscules et espaces en trop tolérés). */
export function deletePhraseMatches(typed: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  return norm(typed) === norm(DELETE_PARTY_PHRASE)
}

/**
 * Supprime la party (admin de la party ou super admin), après double confirmation :
 * `typedPhrase` doit correspondre à DELETE_PARTY_PHRASE. Supprime en un batch la party, son code
 * et toutes les adhésions : plus personne n'y a accès et les trophées de cette party disparaissent.
 * Les pronos, l'historique et le journal restent orphelins en base, inaccessibles.
 */
export async function deleteParty(party: Party, typedPhrase: string): Promise<void> {
  if (!deletePhraseMatches(typedPhrase)) {
    throw new AppError('party-invalid', 'Recopie la phrase exactement pour confirmer la suppression.')
  }
  const members = await getDocs(collection(db, 'parties', party.id, 'members'))
  const batch = writeBatch(db)
  members.forEach((m) => batch.delete(m.ref))
  batch.delete(doc(db, 'partyCodes', party.code))
  batch.delete(doc(db, 'parties', party.id))
  await batch.commit()
  setActivePartyId(null)
}

/** Saisit tout ou partie des résultats de la party (fusion). Passe null pour effacer un champ. */
export async function setResults(partyId: string, patch: Partial<Omit<Results, 'updatedAt'>>): Promise<void> {
  await setDoc(
    doc(db, 'parties', partyId, 'results', 'live'),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

// ---------- Sauvegarde (super admin) ----------

/** Rend les Timestamp Firestore lisibles dans le JSON (ISO 8601). */
function plain(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => {
      const date = toDate(v)
      return [k, date ? date.toISOString() : v]
    }),
  )
}

async function dump(first: string, ...rest: string[]): Promise<Record<string, Record<string, unknown>>> {
  const snap = await getDocs(collection(db, first, ...rest))
  return Object.fromEntries(snap.docs.map((d) => [d.id, plain(d.data())]))
}

/**
 * Sauvegarde complète lisible par le super admin : profils, et pour chaque party ses membres,
 * son journal, ses résultats, et ses pronos et historiques si elle est fermée (avant la
 * fermeture, les pronos sont illisibles même pour lui). À lancer après chaque soirée.
 */
export async function exportBackup(): Promise<Record<string, unknown>> {
  const users = await dump('users')
  const partiesSnap = await getDocs(query(collection(db, 'parties'), orderBy('createdAt', 'desc')))
  const parties: Record<string, unknown> = {}
  for (const p of partiesSnap.docs) {
    const data = p.data()
    const revealed = data.status !== 'open'
    parties[p.id] = {
      ...plain(data),
      members: await dump('parties', p.id, 'members'),
      events: await dump('parties', p.id, 'events'),
      results: await dump('parties', p.id, 'results'),
      picks: revealed ? await dump('parties', p.id, 'picks') : 'illisibles avant la fermeture',
      pickHistory: revealed ? await dump('parties', p.id, 'pickHistory') : 'illisible avant la fermeture',
    }
  }
  return { exportedAt: new Date().toISOString(), users, parties }
}

/** Télécharge la sauvegarde en fichier JSON (pronos-miss-sauvegarde-AAAA-MM-JJ.json). */
export async function downloadBackup(): Promise<void> {
  const backup = await exportBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pronos-miss-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
